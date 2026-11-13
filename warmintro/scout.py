"""Scout: score every pair of members, filter, label and pick meetings."""

import hashlib
import itertools
import json
import math
import re
from collections import Counter
from pathlib import Path

from warmintro.config import (
    BIDIRECTIONAL_BONUS,
    CONTRAST_NEED_MIN,
    CONTRAST_OFFER_MAX,
    HUB_BONUS,
    NOVELTY_WEIGHT,
    get_settings,
)
from warmintro.llm import LLM, get_llm
from warmintro.store import Candidate, Evidence, Member, kind_of, load_members, load_weights, weight_key

Vectors = dict[str, list[float]]


def _cache_path(llm: LLM) -> Path:
    settings = get_settings()
    model = getattr(llm, "model_id", None) or "default"
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", f"{settings.llm_provider}-{model}")
    return settings.data_dir / ".embeddings_cache" / f"{name}.json"


def embed_texts(llm: LLM, texts: list[str]) -> Vectors:
    """Map each distinct text to its vector. Real providers are a network call, so they cache to disk."""
    unique = list(dict.fromkeys(texts))
    if get_settings().llm_provider == "mock":
        return dict(zip(unique, llm.embed(unique), strict=True))

    path = _cache_path(llm)
    cache: dict[str, list[float]] = json.loads(path.read_text()) if path.exists() else {}
    key = {t: hashlib.sha256(t.encode()).hexdigest() for t in unique}
    missing = [t for t in unique if key[t] not in cache]
    if missing:
        for text, vec in zip(missing, llm.embed(missing), strict=True):
            cache[key[text]] = vec
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(cache))
    return {t: cache[key[t]] for t in unique}


def _cos(u: list[float], v: list[float]) -> float:
    nu, nv = math.sqrt(sum(x * x for x in u)), math.sqrt(sum(x * x for x in v))
    return sum(x * y for x, y in zip(u, v, strict=True)) / (nu * nv) if nu and nv else 0.0


def _best_match(
    needer: Member, offerer: Member, vecs: Vectors, needs: list[str] | None = None
) -> Evidence | None:
    """Best need -> offer pair; `needs` overrides the needer's own needs (ask mode)."""
    best: Evidence | None = None
    for need in needs if needs is not None else needer["needs"]:
        for offer in offerer["offers"]:
            sim = _cos(vecs[need], vecs[offer])
            if best is None or sim > best["similarity"]:
                best = {
                    "need_of": needer["id"],
                    "need": need,
                    "offer_of": offerer["id"],
                    "offer": offer,
                    "similarity": sim,
                }
    return best


def _unexpected_cutoff(novelties: list[float]) -> float:
    """Novelty at or above this value is in the top third of the passing set."""
    ranked = sorted(novelties, reverse=True)
    return ranked[math.ceil(len(ranked) / 3) - 1] if ranked else math.inf


def _finish(
    a: Member,
    b: Member,
    fit: float,
    novelty: float,
    evidence: list[Evidence],
    cutoff: float,
    weights: dict[str, float],
) -> Candidate:
    label = "unexpected" if novelty >= cutoff else "complementary"
    weight = weights.get(weight_key(kind_of(a, b), label), 1.0)
    cross_hub = a["hub"] != b["hub"]
    score = (fit + NOVELTY_WEIGHT * novelty) * weight * (1 + HUB_BONUS if cross_hub else 1)
    return {
        "a": a["id"],
        "b": b["id"],
        "fit": round(fit, 3),
        "novelty": round(novelty, 3),
        "weight": round(weight, 3),
        "cross_hub": cross_hub,
        "score": round(score, 3),
        "label": label,
        "evidence": [{**e, "similarity": round(e["similarity"], 3)} for e in evidence],
    }


def _vectors(members: list[Member], llm: LLM, extra: list[str] | None = None) -> Vectors:
    texts = list(extra or [])
    for m in members:
        texts += [m["description"], *m["needs"], *m["offers"]]
    return embed_texts(llm, texts)


def _can_propose(m: Member) -> bool:
    return m["permissions"]["propose_meetings"]


def _passing(members: list[Member], vecs: Vectors) -> tuple[list[tuple], int]:
    """Every eligible pair that clears the fit threshold, as (a, b, fit, novelty, evidence)."""
    threshold = get_settings().fit_threshold
    passing = []
    pairs_scored = 0
    for x, y in itertools.combinations([m for m in members if _can_propose(m)], 2):
        pairs_scored += 1
        matches = [m for m in (_best_match(x, y, vecs), _best_match(y, x, vecs)) if m]
        matches = sorted((m for m in matches if m["similarity"] >= threshold), key=lambda m: -m["similarity"])
        if not matches:
            continue
        # Reading of the contract: x1.10 when the reverse direction also clears the threshold.
        fit = matches[0]["similarity"] * (1 + BIDIRECTIONAL_BONUS if len(matches) == 2 else 1)
        a, b = (x, y) if matches[0]["need_of"] == x["id"] else (y, x)
        passing.append((a, b, fit, 1 - _cos(vecs[x["description"]], vecs[y["description"]]), matches))
    return passing, pairs_scored


