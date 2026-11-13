import json

import pytest
from fastapi.testclient import TestClient

from warmintro import api, scout, store
from warmintro.llm import get_llm

ORIGIN = "https://sohum-kapoor.github.io"


@pytest.fixture
def client(data_copy):
    return TestClient(api.app)


def _patch(client, body, member="m001"):
    return client.patch(f"/members/{member}", json=body)


def test_get_member(client):
    body = client.get("/members/m001").json()
    assert body["synthetic"] is True and body["member"]["id"] == "m001"
    assert client.get("/members/nope").status_code == 404


def test_patch_happy_path_persists(client, data_copy):
    r = _patch(client, {"needs": ["  a new need "], "intro_budget": 4, "paused": True,
                        "permissions": {"contact_member": False}, "description": "Short."})
    assert r.status_code == 200
    m = r.json()["member"]
    assert m["needs"] == ["a new need"] and m["intro_budget"] == 4 and m["paused"] is True
    assert m["permissions"]["contact_member"] is False and m["permissions"]["propose_meetings"] in (True, False)
    doc = json.loads((data_copy / "profiles.json").read_text())
    assert doc["synthetic"] is True and len(doc["members"]) == 60
    assert client.get("/members/m001").json()["member"] == m
    assert store.load_members()[0] == m
    assert not list(data_copy.glob(".profiles.json.*"))


@pytest.mark.parametrize("body, text", [
    ({"needs": [""]}, "non-empty"),
    ({"offers": ["  "]}, "non-empty"),
    ({"deal_breakers": ["x" * 161]}, "160"),
    ({"needs": ["a"] * 7}, "at most 6"),
    ({"needs": "text"}, "list"),
    ({"description": "x" * 401}, "400"),
    ({"intro_budget": 6}, "0 to 5"),
    ({"intro_budget": -1}, "0 to 5"),
    ({"intro_budget": True}, "0 to 5"),
    ({"intro_budget": 2.5}, "0 to 5"),
    ({"paused": "yes"}, "paused"),
    ({"permissions": {"nope": True}}, "permissions"),
    ({"permissions": {"share_profile": "no"}}, "permissions"),
    ({"name": "Other"}, "cannot edit: name"),
])
def test_patch_rejects_bad_input(client, body, text):
    before = client.get("/members/m001").json()
    r = _patch(client, body)
    assert r.status_code == 422 and text in r.json()["detail"]
    assert client.get("/members/m001").json() == before


def test_patch_unknown_member(client):
    assert _patch(client, {"paused": True}, "nope").status_code == 404


def test_paused_member_is_not_scouted_but_can_ask(client):
    members = store.load_members()
    weights = {}
    pair = scout.score_pairs(members, weights, get_llm())[0][0]
    target = pair["a"]
    _patch(client, {"paused": True}, target)
    members = store.load_members()
    after, _ = scout.score_pairs(members, weights, get_llm())
    assert all(target not in (c["a"], c["b"]) for c in after)
    # as an ask-mode candidate
    asker = next(m for m in members if m["id"] != target and m["permissions"]["propose_meetings"])
    need = next(m for m in store.load_members() if m["id"] == target)["offers"][0]
    found = scout.scout(asker["id"], need, 50)
    assert all(c["b"] != target for c in found)
    # the paused member can still ask
    own = scout.scout(target, store.load_members()[0]["offers"][0], 5, members=members)
    assert isinstance(own, list)
    assert client.post("/ask", json={"member_id": target, "request": need, "meet": False}).status_code == 200


def _ask_for(client, member_id):
    for m in store.load_members():
        if m["id"] != member_id and m["permissions"]["propose_meetings"] and m["offers"]:
            r = client.post("/ask", json={"member_id": member_id, "request": m["offers"][0]})
            if r.json()["meeting"]:
                return r.json()
    raise AssertionError("no ask produced a meeting")


def test_ask_holds_meeting_and_activity_reflects_it(client):
    asker = "m001"
    assert client.get(f"/members/{asker}/activity").json()["stats"]["meetings"] == 0
    first = _ask_for(client, asker)
    assert first["ai_generated"] is True and first["candidates"] and first["meeting"]["id"] == "mt001"
    assert first["meeting"]["a"] == asker and "introductions" in first["meeting"]
    second = _ask_for(client, asker)
    act = client.get(f"/members/{asker}/activity").json()
    assert act["ai_generated"] is True and act["synthetic"] is True and act["member_id"] == asker
    assert [m["id"] for m in act["meetings"]] == [second["meeting"]["id"], first["meeting"]["id"]]
    mt = act["meetings"][1]
    assert mt["my_vote"] == first["meeting"]["votes"][asker]
    other = first["meeting"]["b"]
    assert mt["their_vote"] == first["meeting"]["votes"][other]
    assert mt["counterpart"]["id"] == other and set(mt["counterpart"]) == {"id", "name", "type", "hub", "sector"}
    assert mt["transcript"] and mt["candidate"] and mt["created_at"]
    votes = [m["my_vote"]["vote"] for m in act["meetings"]]
    s = act["stats"]
    assert s["meetings"] == 2 and s["yes_votes"] == votes.count("yes") and s["no_votes"] == votes.count("no")
    assert s["agents_met"] == len({m["counterpart"]["id"] for m in act["meetings"]})
    assert s["introductions"] == len(act["introductions"])
    assert all(i["to"] == asker and i["meeting_id"] and i["counterpart"] for i in act["introductions"])
    # the counterpart sees the same meeting from the other side
    theirs = client.get(f"/members/{other}/activity").json()["meetings"][-1]
    assert theirs["counterpart"]["id"] == asker and theirs["my_vote"] == mt["their_vote"]
    assert client.get("/members/nope/activity").status_code == 404


def test_ask_without_meet_holds_no_meeting(client):
    m = next(m for m in store.load_members() if m["id"] != "m001" and m["offers"])
    body = client.post("/ask", json={"member_id": "m001", "request": m["offers"][0], "meet": False}).json()
    assert body["candidates"] and body["meeting"] is None
    assert client.get("/members/m001/activity").json()["stats"]["meetings"] == 0


def test_ask_with_no_candidate_returns_note(client, monkeypatch):
    monkeypatch.setenv("FIT_THRESHOLD", "1.5")
    body = client.post("/ask", json={"member_id": "m001", "request": "a machine vision partner"}).json()
    assert body["candidates"] == [] and body["meeting"] is None and "strong enough fit" in body["note"]


def test_ask_validation(client):
    assert client.post("/ask", json={"member_id": "m001", "request": ""}).status_code == 422
    assert client.post("/ask", json={"member_id": "m001", "request": "x" * 301}).status_code == 422
    assert client.post("/ask", json={"member_id": "nope", "request": "hi"}).status_code == 404


def test_cors_for_hosted_app(client):
    r = client.get("/members/m001", headers={"Origin": ORIGIN})
    assert r.headers["access-control-allow-origin"] == ORIGIN
    pre = client.options("/members/m001", headers={
        "Origin": ORIGIN, "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "content-type"})
    assert pre.status_code == 200 and pre.headers["access-control-allow-origin"] == ORIGIN
    assert "PATCH" in pre.headers["access-control-allow-methods"]
    assert client.get("/members/m001", headers={"Origin": "http://localhost:5173"}).headers[
        "access-control-allow-origin"] == "http://localhost:5173"
