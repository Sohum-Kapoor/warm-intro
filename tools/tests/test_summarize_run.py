"""Tests for tools/summarize_run.py. Spec: tools/SPEC_summarize_run.md.

The implementation is built by a person in IBM Bob. Until it exists, every test
fails with a message saying so (it does not crash at collection).
"""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "summarize_run.py"
SAMPLE = ROOT / "web" / "fixtures" / "sample_run.json"
LABEL = "_Synthetic data · AI-generated_"


@pytest.fixture(scope="module")
def tool():
    if not TOOL.exists():
        pytest.fail(
            "tools/summarize_run.py does not exist yet. Build it in IBM Bob from "
            "tools/SPEC_summarize_run.md (see tools/BOB_PROMPT.md).",
            pytrace=False,
        )
    spec = importlib.util.spec_from_file_location("summarize_run", TOOL)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for name in ("summarize", "main"):
        assert hasattr(mod, name), f"tools/summarize_run.py must define {name}()"
    return mod


@pytest.fixture(scope="module")
def sample():
    return json.loads(SAMPLE.read_text())


def run_cli(*args):
    return subprocess.run(
        [sys.executable, str(TOOL), *map(str, args)], capture_output=True, text=True
    )


def meeting(mid="mt1", a="m1", b="m2", result="introduced", votes=None):
    m = {"id": mid, "a": a, "b": b, "transcript": [], "result": result}
    if votes is not None:
        m["votes"] = votes
    return m


def make_run(meetings, **extra):
    run = {
        "synthetic": True,
        "run_id": "r1",
        "mode": "proactive",
        "stats": {"pairs_scored": 10, "passed_filter": 2},
        "members": [
            {"id": "m1", "name": "Alpha Co"},
            {"id": "m2", "name": "Beta Labs"},
        ],
        "meetings": meetings,
    }
    run.update(extra)
    return run


# ---- sample run ----

def test_sample_header_and_label(tool, sample):
    lines = tool.summarize(sample).split("\n")
    assert lines[0] == "# Run summary: sample-0001"
    assert lines[1] == ""
    assert lines[2] == LABEL


def test_sample_stats(tool, sample):
    lines = tool.summarize(sample).split("\n")
    for line in [
        "## Stats",
        "- Mode: proactive",
        "- Members: 6",
        "- Pairs scored: 15",
        "- Passed filter: 3",
        "- Meetings: 2",
        "- Introductions: 1",
        "- Declines: 1",
        "- Blocked by permissions: 0",
        "- Introduction rate: 50%",
        "- Decline rate: 50%",
    ]:
        assert line in lines, f"missing line: {line}"


def test_sample_meetings(tool, sample):
    lines = tool.summarize(sample).split("\n")
    assert "## Meetings" in lines
    assert "### mt001: Kestrel Stamping x Lumen Sight (introduced)" in lines
    assert "### mt002: Tern Aerial x Priya N. (declined)" in lines
    assert (
        "- Kestrel Stamping (m001): yes - It addresses our stated defect problem, "
        "and a paid one-line pilot respects our limits."
    ) in lines
    assert (
        "- Priya N. (m003): no - The role is unpaid, which is one of my member's "
        "deal-breakers."
    ) in lines


def test_sample_order_and_no_transcript(tool, sample):
    out = tool.summarize(sample)
    assert out.index("### mt001") < out.index("### mt002")
    # a's bullet comes before b's bullet
    assert out.index("- Tern Aerial (m004)") < out.index("- Priya N. (m003)")
    assert "Lumen Sight's cameras mount" not in out  # transcripts are not included


def test_output_ends_with_single_newline(tool, sample):
    out = tool.summarize(sample)
    assert out.endswith("\n") and not out.endswith("\n\n")


def test_stats_come_from_meetings_not_stats_block(tool, sample):
    run = json.loads(json.dumps(sample))
    run["stats"]["meetings"] = 99
    run["stats"]["introductions"] = 99
    lines = tool.summarize(run).split("\n")
    assert "- Meetings: 2" in lines and "- Introductions: 1" in lines


# ---- edge cases ----

def test_empty_meetings(tool):
    lines = tool.summarize(make_run([])).split("\n")
    assert lines[2] == LABEL
    assert "- Meetings: 0" in lines
    assert "- Introduction rate: n/a" in lines
    assert "- Decline rate: n/a" in lines
    assert "_No meetings in this run._" in lines


def test_missing_meetings_key(tool):
    run = make_run([])
    del run["meetings"]
    assert "_No meetings in this run._" in tool.summarize(run)


