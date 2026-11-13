import json
from copy import deepcopy

import pytest

from warmintro import store
from warmintro.llm import MockLLM
from warmintro.meeting import DEFAULT_VOTE_REASON, build_system, parse_vote, run_meeting

DATA = json.loads((store.get_settings().data_dir / "demo.json").read_text())
MEMBERS = {m["id"]: m for m in store.load_members()}


class Recorder:
    """Delegates to MockLLM and records every system prompt with its task."""

    def __init__(self):
        self.inner = MockLLM()
        self.calls: list[tuple[str, str]] = []  # (system, json-or-text)

    def embed(self, texts):
        return self.inner.embed(texts)

    def chat(self, system, messages, json_mode=False):
        self.calls.append((system, "json" if json_mode else "text"))
        return self.inner.chat(system, messages, json_mode)


class Scripted:
    """Mock for speak/introduce; votes come from a scripted list."""

    def __init__(self, votes):
        self.inner = MockLLM()
        self.votes = list(votes)
        self.vote_calls = 0

    def embed(self, texts):
        return self.inner.embed(texts)

    def chat(self, system, messages, json_mode=False):
        if json_mode:
            self.vote_calls += 1
            return self.votes.pop(0)
        return self.inner.chat(system, messages, json_mode)


def yes_members():
    a_id, b_id = DATA["yes_pairs"][0]
    return a_id, b_id


def test_planted_no_pair_declines_naming_the_deal_breaker():
    a_id, b_id = DATA["no_pair"]
    m = run_meeting(a_id, b_id)
    assert m["result"] == "declined"
    assert m["introductions"] == []
    assert m["ai_generated"] is True
    no_reasons = [v["reason"].lower() for v in m["votes"].values() if v["vote"] == "no"]
    assert no_reasons
    breakers = [d.lower() for k in (a_id, b_id) for d in MEMBERS[k]["deal_breakers"]]
    assert any(d.rstrip(".") in r for r in no_reasons for d in breakers)


@pytest.mark.parametrize("pair", DATA["yes_pairs"])
def test_planted_yes_pairs_are_introduced(pair):
    a_id, b_id = pair
    m = run_meeting(a_id, b_id)
    assert m["result"] == "introduced"
    assert {v["vote"] for v in m["votes"].values()} == {"yes"}
    assert {i["to"] for i in m["introductions"]} == {a_id, b_id}
    for intro in m["introductions"]:
        other = b_id if intro["to"] == a_id else a_id
        assert MEMBERS[other]["name"] in intro["message"]
        assert intro["from_agent"] == f"agent:{intro['to']}"
        assert intro["ai_generated"] is True
        assert intro["meeting_id"] == m["id"]


def test_transcript_alternates_with_three_turns_each():
    a_id, b_id = yes_members()
    seen = []
    m = run_meeting(a_id, b_id, on_turn=seen.append)
    assert [(t["speaker"], t["turn"]) for t in m["transcript"]] == [
        (a_id, 1), (b_id, 1), (a_id, 2), (b_id, 2), (a_id, 3), (b_id, 3),
    ]
    assert seen == m["transcript"]


def test_each_side_sees_only_its_own_profile():
    a_id, b_id = yes_members()
    rec = Recorder()
    run_meeting(a_id, b_id, llm=rec)
    assert rec.calls
    for system, _ in rec.calls:
        own, other = (MEMBERS[a_id], MEMBERS[b_id]) if f'"id": "{a_id}"' in system else (MEMBERS[b_id], MEMBERS[a_id])
        assert own["description"] in system
        assert other["description"] not in system
        for text in other["needs"] + other["offers"] + other["deal_breakers"]:
            if text not in json.dumps(own):  # synthetic profiles may share a phrase
                assert text not in system
        # the counterpart's name appears only in task text and `counterpart_name`, never in the profile
        assert other["name"] not in system.split("Rules:")[0]


