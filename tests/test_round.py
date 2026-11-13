import json
from collections import Counter

import pytest

from warmintro import round as rnd
from warmintro import store
from warmintro.config import get_settings

CONTRACT_KEYS = {
    "synthetic", "run_id", "mode", "request", "stats", "members", "candidates", "meetings",
    "introductions", "weights_before", "weights_after",
}  # fmt: skip


@pytest.fixture
def demo_ids(data_copy):
    return json.loads((data_copy / "demo.json").read_text())


@pytest.fixture
def demo_run(demo_ids):
    return rnd.run_round(demo_ids["member_ids"])


def test_run_log_matches_contract(demo_run):
    run = demo_run
    assert CONTRACT_KEYS <= run.keys()
    assert run["synthetic"] is True and run["ai_generated"] is True
    assert run["status"] == "complete" and run["mode"] == "proactive" and run["request"] is None
    assert set(run["stats"]) >= {"pairs_scored", "passed_filter", "meetings", "introductions"}
    assert run["stats"]["meetings"] == len(run["meetings"])
    assert run["stats"]["introductions"] == len(run["introductions"])
    ids = {m["id"] for m in run["members"]}
    assert all(set(m) >= {"id", "type", "name", "hub", "sector"} for m in run["members"])
    assert all(c["a"] in ids and c["b"] in ids for c in run["candidates"])
    assert all(m["a"] in ids and m["b"] in ids for m in run["meetings"])
    assert any(m.get("demo") for m in run["members"])
    assert len(run["run_id"]) == len("2026-11-13T15-02-11")


def test_outcomes_and_learning(demo_run, demo_ids):
    results = {frozenset((m["a"], m["b"])): m["result"] for m in demo_run["meetings"]}
    assert "introduced" in results.values() and "declined" in results.values()
    assert results[frozenset(demo_ids["no_pair"])] == "declined"
    for pair in demo_ids["yes_pairs"]:
        assert results[frozenset(pair)] == "introduced"
    assert demo_run["weights_after"] != demo_run["weights_before"]
    assert demo_run["weights_after"] == store.load_weights()


def test_latest_and_run_file_written(demo_run):
    runs = get_settings().runs_dir
    assert json.loads((runs / "latest.json").read_text()) == demo_run
    assert (runs / f"{demo_run['run_id']}.json").exists()


def test_run_is_saved_running_before_the_end(demo_ids, monkeypatch):
    seen = []
    real = store.save_run
    monkeypatch.setattr(store, "save_run", lambda run: (seen.append(run["status"]), real(run)))
    rnd.run_round(demo_ids["member_ids"])
    assert seen[0] == "running" and seen[-1] == "complete" and seen.count("running") > 3


def test_budgets_respected(data_copy):
    path = data_copy / "profiles.json"
    doc = json.loads(path.read_text())
    for m in doc["members"]:
        m["intro_budget"] = 1
    path.write_text(json.dumps(doc))
    run = rnd.run_round(max_meetings=20)
    intros = Counter(i["to"] for i in run["introductions"])
    assert intros and max(intros.values()) == 1
    for m in run["meetings"]:
        if m["result"] == "introduced":
            assert all(v["vote"] == "yes" for v in m["votes"].values())


def test_ask_mode(data_copy):
    run = rnd.run_round(request="camera surface defect inspection for stamped parts", requester="m001")
    assert run["mode"] == "ask" and run["request"].startswith("camera")
    assert 1 <= len(run["meetings"]) <= 3
    assert all(m["a"] == "m001" for m in run["meetings"])
    assert run["status"] == "complete"


def test_errors(data_copy):
    with pytest.raises(ValueError):
        rnd.run_round(request="x")
    with pytest.raises(KeyError):
        rnd.run_round(["nope"])


def test_cli_demo_writes_out_file(data_copy, tmp_path, capsys):
    out = tmp_path / "out" / "demo.json"
    assert rnd.main(["--demo", "--out", str(out)]) == 0
    text = capsys.readouterr().out
    assert "introduced (yes/yes)" in text and "provider: mock" in text
    assert json.loads(out.read_text())["status"] == "complete"


def test_cli_error_exit(data_copy, capsys):
    assert rnd.main(["--request", "x"]) == 1
    assert "error:" in capsys.readouterr().err
