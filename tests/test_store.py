import json

import pytest

from warmintro import store


def test_kind_and_weight_key():
    a, b = {"type": "startup"}, {"type": "individual"}
    assert store.kind_of(a, b) == store.kind_of(b, a) == "individual-startup"
    assert store.weight_key("individual-startup", "unexpected") == "individual-startup|unexpected"


def test_weights_round_trip(tmp_path, monkeypatch):
    monkeypatch.setenv("WARMINTRO_DATA_DIR", str(tmp_path / "data"))
    assert store.load_weights() == {}
    store.save_weights({"a-b|complementary": 1.12})
    assert store.load_weights() == {"a-b|complementary": 1.12}


def test_meeting_ids_increment_and_round_trip(runs_dir):
    assert store.next_meeting_id() == "mt001"
    assert store.get_meeting("mt001") is None
    store.save_meeting({"id": "mt001", "a": "m1", "b": "m2"})
    assert store.next_meeting_id() == "mt002"
    store.save_meeting({"id": "mt002", "a": "m1", "b": "m3"})
    assert store.next_meeting_id() == "mt003"
    assert store.get_meeting("mt002")["b"] == "m3"
    assert json.loads((runs_dir / "meetings.json").read_text())["synthetic"] is True


def test_save_run_writes_both_files_without_temp_leftovers(runs_dir):
    assert store.load_latest_run() is None
    run = {"run_id": "2026-11-13T15-02-11", "status": "complete"}
    store.save_run(run)
    assert store.load_latest_run() == run
    assert json.loads((runs_dir / "2026-11-13T15-02-11.json").read_text()) == run
    assert sorted(p.name for p in runs_dir.iterdir()) == ["2026-11-13T15-02-11.json", "latest.json"]


def test_failed_write_cleans_up_temp_file(runs_dir):
    with pytest.raises(TypeError):
        store.save_run({"run_id": "x", "bad": object()})
    assert list(runs_dir.iterdir()) == []


def test_missing_profiles_and_history_raise_helpful_error(tmp_path, monkeypatch):
    monkeypatch.setenv("WARMINTRO_DATA_DIR", str(tmp_path))
    with pytest.raises(FileNotFoundError, match="make data"):
        store.load_members()
    with pytest.raises(FileNotFoundError, match="make data"):
        store.load_history()


def test_load_members_and_history(tmp_path, monkeypatch):
    monkeypatch.setenv("WARMINTRO_DATA_DIR", str(tmp_path))
    (tmp_path / "profiles.json").write_text(json.dumps({"synthetic": True, "members": [{"id": "m001"}]}))
    (tmp_path / "history.json").write_text(json.dumps({"synthetic": True, "connections": [{"id": "h001"}]}))
    assert store.load_members() == [{"id": "m001"}]
    assert store.load_history() == [{"id": "h001"}]
