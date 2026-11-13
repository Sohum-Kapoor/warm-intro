import pytest
from fastapi.testclient import TestClient

from warmintro import onboard
from warmintro.api import app
from warmintro.llm import MockLLM

ABOUT = (
    "I run a small furniture workshop in Grand Rapids. We need help automating our finishing line. "
    "We can offer floor space for pilots and prototype runs. We won't do unpaid trials."
)
BODY = {"name": "Birch & Co", "type": "small_business", "hub": "grand_rapids", "about": ABOUT}


@pytest.fixture
def client(data_copy):
    return TestClient(app)


def test_draft_extracts_needs_offers_and_deal_breakers(client):
    r = client.post("/onboard/draft", json=BODY)
    assert r.status_code == 200
    out = r.json()
    assert out["synthetic"] is False and out["ai_generated"] is True
    d = out["draft"]
    assert d["needs"] and d["offers"] and d["deal_breakers"] == ["We won't do unpaid trials"]
    assert (d["name"], d["type"], d["hub"], d["intro_budget"]) == ("Birch & Co", "small_business", "grand_rapids", 2)
    assert all(d["permissions"].values()) and d["sector"] and d["description"]


@pytest.mark.parametrize(
    "change",
    [
        {"name": ""}, {"name": "x" * 81}, {"type": "alien"}, {"hub": "mars"},
        {"about": "too short"}, {"about": "x" * 1201},
    ],
)  # fmt: skip
def test_draft_validation_errors(client, change):
    r = client.post("/onboard/draft", json={**BODY, **change})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)


def test_draft_unreadable_text_is_422_with_friendly_message(client):
    r = client.post("/onboard/draft", json={**BODY, "about": "Hello there, nice weather in town today."})
    assert r.status_code == 422 and r.json()["detail"] == onboard.UNREADABLE


def test_draft_retries_once_then_succeeds():
    replies = iter(["sorry, no JSON", '{"sector": "furniture", "description": "Birch makes chairs.", '
                    '"needs": ["finishing help"], "offers": ["floor space"], "deal_breakers": []}'])

    class Flaky(MockLLM):
        def chat(self, system, messages, json_mode=False):
            return next(replies)

    assert onboard.draft_profile(BODY, Flaky())["needs"] == ["finishing help"]


def _draft(client):
    return client.post("/onboard/draft", json=BODY).json()["draft"]


def test_create_persists_with_next_id_and_user_created(client):
    r = client.post("/onboard", json=_draft(client))
    assert r.status_code == 200
    out = r.json()
    assert out["synthetic"] is False and isinstance(out["first_matches"], list)
    member = out["member"]
    assert member["id"] == "m061" and member["user_created"] is True
    got = client.get("/members/m061").json()["member"]
    assert got["name"] == "Birch & Co" and got["user_created"] is True
    assert "m061" in [m["id"] for m in client.get("/members").json()["members"]]


def test_create_twice_gives_distinct_ids(client):
    ids = {client.post("/onboard", json=_draft(client)).json()["member"]["id"] for _ in range(2)}
    assert ids == {"m061", "m062"}


def test_create_validates_like_patch(client):
    d = _draft(client)
    for change in ({"needs": []}, {"offers": ["x" * 161]}, {"needs": [""]}, {"intro_budget": 9}, {"hub": "mars"}):
        r = client.post("/onboard", json={**d, **change})
        assert r.status_code == 422 and isinstance(r.json()["detail"], str), change
    assert client.post("/onboard", json={k: v for k, v in d.items() if k != "description"}).status_code == 422
    assert len(client.get("/members").json()["members"]) == 60