def score_pairs(members: list[Member], weights: dict[str, float], llm: LLM) -> tuple[list[Candidate], dict]:
    """Score every unordered pair; return passing candidates by score, best first, plus stats."""
    passing, pairs_scored = _passing(members, _vectors(members, llm))
    cutoff = _unexpected_cutoff([p[3] for p in passing])
    candidates = [_finish(*p[:4], p[4], cutoff, weights) for p in passing]
    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates, {"pairs_scored": pairs_scored, "passed_filter": len(candidates)}


def _best_pair(xs: list[str], ys: list[str], vecs: Vectors) -> tuple[float, str, str]:
    return max((_cos(vecs[x], vecs[y]), x, y) for x in xs for y in ys)


def find_contrasts(members: list[Member], llm: LLM, top_k: int = 5) -> list[dict]:
    """Pairs working on the same problem (similar needs) with opposite approaches (dissimilar offers)."""
    vecs = _vectors(members, llm)
    found = []
    for a, b in itertools.combinations([m for m in members if _can_propose(m)], 2):
        if not (a["needs"] and b["needs"] and a["offers"] and b["offers"]):
            continue
        need_sim, need_a, need_b = _best_pair(a["needs"], b["needs"], vecs)
        offer_sim = _best_pair(a["offers"], b["offers"], vecs)[0]
        if need_sim < CONTRAST_NEED_MIN or offer_sim > CONTRAST_OFFER_MAX:
            continue
        found.append(
            {
                "a": a["id"],
                "b": b["id"],
                "label": "contrast",
                "need_similarity": round(need_sim, 3),
                "offer_similarity": round(offer_sim, 3),
                "shared_need": {"a": need_a, "b": need_b},
                "approaches": {"a": a["offers"][0], "b": b["offers"][0]},
                "_contrast": need_sim - offer_sim,
            }
        )
    found.sort(key=lambda c: c["_contrast"], reverse=True)
    return [{k: v for k, v in c.items() if k != "_contrast"} for c in found[:top_k]]


def select_meetings(
    candidates: list[Candidate], max_per_member: int | None = None, max_meetings: int | None = None
) -> list[Candidate]:
    """Greedy by score; each member appears in at most `max_per_member` selected pairs."""
    limit = max_per_member if max_per_member is not None else get_settings().max_meetings_per_member
    used: Counter[str] = Counter()
    chosen: list[Candidate] = []
    for cand in sorted(candidates, key=lambda c: c["score"], reverse=True):
        if max_meetings is not None and len(chosen) >= max_meetings:
            break
        if used[cand["a"]] < limit and used[cand["b"]] < limit:
            chosen.append(cand)
            used[cand["a"]] += 1
            used[cand["b"]] += 1
    return chosen


def _ask(member: Member, request: str, members: list[Member], weights: dict[str, float], llm: LLM) -> list[Candidate]:
    threshold = get_settings().fit_threshold
    vecs = _vectors(members, llm, [request])
    cutoff = _unexpected_cutoff([p[3] for p in _passing(members, vecs)[0]])
    found = []
    for other in members:
        if other["id"] == member["id"] or not _can_propose(other):
            continue
        ev = _best_match(member, other, vecs, [request])
        if ev is None or ev["similarity"] < threshold:
            continue
        novelty = 1 - _cos(vecs[member["description"]], vecs[other["description"]])
        found.append(_finish(member, other, ev["similarity"], novelty, [ev], cutoff, weights))
    return found


def scout(
    member_id: str | None = None,
    request: str | None = None,
    top_k: int = 10,
    *,
    members: list[Member] | None = None,
    weights: dict[str, float] | None = None,
    llm: LLM | None = None,
) -> list[Candidate]:
    """Best candidates for one member, that member as `a`. With `request`, the text is a one-off need."""
    members = members if members is not None else load_members()
    weights = weights if weights is not None else load_weights()
    llm = llm or get_llm()
    by_id = {m["id"]: m for m in members}
    if member_id not in by_id:
        raise KeyError(f"unknown member id: {member_id!r}")
    if not _can_propose(by_id[member_id]):
        return []
    if request:
        found = _ask(by_id[member_id], request, members, weights, llm)
    else:
        candidates, _ = score_pairs(members, weights, llm)
        found = [
            c if c["a"] == member_id else {**c, "a": c["b"], "b": c["a"]}
            for c in candidates
            if member_id in (c["a"], c["b"])
        ]
    return sorted(found, key=lambda c: c["score"], reverse=True)[:top_k]
