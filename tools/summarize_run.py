"""Summarize a warm-intro run log as Markdown. Spec: tools/SPEC_summarize_run.md."""
import argparse
import json
import re
import sys
from pathlib import Path


def summarize(run: dict) -> str:
    """Return a Markdown summary string for *run*. Pure — no I/O."""
    if not isinstance(run, dict):
        raise ValueError("run must be a dict")

    meetings = run.get("meetings")
    if meetings is None:
        meetings = []
    elif not isinstance(meetings, list):
        raise ValueError('"meetings" must be a list')

    # Build a name-lookup from members list.
    members_list = run.get("members") or []
    members = {m["id"]: m["name"] for m in members_list if "id" in m and "name" in m}

    run_id = run.get("run_id", "unknown") or "unknown"
    mode = run.get("mode", "unknown") or "unknown"

    stats_block = run.get("stats") or {}
    pairs_scored = stats_block.get("pairs_scored")
    passed_filter = stats_block.get("passed_filter")

    n_meetings = len(meetings)
    n_introduced = sum(1 for m in meetings if m.get("result") == "introduced")
    n_declined = sum(1 for m in meetings if m.get("result") == "declined")
    n_blocked = sum(1 for m in meetings if m.get("result") == "blocked_by_permissions")

    if n_meetings == 0:
        intro_rate = "n/a"
        decline_rate = "n/a"
    else:
        intro_rate = f"{round(100 * n_introduced / n_meetings)}%"
        decline_rate = f"{round(100 * n_declined / n_meetings)}%"

    pairs_str = str(pairs_scored) if pairs_scored is not None else "n/a"
    passed_str = str(passed_filter) if passed_filter is not None else "n/a"

    lines = [
        f"# Run summary: {run_id}",
        "",
        "_Synthetic data · AI-generated_",
        "",
        "## Stats",
        "",
        f"- Mode: {mode}",
        f"- Members: {len(members_list)}",
        f"- Pairs scored: {pairs_str}",
        f"- Passed filter: {passed_str}",
        f"- Meetings: {n_meetings}",
        f"- Introductions: {n_introduced}",
        f"- Declines: {n_declined}",
        f"- Blocked by permissions: {n_blocked}",
        f"- Introduction rate: {intro_rate}",
        f"- Decline rate: {decline_rate}",
        "",
        "## Meetings",
        "",
    ]

    if not meetings:
        lines.append("_No meetings in this run._")
    else:
        for i, m in enumerate(meetings):
            mid = m.get("id", "?") or "?"
            a_id = m.get("a", "")
            b_id = m.get("b", "")
            a_name = members.get(a_id, a_id)
            b_name = members.get(b_id, b_id)
            result = m.get("result", "unknown") or "unknown"

            lines.append(f"### {mid}: {a_name} x {b_name} ({result})")
            lines.append("")

            votes = m.get("votes") or {}
            for member_id, member_name in [(a_id, a_name), (b_id, b_name)]:
                vote_entry = votes.get(member_id)
                if vote_entry is None:
                    lines.append(f"- {member_name} ({member_id}): (no vote recorded)")
                else:
                    vote = vote_entry.get("vote", "")
                    reason_raw = vote_entry.get("reason", "") or ""
                    reason = re.sub(r"\s+", " ", reason_raw).strip()
                    if reason:
                        lines.append(f"- {member_name} ({member_id}): {vote} - {reason}")
                    else:
                        lines.append(f"- {member_name} ({member_id}): {vote} - (no reason given)")

            # Blank line between meetings, but not after the last one.
            if i < len(meetings) - 1:
                lines.append("")

    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarize a warm-intro run log.")
    parser.add_argument("run_json", help="Path to the run log JSON file.")
    parser.add_argument("-o", metavar="out.md", help="Write output to this file instead of stdout.")
    args = parser.parse_args(argv)

    path = args.run_json
    try:
        text = Path(path).read_text()
    except OSError as e:
        print(f"error: cannot read {path}: {e.strerror}", file=sys.stderr)
        return 1

    try:
        run = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"error: {path} is not valid JSON: {e}", file=sys.stderr)
        return 1

    if not isinstance(run, dict):
        print(f"error: {path} is not a run log (expected a JSON object)", file=sys.stderr)
        return 1

    if "meetings" in run and not isinstance(run["meetings"], list):
        print(f'error: {path} is not a run log ("meetings" must be a list)', file=sys.stderr)
        return 1

    try:
        summary = summarize(run)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    if args.o:
        try:
            Path(args.o).write_text(summary)
        except OSError as e:
            print(f"error: cannot write {args.o}: {e.strerror}", file=sys.stderr)
            return 1
    else:
        print(summary, end="")

    return 0


if __name__ == "__main__":
    sys.exit(main())
