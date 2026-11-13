import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from warmintro import api, store
from warmintro.llm import get_llm
from warmintro.resources import suggest
from warmintro.round import run_round

FIXTURE = Path(__file__).parent / "fixtures" / "resources.json"


@pytest.fixture
def res_data(data_copy):
    shutil.copyfile(FIXTURE, data_copy / "resources.json")
    return data_copy


def _member(**kw):
    base = {"id": "mx", "type": "startup", "hub": "detroit", "needs": ["seed funding for startups"]}
    return {**base, **kw}


def _resources():
    return json.loads(FIXTURE.read_text())["resources"]


def test_suggest_filters_sorts_and_caps():
    out = suggest(_member(), _resources(), get_llm(), k=1)
    assert [s["resource_id"] for s in out] == ["t1"]
    both = suggest(_member(), _resources(), get_llm(), k=5)
    assert [s["resource_id"] for s in both] == ["t1", "t2"]  # only startup-serving, nothing below the minimum
    assert both[0]["for_need"] == "seed funding for startups" and both[0]["matched"] == "seed funding for startups"
    assert set(both[0]) == {"resource_id", "name", "url", "hub", "category", "for_need", "matched", "similarity"}
    assert all(s["similarity"] >= 0.2 for s in both)


def test_hub_breaks_a_tie():
    assert suggest(_member(hub="ann_arbor"), _resources(), get_llm())[0]["resource_id"] == "t2"
    assert suggest(_member(hub="detroit"), _resources(), get_llm())[0]["resource_id"] == "t1"


def test_unrelated_need_gets_nothing():
    assert suggest(_member(needs=["zzz qqq"]), _resources(), get_llm()) == []


def test_load_resources_missing_file(data_copy):
    (data_copy / "resources.json").unlink(missing_ok=True)
    assert store.load_resources() == []
    assert store.load_resources_doc()["resources"] == []


def test_run_log_has_resource_suggestions(res_data):
    run = run_round(["m001", "m002", "m003", "m004"], max_meetings=2)
    sugg = run["resource_suggestions"]
    in_meetings = {i for m in run["meetings"] for i in (m["a"], m["b"])}
    assert set(sugg) == in_meetings and all(isinstance(v, list) for v in sugg.values())


def test_run_log_empty_without_resources(data_copy):
    (data_copy / "resources.json").unlink(missing_ok=True)
    assert run_round(["m001", "m002", "m003", "m004"], max_meetings=2)["resource_suggestions"] == {}


def test_endpoints(res_data):
    client = TestClient(api.app)
    body = client.get("/resources").json()
    assert body["synthetic"] is False and len(body["resources"]) == 4
    first = store.load_members()[0]
    ok = client.get(f"/members/{first['id']}/resources")
    assert ok.status_code == 200 and isinstance(ok.json()["suggestions"], list)
    assert client.get("/members/nope/resources").status_code == 404
