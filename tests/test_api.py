import json
import threading
import time

import pytest
from fastapi.testclient import TestClient

from warmintro import api


@pytest.fixture
def client(data_copy):
    return TestClient(api.app)


@pytest.fixture
def demo(data_copy):
    return json.loads((data_copy / "demo.json").read_text())


def test_health_and_members(client):
    assert client.get("/health").json() == {"ok": True, "provider": "mock"}
    body = client.get("/members").json()
    assert body["synthetic"] is True and len(body["members"]) > 10


def test_scout(client):
    r = client.post("/scout", json={"member_id": "m001", "top_k": 3})
    assert r.status_code == 200
    cands = r.json()["candidates"]
    assert 1 <= len(cands) <= 3 and all(c["a"] == "m001" for c in cands)
    assert client.post("/scout", json={"member_id": "m001", "request": "machine vision"}).status_code == 200
    assert client.post("/scout", json={"member_id": "zzz"}).status_code == 404
    assert client.post("/scout", json={}).status_code == 422


def test_meeting_and_feedback(client, demo):
    a, b = demo["yes_pairs"][0]
    r = client.post("/meeting", json={"a": a, "b": b})
    assert r.status_code == 200
    m = r.json()
    assert m["result"] == "introduced" and len(m["introductions"]) == 2 and m["synthetic"] is True
    fb = client.post("/feedback", json={"meeting_id": m["id"], "outcome": "pilot"})
    assert fb.status_code == 200
    body = fb.json()
    assert body["weights_after"] != body["weights_before"]
    assert client.post("/feedback", json={"meeting_id": "mt999", "outcome": "pilot"}).status_code == 404
    assert client.post("/feedback", json={"meeting_id": m["id"], "outcome": "wat"}).status_code == 422
    assert client.post("/meeting", json={"a": a, "b": "zzz"}).status_code == 404
    assert client.post("/meeting", json={"a": a, "b": a}).status_code == 422


def test_latest_404_then_round(client, demo):
    r = client.get("/runs/latest")
    assert r.status_code == 404 and "no round" in r.json()["detail"]
    run = client.post("/round", json={"member_ids": demo["member_ids"]}).json()
    assert run["status"] == "complete" and run["meetings"]
    assert client.get("/runs/latest").json()["run_id"] == run["run_id"]
    assert client.post("/round", json={"member_ids": ["zzz"]}).status_code == 404
    assert client.post("/round").status_code == 200  # empty body allowed


def _wait_complete(client, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        r = client.get("/runs/latest")
        if r.status_code == 200 and r.json()["status"] != "running":
            return r.json()
        time.sleep(0.05)
    raise AssertionError("round did not finish")


def test_background_round_and_409(client, demo, monkeypatch):
    gate = threading.Event()
    real = api.run_round

    def slow(*args, **kwargs):
        gate.wait(10)
        return real(*args, **kwargs)

    monkeypatch.setattr(api, "run_round", slow)
    r = client.post("/round", json={"member_ids": demo["member_ids"], "background": True})
    assert r.json()["status"] == "running" and r.json()["run_id"]
    busy = client.post("/round", json={})
    assert busy.status_code == 409 and "already running" in busy.json()["detail"]
    gate.set()
    run = _wait_complete(client)
    assert run["status"] == "complete" and run["run_id"] == r.json()["run_id"]
    assert client.post("/round", json={"member_ids": demo["member_ids"]}).status_code == 200  # lock released


def test_failed_background_round_releases_lock(client, monkeypatch):
    monkeypatch.setattr(api, "run_round", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    assert client.post("/round", json={"background": True}).status_code == 200
    for _ in range(100):
        if api._round_lock.acquire(blocking=False):
            api._round_lock.release()
            break
        time.sleep(0.05)
    else:
        raise AssertionError("lock still held")


@pytest.mark.parametrize("origin", ["http://localhost:5500", "http://127.0.0.1:8080", "null"])
def test_cors_allowed(client, origin):
    r = client.get("/health", headers={"Origin": origin})
    assert r.headers["access-control-allow-origin"] == origin


def test_cors_blocked_for_other_origin(client):
    r = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_operation_ids_and_descriptions():
    ops = {
        op["operationId"]: op
        for path in api.app.openapi()["paths"].values()
        for op in path.values()
    }
    assert {"getMembers", "scout", "holdMeeting", "recordFeedback", "runRound", "getLatestRun"} <= ops.keys()
    assert all(op.get("summary") and op.get("description") for op in ops.values())
