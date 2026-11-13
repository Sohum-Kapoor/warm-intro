"""Build site/data/site_data.js: one `window.WARM_INTRO = {...};` statement for the product site.

Run in an ISOLATED copy of data/ and runs/ (it writes meetings and weights):
  WARMINTRO_DATA_DIR=... WARMINTRO_RUNS_DIR=... LLM_PROVIDER=watsonx python scripts/build_site_data.py
Flags: --reuse-network / --reuse-asks reuse parts cached in the runs dir (cheap re-runs).
Never reads or prints keys. The learning section is a simulation.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from warmintro import feedback, resources, store  # noqa: E402
from warmintro.config import get_settings  # noqa: E402
from warmintro.llm import get_llm  # noqa: E402
from warmintro.meeting import run_meeting  # noqa: E402
from warmintro.round import run_round  # noqa: E402
from warmintro.scout import score_pairs, scout  # noqa: E402

OUT = ROOT / "site" / "data" / "site_data.js"
ASKS = [
    ("m001", "find me someone who can do machine vision for inspection on stamped parts"),
    ("m017", "I'm an engineering student looking for a paid part-time engineering role at a startup building hardware"),
    ("m005", "we keep getting hit by late supplier deliveries and need a startup that can warn us before parts run late at the plant"),
    ("m044", "we're a small craft brewer and need help with packaging and brand"),
]


def _cache(name: str) -> Path:
    return get_settings().runs_dir / f"site_{name}.json"


def _ranking(members: list, weights: dict, llm) -> list[dict]:
    by_id = {m["id"]: m for m in members}
    cands, _ = score_pairs(members, weights, llm)
    return [
        {"a": c["a"], "b": c["b"], "a_name": by_id[c["a"]]["name"], "b_name": by_id[c["b"]]["name"],
         "score": c["score"], "kind": store.kind_of(by_id[c["a"]], by_id[c["b"]]), "label": c["label"]}
        for c in cands[:10]
    ]


def _pair(r: dict) -> frozenset:
    return frozenset((r["a"], r["b"]))


def _changed(before: list[dict], after: list[dict]) -> bool:
    return [_pair(r) for r in before] != [_pair(r) for r in after]


def build_learning(network_run: dict, members: list, llm) -> dict:
    by_id = {m["id"]: m for m in members}
    intro = [m for m in network_run["meetings"] if m["result"] == "introduced"]

    def key(m):
        return store.weight_key(store.kind_of(by_id[m["a"]], by_id[m["b"]]), m["candidate"]["label"])

    start = store.load_weights()
    before = _ranking(members, start, llm)
    # the hero pair (Lumen Sight x Kestrel Stamping) gets the positive outcomes; a different kind|label gets the negative ones
    heroes = [m for m in intro if {m["a"], m["b"]} == {"m001", "m002"}]
    if not heroes:
        raise RuntimeError("hero pair m001 x m002 was not introduced in the network round")
    for pos in heroes:
        for neg in intro:
            if key(pos) == key(neg):
                continue
            store.save_weights(start)
            for _ in range(3):
                feedback.record_outcome(pos["id"], "pilot")
            for _ in range(3):
                feedback.record_outcome(neg["id"], "no_follow_up")
            after_w = store.load_weights()
            after = _ranking(members, after_w, llm)
            if _changed(before, after):
                rec = lambda m, o: {"key": key(m), "outcome": o, "times": 3, "meeting_pair": [m["a"], m["b"]]}  # noqa: E731
                return {"outcomes_recorded": [rec(pos, "pilot"), rec(neg, "no_follow_up")],
                        "weights_before": start, "weights_after": after_w,
                        "ranking_before": before, "ranking_after": after}
    raise RuntimeError("no pair of introduced meetings changes the top-10 ranking")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reuse-network", action="store_true")
    ap.add_argument("--reuse-asks", action="store_true")
    args = ap.parse_args()
    s = get_settings()
    if s.llm_provider != "watsonx":
        print("set LLM_PROVIDER=watsonx", file=sys.stderr)
        return 1
    llm = get_llm()
    members = store.load_members()

    if args.reuse_network and _cache("network").exists():
        network_run = json.loads(_cache("network").read_text())
    else:
        network_run = run_round(max_meetings=8, mode="proactive", llm=llm)
        _cache("network").write_text(json.dumps(network_run))
    for m in network_run["meetings"]:  # a reused round was not re-held: make sure its meetings are in this runs dir
        if store.get_meeting(m["id"]) is None:
            store.save_meeting(m)
    print("network:", network_run["stats"], flush=True)

    if args.reuse_asks and _cache("asks").exists():
        asks = json.loads(_cache("asks").read_text())
    else:
        asks = []
        for requester, request in ASKS:
            cands = scout(requester, request, top_k=3, members=members, weights=store.load_weights(), llm=llm)
            meeting = None
            if cands:
                # one attempt only: whatever the agents decide (including a decline) is what is shown
                meeting = run_meeting(requester, cands[0]["b"], candidate=cands[0], members=members, llm=llm)
            asks.append({"request": request, "requester": requester, "candidates": cands, "meeting": meeting})
            print("ask:", requester, [c["b"] for c in cands], meeting and meeting["result"], flush=True)
        _cache("asks").write_text(json.dumps(asks))

    resource_list = store.load_resources()
    wanted = {m["a"] for m in network_run["meetings"]} | {m["b"] for m in network_run["meetings"]}
    wanted |= {a["requester"] for a in asks} | {f"m00{i}" for i in range(1, 9)}
    by_id = {m["id"]: m for m in members}
    suggestions = {mid: resources.suggest(by_id[mid], resource_list, llm, k=2) for mid in sorted(wanted) if mid in by_id}
    for mid in (f"m00{i}" for i in range(1, 9)):
        print("suggest:", mid, by_id[mid]["name"], [(x["name"], x["similarity"]) for x in suggestions[mid]], flush=True)

    learning = build_learning(network_run, members, llm)
    data = {
        "synthetic": True,
        "ai_generated": True,
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "provider": "watsonx",
        "chat_model": s.watsonx_chat_model_id,
        "embed_model": s.watsonx_embedding_model_id,
        "members": [{k: m[k] for k in ("id", "name", "type", "hub", "sector", "description", "needs", "offers", "demo", "deal_breakers", "intro_budget", "permissions") if k in m} for m in members],
        "demo_run": json.loads((ROOT / "runs" / "demo.json").read_text()),
        "network_run": network_run,
        "asks": asks,
        "resources": store.load_resources_doc()["resources"],
        "resources_note": store.load_resources_doc()["note"],
        "resource_suggestions": suggestions,
        "learning": learning,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("window.WARM_INTRO = " + json.dumps(data, indent=2) + ";\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