def test_closed_profile_prompt_forbids_sharing():
    member = deepcopy(MEMBERS[yes_members()[0]])
    member["permissions"]["share_profile"] = False
    other = MEMBERS[yes_members()[1]]
    assert "NOT agreed to share" in build_system(member, "speak", 2, 1, other)
    member["permissions"]["share_profile"] = True
    assert "NOT agreed to share" not in build_system(member, "speak", 2, 1, other)


def test_bad_json_twice_votes_no_with_default_reason():
    a_id, b_id = yes_members()
    llm = Scripted(["not json", "{oops", "still not", "nope"])
    m = run_meeting(a_id, b_id, llm=llm)
    assert m["result"] == "declined"
    assert all(v == {"vote": "no", "reason": DEFAULT_VOTE_REASON} for v in m["votes"].values())
    assert llm.vote_calls == 4


def test_bad_json_once_then_good_uses_the_good_vote():
    a_id, b_id = yes_members()
    good = '```json\n{"vote": "yes", "reason": "Clear fit. Extra sentence."}\n```'
    llm = Scripted(["garbage", good, good])
    m = run_meeting(a_id, b_id, llm=llm)
    assert m["votes"][a_id] == {"vote": "yes", "reason": "Clear fit."}
    assert m["votes"][b_id]["vote"] == "yes"
    assert m["result"] == "introduced"


def test_zero_budget_votes_no_without_calling_the_model():
    a_id, b_id = yes_members()
    rec = Recorder()
    m = run_meeting(a_id, b_id, budgets={a_id: 0}, llm=rec)
    assert m["votes"][a_id]["vote"] == "no"
    assert sum(1 for _, kind in rec.calls if kind == "json") == 1
    assert m["result"] == "declined"


def test_propose_meetings_false_blocks_the_meeting():
    a_id, b_id = yes_members()
    members = deepcopy(list(MEMBERS.values()))
    next(x for x in members if x["id"] == a_id)["permissions"]["propose_meetings"] = False
    rec = Recorder()
    m = run_meeting(a_id, b_id, members=members, llm=rec)
    assert m["result"] == "blocked_by_permissions"
    assert m["transcript"] == [] and m["introductions"] == []
    assert {v["vote"] for v in m["votes"].values()} == {"no"}
    assert rec.calls == []


def test_contact_member_false_gets_no_introduction():
    a_id, b_id = yes_members()
    members = deepcopy(list(MEMBERS.values()))
    next(x for x in members if x["id"] == a_id)["permissions"]["contact_member"] = False
    m = run_meeting(a_id, b_id, members=members)
    assert m["result"] == "introduced"
    assert [i["to"] for i in m["introductions"]] == [b_id]
    assert m["blocked"] == [a_id]


def test_ids_increment_and_meeting_is_stored():
    a_id, b_id = yes_members()
    first = run_meeting(a_id, b_id, candidate={"a": a_id})
    second = run_meeting(a_id, b_id)
    assert (first["id"], second["id"]) == ("mt001", "mt002")
    assert store.get_meeting("mt001")["candidate"] == {"a": a_id}
    assert store.get_meeting("mt002")["candidate"] == {}


def test_unknown_member_is_a_key_error():
    with pytest.raises(KeyError):
        run_meeting("m999", yes_members()[0])


def test_empty_reply_becomes_no_comment():
    class Quiet(Scripted):
        def chat(self, system, messages, json_mode=False):
            return super().chat(system, messages, True) if json_mode else "   "

    a_id, b_id = yes_members()
    m = run_meeting(a_id, b_id, llm=Quiet(['{"vote":"no","reason":"x"}'] * 2))
    assert {t["text"] for t in m["transcript"]} == {"(no comment)"}


def test_parse_vote_rejects_bad_shapes():
    assert parse_vote('{"vote": "maybe", "reason": "x"}') is None
    assert parse_vote('{"vote": "yes", "reason": "  "}') is None
    assert parse_vote("[1]") is None
    assert parse_vote('Sure: {"vote": "NO", "reason": "Too early"}') == {"vote": "no", "reason": "Too early"}
