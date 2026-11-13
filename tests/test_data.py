"""Validator for the generated synthetic data (shapes follow docs/CONTRACTS.md)."""

import itertools
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

from warmintro.feedback import derive_weights
from warmintro.llm import MockLLM, tokenize

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FILES = ("profiles.json", "history.json", "weights.json", "demo.json")
TYPES = {"individual", "startup", "small_business", "corporation"}
HUBS = {"detroit", "grand_rapids", "ann_arbor"}
OUTCOMES = {"pilot", "hire", "partnership", "no_follow_up"}
PHONE = re.compile(r"\d{3}[\s.\-)]*\d{3}[\s.\-]*\d{4}|\d{7,}")


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def members() -> list[dict]:
    return load("profiles.json")["members"]


def by_id() -> dict[str, dict]:
    return {m["id"]: m for m in members()}


def test_files_exist_and_are_flagged_synthetic():
    for name in FILES:
        assert (DATA / name).is_file(), name
    for name in ("profiles.json", "history.json", "demo.json"):
        assert load(name)["synthetic"] is True


def test_generator_is_deterministic(tmp_path):
    out = tmp_path / "out"
    cmd = [sys.executable, str(ROOT / "scripts" / "generate_data.py"), "--out", str(out)]
    subprocess.run(cmd, check=True, capture_output=True)
    for name in FILES:
        assert (out / name).read_bytes() == (DATA / name).read_bytes(), name


def test_member_shapes():
    ms = members()
    assert [m["id"] for m in ms] == [f"m{i:03d}" for i in range(1, 61)]
    for m in ms:
        assert m["type"] in TYPES and m["hub"] in HUBS
        assert m["name"] and m["sector"]
        assert 2 <= len(re.findall(r"[.!?](?:\s|$)", m["description"])) <= 3, m["id"]
        assert 2 <= len(m["needs"]) <= 3 and 2 <= len(m["offers"]) <= 3
        assert 1 <= len(m["deal_breakers"]) <= 2
        assert m["intro_budget"] in (1, 2, 3)
        assert set(m["permissions"]) == {"share_profile", "propose_meetings", "contact_member"}
        assert all(isinstance(v, bool) for v in m["permissions"].values())


def test_balance_and_restrictive_members():
    ms = members()
    assert Counter(m["type"] for m in ms) == {t: 15 for t in TYPES}
    assert Counter(m["hub"] for m in ms) == {h: 20 for h in HUBS}
    restricted = [m for m in ms if not m.get("demo") and not all(m["permissions"].values())]
    assert sorted(
        k for m in restricted for k, v in m["permissions"].items() if not v
    ) == ["contact_member", "propose_meetings"]
    assert not any(not all(m["permissions"].values()) for m in ms if m.get("demo"))


def test_history_matches_members():
    ms = by_id()
    conns = load("history.json")["connections"]
    assert [c["id"] for c in conns] == [f"h{i:03d}" for i in range(1, 41)]
    for c in conns:
        a, b = ms[c["a"]], ms[c["b"]]
        assert not a.get("demo") and not b.get("demo") and a["id"] != b["id"]
        assert c["kind"] == "-".join(sorted([a["type"], b["type"]]))
        assert c["cross_hub"] == (a["hub"] != b["hub"])
        assert c["label"] in ("complementary", "unexpected") and c["outcome"] in OUTCOMES
        assert "2026-01-01" <= c["date"] < "2026-11-01"
    assert len({frozenset((c["a"], c["b"])) for c in conns}) == len(conns)


def test_weights_derived_from_history_and_in_range():
    weights = load("weights.json")
    assert weights == derive_weights(load("history.json")["connections"])
    assert "synthetic" not in weights
    assert all(0.5 <= v <= 1.5 for v in weights.values())
    assert max(weights.values()) - min(weights.values()) >= 0.4


def test_no_contact_details():
    for name in FILES:
        text = (DATA / name).read_text(encoding="utf-8")
        assert "@" not in text
        assert not PHONE.search(text), name


def _pairs():
    demo = load("demo.json")
    ms = by_id()
    assert set(demo["member_ids"]) == {m["id"] for m in ms.values() if m.get("demo")}
    assert demo["member_ids"] == [f"m{i:03d}" for i in range(1, 9)]
    return demo, ms


def test_demo_pairs_reference_demo_members_with_distinct_kinds():
    demo, ms = _pairs()
    assert len(demo["yes_pairs"]) == 3
    kinds = []
    for a, b in demo["yes_pairs"] + [demo["no_pair"]]:
        assert a in demo["member_ids"] and b in demo["member_ids"]
    for a, b in demo["yes_pairs"]:
        kinds.append("-".join(sorted([ms[a]["type"], ms[b]["type"]])))
    assert len(set(kinds)) == 3


def best_fit(a: dict, b: dict) -> float:
    llm = MockLLM()
    best = 0.0
    for x, y in ((a, b), (b, a)):
        needs, offers = llm.embed(x["needs"]), llm.embed(y["offers"])
        best = max([best] + [sum(p * q for p, q in zip(n, o)) for n, o in itertools.product(needs, offers)])
    return best


def test_planted_pairs_have_strong_need_offer_fit():
    demo, ms = _pairs()
    for a, b in demo["yes_pairs"] + [demo["no_pair"]]:
        assert best_fit(ms[a], ms[b]) >= 0.6, (a, b)


def spoken_tokens(member: dict) -> set[str]:
    """Everything the mock agent says over its turns: never its deal-breakers."""
    text = " ".join([member["name"], member["description"], *member["needs"], *member["offers"]])
    return set(tokenize(text))


def conflicts(speaker: dict, listener: dict) -> list[str]:
    heard = spoken_tokens(speaker)
    return [d for d in listener["deal_breakers"] if tokenize(d) and set(tokenize(d)) <= heard]


def test_no_pair_hits_a_deal_breaker_and_yes_pairs_do_not():
    demo, ms = _pairs()
    a, b = (ms[i] for i in demo["no_pair"])
    assert conflicts(a, b) or conflicts(b, a)
    assert [d for d in conflicts(a, b)] + [d for d in conflicts(b, a)] == ["unpaid roles"]
    for x, y in demo["yes_pairs"]:
        assert not conflicts(ms[x], ms[y]) and not conflicts(ms[y], ms[x]), (x, y)