def test_missing_reason(tool):
    votes = {"m1": {"vote": "yes"}, "m2": {"vote": "no", "reason": ""}}
    out = tool.summarize(make_run([meeting(result="declined", votes=votes)]))
    assert "- Alpha Co (m1): yes - (no reason given)" in out
    assert "- Beta Labs (m2): no - (no reason given)" in out


def test_missing_vote_and_missing_votes(tool):
    out = tool.summarize(
        make_run([meeting(votes={"m1": {"vote": "yes", "reason": "ok"}})])
    )
    assert "- Beta Labs (m2): (no vote recorded)" in out
    out = tool.summarize(make_run([meeting()]))
    assert "- Alpha Co (m1): (no vote recorded)" in out
    assert "- Beta Labs (m2): (no vote recorded)" in out


def test_unknown_member_id_used_as_name(tool):
    out = tool.summarize(make_run([meeting(a="m1", b="m9")]))
    assert "### mt1: Alpha Co x m9 (introduced)" in out
    assert "- m9 (m9):" in out


def test_blocked_by_permissions_counted(tool):
    lines = tool.summarize(make_run([meeting(result="blocked_by_permissions")])).split("\n")
    assert "- Blocked by permissions: 1" in lines
    assert "- Introductions: 0" in lines and "- Declines: 0" in lines


def test_unknown_result_counts_only_as_meeting(tool):
    lines = tool.summarize(make_run([meeting(result="weird")])).split("\n")
    assert "- Meetings: 1" in lines
    assert "- Introduction rate: 0%" in lines


def test_missing_stats_block(tool):
    run = make_run([meeting()])
    del run["stats"]
    lines = tool.summarize(run).split("\n")
    assert "- Pairs scored: n/a" in lines and "- Passed filter: n/a" in lines


def test_multiline_reason_collapsed(tool):
    votes = {
        "m1": {"vote": "yes", "reason": "line one\n  line two"},
        "m2": {"vote": "yes", "reason": "fine"},
    }
    out = tool.summarize(make_run([meeting(votes=votes)]))
    assert "- Alpha Co (m1): yes - line one line two" in out.split("\n")


def test_label_present_even_if_not_synthetic(tool):
    out = tool.summarize(make_run([], synthetic=False))
    assert LABEL in out.split("\n")


def test_rounding(tool):
    ms = [
        meeting(mid=f"mt{i}", result="introduced" if i == 0 else "declined")
        for i in range(3)
    ]
    lines = tool.summarize(make_run(ms)).split("\n")
    assert "- Introduction rate: 33%" in lines and "- Decline rate: 67%" in lines


def test_summarize_rejects_non_dict(tool):
    with pytest.raises(ValueError):
        tool.summarize([])


def test_summarize_rejects_bad_meetings(tool):
    with pytest.raises(ValueError):
        tool.summarize({"meetings": "nope"})


# ---- CLI ----

def test_cli_prints_summary(tool):
    r = run_cli(SAMPLE)
    assert r.returncode == 0, r.stderr
    assert r.stdout.split("\n")[0] == "# Run summary: sample-0001"
    assert LABEL in r.stdout


def test_cli_output_file(tool, tmp_path):
    out = tmp_path / "out.md"
    r = run_cli(SAMPLE, "-o", out)
    assert r.returncode == 0, r.stderr
    assert r.stdout == ""
    assert out.read_text().startswith("# Run summary: sample-0001")


def test_cli_missing_file(tool, tmp_path):
    r = run_cli(tmp_path / "nope.json")
    assert r.returncode == 1
    assert r.stdout == ""
    assert r.stderr.startswith("error: cannot read")
    assert "Traceback" not in r.stderr


def test_cli_invalid_json(tool, tmp_path):
    p = tmp_path / "bad.json"
    p.write_text("{not json")
    r = run_cli(p)
    assert r.returncode == 1
    assert "is not valid JSON" in r.stderr and "Traceback" not in r.stderr


def test_cli_not_an_object(tool, tmp_path):
    p = tmp_path / "list.json"
    p.write_text("[1, 2]")
    r = run_cli(p)
    assert r.returncode == 1
    assert "not a run log" in r.stderr


def test_cli_meetings_not_a_list(tool, tmp_path):
    p = tmp_path / "m.json"
    p.write_text('{"meetings": 3}')
    r = run_cli(p)
    assert r.returncode == 1
    assert "not a run log" in r.stderr


def test_cli_unwritable_output(tool, tmp_path):
    r = run_cli(SAMPLE, "-o", tmp_path / "no_such_dir" / "out.md")
    assert r.returncode == 1
    assert r.stderr.startswith("error: cannot write")
