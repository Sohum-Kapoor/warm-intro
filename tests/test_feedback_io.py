import pytest

from warmintro.config import WEIGHT_MAX, WEIGHT_MIN
from warmintro.feedback import DECLINE_STEP, OUTCOME_STEP, record_decline, record_outcome
from warmintro.llm import MockLLM
from warmintro.scout import score_pairs
from warmintro.store import kind_of, load_members, load_weights, save_meeting


@pytest.fixture
def setup(data_copy):
    members = load_members()
    by_id = {m["id"]: m for m in members}
    candidates, _ = score_pairs(members, load_weights(), MockLLM())
    top = candidates[0]
    meeting = {
        "id": "mt001", "a": top["a"], "b": top["b"], "candidate": top, "transcript": [],
        "votes": {}, "result": "introduced", "ai_generated": True,
    }
    save_meeting(meeting)
    key = f"{kind_of(by_id[top['a']], by_id[top['b']])}|{top['label']}"
    return members, top, meeting, key


def _rank(members, top):
    candidates, _ = score_pairs(members, load_weights(), MockLLM())
    return next(i for i, c in enumerate(candidates) if {c["a"], c["b"]} == {top["a"], top["b"]}), candidates


def test_outcome_changes_next_scout_ranking(data_copy):
    members = load_members()
    by_id = {m["id"]: m for m in members}

    def key_of(c):
        return f"{kind_of(by_id[c['a']], by_id[c['b']])}|{c['label']}"

    candidates, _ = score_pairs(members, load_weights(), MockLLM())
    # Rank >= 1, different key than the pair above, and reachable within the weight clamp;
    # prefer the smallest score gap to the pair above.
    eligible = [
        (candidates[i - 1]["score"] - candidates[i]["score"], i)
        for i in range(1, len(candidates))
        if key_of(candidates[i]) != key_of(candidates[i - 1])
        and candidates[i]["score"] * WEIGHT_MAX / candidates[i]["weight"] > candidates[i - 1]["score"]
    ]
    assert eligible, "no candidate can overtake the pair above it with the current data"
    _, idx = min(eligible)
    target, above = candidates[idx], candidates[idx - 1]
    key = key_of(target)
    save_meeting({
        "id": "mt002", "a": target["a"], "b": target["b"], "candidate": target, "transcript": [],
        "votes": {}, "result": "introduced", "ai_generated": True,
    })

    before = load_weights().get(key, 1.0)
    rank = idx
    for _ in range(10):
        assert record_outcome("mt002", "pilot")["key"] == key
        rank, _ = _rank(members, target)
        if rank < idx or load_weights()[key] >= WEIGHT_MAX:
            break
    assert load_weights()[key] > before
    assert rank < idx
    assert _rank(members, above)[0] > rank


def test_positive_outcome_raises_weight(setup):
    _, _, _, key = setup
    before = load_weights().get(key, 1.0)
    result = record_outcome("mt001", "pilot")
    assert result["weights_before"].get(key, 1.0) == before
    assert result["weights_after"][key] == pytest.approx(before + OUTCOME_STEP)


def test_decline_lowers_weight(setup):
    _, _, meeting, key = setup
    before = load_weights().get(key, 1.0)
    result = record_decline(meeting)
    assert result["weights_after"][key] == pytest.approx(before - DECLINE_STEP)
    assert load_weights()[key] == pytest.approx(before - DECLINE_STEP)


def test_weight_is_clamped(setup):
    _, _, _, key = setup
    for _ in range(20):
        record_outcome("mt001", "no_follow_up")
    assert load_weights()[key] == WEIGHT_MIN


def test_unknown_meeting_and_outcome_raise(setup):
    with pytest.raises(KeyError):
        record_outcome("mt999", "pilot")
    with pytest.raises(ValueError):
        record_outcome("mt001", "bogus")
