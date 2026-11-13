import pytest
from fastapi.testclient import TestClient

from warmintro import guard
from warmintro.api import app

KEY = "presenter-key"
ADMIN = {"X-Admin-Key": KEY}
SEEDED = "m001"
ASK = {"member_id": SEEDED, "request": "a machine vision partner", "meet": False}


@pytest.fixture
def client(data_copy):
    guard.take_snapshot()
    guard.reset_limits()
    yield TestClient(app)
    guard.reset_limits()


@pytest.fixture
def keyed(monkeypatch):
    monkeypatch.setenv("WARMINTRO_ADMIN_KEY", KEY)


@pytest.fixture
def limits(monkeypatch):
    monkeypatch.setenv("WARMINTRO_RATE_LIMITS", "on")
    now = [1000.0]
    monkeypatch.setattr(guard, "_clock", lambda: now[0])
    return now


def make_user(client) -> str:
    draft = client.post("/onboard/draft", json={
        "name": "Test Co", "type": "startup", "hub": "detroit",
        "about": "We are a tiny synthetic startup that needs a machine vision partner and offers software.",
    }).json()["draft"]
    return client.post("/onboard", json=draft).json()["member"]["id"]


def test_seeded_patch_needs_key(client, keyed):
    r = client.patch(f"/members/{SEEDED}", json={"paused": True})
    assert r.status_code == 403
    assert r.json()["detail"] == (
        "This is a seeded demo member; edits need the presenter key. Create your own agent to edit freely."
    )
    assert client.patch(f"/members/{SEEDED}", json={"paused": True}, headers={"X-Admin-Key": "wrong"}).status_code == 403
    assert client.patch(f"/members/{SEEDED}", json={"paused": True}, headers=ADMIN).status_code == 200


def test_user_created_member_editable_without_key(client, keyed):
    member_id = make_user(client)
    assert client.patch(f"/members/{member_id}", json={"paused": True}).status_code == 200


def test_no_key_configured_changes_nothing(client):
    assert client.patch(f"/members/{SEEDED}", json={"paused": True}).status_code == 200
    assert client.post("/admin/reset", headers=ADMIN).status_code == 404


def test_per_ip_limit(client, limits):
    for _ in range(10):
        assert client.post("/ask", json=ASK).status_code == 200
    r = client.post("/ask", json=ASK)
    assert r.status_code == 429
    assert r.headers["Retry-After"] == "60"
    assert r.json()["detail"] == "Your agent is busy; try again in 60 seconds."
    assert client.get("/members").status_code == 200  # reads are never limited
    other = client.post("/ask", json=ASK, headers={"X-Forwarded-For": "9.9.9.9, 10.0.0.1"})
    assert other.status_code == 200
    limits[0] += 61
    assert client.post("/ask", json=ASK).status_code == 200


def test_scout_limited_only_with_request(client, limits):
    for _ in range(12):
        assert client.post("/scout", json={"member_id": SEEDED}).status_code == 200
    for _ in range(10):
        assert client.post("/scout", json={"member_id": SEEDED, "request": "welding"}).status_code == 200
    assert client.post("/scout", json={"member_id": SEEDED, "request": "welding"}).status_code == 429


def test_admin_key_bypasses_per_ip_limit(client, limits, keyed):
    for _ in range(12):
        assert client.post("/ask", json=ASK, headers=ADMIN).status_code == 200


def test_global_cap_applies_even_to_admin(client, limits, keyed, monkeypatch):
    monkeypatch.setenv("WARMINTRO_HOURLY_LLM_CAP", "3")
    for i in range(3):
        assert client.post("/ask", json=ASK, headers={**ADMIN, "X-Forwarded-For": f"1.1.1.{i}"}).status_code == 200
    r = client.post("/ask", json=ASK, headers=ADMIN)
    assert r.status_code == 429 and "Retry-After" in r.headers
    limits[0] += 3601
    assert client.post("/ask", json=ASK, headers=ADMIN).status_code == 200


def test_round_minimum_interval(client, limits):
    assert client.post("/round", json={"max_meetings": 1}).status_code == 200
    r = client.post("/round", json={"max_meetings": 1})
    assert r.status_code == 429 and r.headers["Retry-After"] == "60"
    limits[0] += 61
    assert client.post("/round", json={"max_meetings": 1}).status_code == 200


def test_admin_reset_restores_demo_state(client, keyed):
    before = client.get(f"/members/{SEEDED}").json()["member"]
    weights_path = guard.get_settings().data_dir / "weights.json"
    weights_before = weights_path.read_text()
    client.patch(f"/members/{SEEDED}", json={"paused": True, "needs": ["something else"]}, headers=ADMIN)
    weights_path.write_text('{"tampered": 1.0}')
    user_id = make_user(client)
    assert client.post("/admin/reset").status_code == 403
    assert client.post("/admin/reset", headers=ADMIN).json() == {"ok": True}
    assert client.get(f"/members/{SEEDED}").json()["member"] == before
    assert weights_path.read_text() == weights_before
    assert client.get(f"/members/{user_id}").status_code == 404


def test_cors_preflight_allows_admin_key(client):
    r = client.options("/members/m001", headers={
        "Origin": "https://sohum-kapoor.github.io", "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "x-admin-key,content-type",
    })
    assert r.status_code == 200
    assert "x-admin-key" in r.headers["access-control-allow-headers"].lower()
    got = client.get("/health", headers={"Origin": "https://sohum-kapoor.github.io"})
    assert "Retry-After" in got.headers["access-control-expose-headers"]
