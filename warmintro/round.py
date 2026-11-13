"""One round: scout -> meetings -> introductions -> run log."""

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

from warmintro import feedback, store
from warmintro.config import MAX_MEETINGS_PER_ROUND, get_settings
from warmintro.llm import LLM, get_llm
from warmintro.meeting import run_meeting
from warmintro.scout import find_contrasts, score_pairs, scout, select_meetings
from warmintro.store import Candidate, Meeting, Run, Turn

MAX_LOGGED_CANDIDATES = 40  # keeps the run file small; stats report the true counts
ASK_TOP_K = 3


def _member_row(m: store.Member) -> dict:
    row = {k: m[k] for k in ("id", "type", "name", "hub", "sector")}
    if m.get("demo"):
        row["demo"] = True
    return row


def _snapshot(run: Run, by_id: dict, cands: list[Candidate]) -> None:
    """Fill the derived fields of the run log and save it."""
    ids = {i for c in cands for i in (c["a"], c["b"])} | {i for m in run["meetings"] for i in (m["a"], m["b"])}
    run["members"] = [_member_row(by_id[i]) for i in sorted(ids)]
    run["candidates"] = cands[:MAX_LOGGED_CANDIDATES]
    run["introductions"] = [i for m in run["meetings"] for i in m.get("introductions", [])]  # type: ignore[attr-defined]
    run["stats"]["meetings"] = len(run["meetings"])
    run["stats"]["introductions"] = len(run["introductions"])
    store.save_run(run)


def run_round(
    member_ids: list[str] | None = None,
    max_meetings: int = MAX_MEETINGS_PER_ROUND,
    *,
    mode: str = "proactive",
    request: str | None = None,
    requester: str | None = None,
    llm: LLM | None = None,
    run_id: str | None = None,
) -> Run:
    llm = llm or get_llm()
    members = store.load_members()
    if member_ids is not None:
        wanted = set(member_ids)
        unknown = wanted - {m["id"] for m in members}
        if unknown:
            raise KeyError(f"unknown member id: {sorted(unknown)[0]!r}")
        members = [m for m in members if m["id"] in wanted]
    if request or requester:
        mode = "ask"
    if mode == "ask" and not (request and requester):
        raise ValueError("ask mode needs both a request and a requester")
    by_id = {m["id"]: m for m in members}
    if requester and requester not in by_id:
        raise KeyError(f"unknown member id: {requester!r}")

    weights_before = store.load_weights()
    run: Run = {
        "synthetic": True,
        "run_id": run_id or datetime.now().strftime("%Y-%m-%dT%H-%M-%S"),
        "mode": mode,
        "request": request if mode == "ask" else None,
        "status": "running",
        "stats": {"pairs_scored": 0, "passed_filter": 0, "meetings": 0, "introductions": 0},
        "members": [],
        "candidates": [],
        "meetings": [],
        "introductions": [],
        "contrasts": [],
        "weights_before": weights_before,
        "weights_after": weights_before,
        "ai_generated": True,
    }
    cands: list[Candidate] = []
    store.save_run(run)  # a poller sees "running" at once, before scoring
    try:
        if mode == "ask":
            cands = scout(requester, request, top_k=len(members), members=members, weights=weights_before, llm=llm)
            run["stats"]["pairs_scored"] = len(members) - 1
            chosen = cands[:ASK_TOP_K]
        else:
            cands, stats = score_pairs(members, weights_before, llm)
            run["stats"].update(stats)
            chosen = select_meetings(cands, max_meetings=max_meetings)
            run["contrasts"] = find_contrasts(members, llm)
        run["stats"]["passed_filter"] = len(cands)
        _snapshot(run, by_id, cands)

        budgets = {m["id"]: m["intro_budget"] for m in members}
        for cand in chosen:
            turns: list[Turn] = []
            partial: Meeting = {
                "id": store.next_meeting_id(),
                "a": cand["a"],
                "b": cand["b"],
                "candidate": cand,
                "transcript": turns,
                "votes": {},
                "result": "in_progress",
                "ai_generated": True,
            }

            def on_turn(turn: Turn, partial=partial, turns=turns) -> None:
                turns.append(turn)
                run["meetings"].append(partial)
                _snapshot(run, by_id, cands)
                run["meetings"].pop()

            meeting = run_meeting(
                cand["a"], cand["b"], candidate=cand, budgets=budgets, members=members, llm=llm, on_turn=on_turn
            )
            run["meetings"].append(meeting)
            if meeting["result"] == "introduced":
                for mid, v in meeting["votes"].items():
                    if v["vote"] == "yes":
                        budgets[mid] -= 1
            elif meeting["result"] == "declined":
                feedback.record_decline(meeting)
            _snapshot(run, by_id, cands)

        run["weights_after"] = store.load_weights()
        run["status"] = "complete"
    except Exception as exc:
        run["status"] = "error"
        run["error"] = str(exc)  # type: ignore[typeddict-unknown-key]
        _snapshot(run, by_id, cands)  # so a polling page stops waiting
        raise
    _snapshot(run, by_id, cands)
    return run


def _summary(run: Run) -> str:
    s = run["stats"]
    lines = [
        f"run {run['run_id']} ({run['mode']}): {s['pairs_scored']} pairs scored, {s['passed_filter']} passed, "
        f"{s['meetings']} meetings, {s['introductions']} introductions"
    ]
    for m in run["meetings"]:
        votes = "/".join(v["vote"] for v in m["votes"].values())
        lines.append(f"{m['id']} {m['a']}x{m['b']} {m['result']} ({votes})")
    lines.append(f"provider: {get_settings().llm_provider}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m warmintro.round", description="Run one introduction round.")
    p.add_argument("--demo", action="store_true", help="only the members listed in data/demo.json")
    p.add_argument("--max-meetings", type=int, default=MAX_MEETINGS_PER_ROUND)
    p.add_argument("--request", help="ask mode: a plain-words need")
    p.add_argument("--requester", help="ask mode: the member id who asks")
    p.add_argument("--out", type=Path, help="also copy the final run log here")
    args = p.parse_args(argv)
    try:
        ids = None
        if args.demo:
            ids = json.loads((get_settings().data_dir / "demo.json").read_text())["member_ids"]
        run = run_round(ids, args.max_meetings, request=args.request, requester=args.requester)
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(get_settings().runs_dir / f"{run['run_id']}.json", args.out)
    except (KeyError, ValueError, FileNotFoundError, NotImplementedError) as exc:
        msg = exc.args[0] if isinstance(exc, KeyError) else exc
        print(f"error: {msg}", file=sys.stderr)
        return 1
    print(_summary(run))
    return 0


if __name__ == "__main__":
    sys.exit(main())
