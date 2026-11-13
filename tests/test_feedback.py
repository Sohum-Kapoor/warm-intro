import pytest

from warmintro.config import WEIGHT_MAX, WEIGHT_MIN
from warmintro.feedback import DECLINE_STEP, OUTCOME_STEP, derive_weights, nudge, outcome_delta


def conn(cid: str, outcome: str, date: str, kind: str = "individual-startup", label: str = "complementary"):
    return {"id": cid, "a": "m001", "b": "m002", "kind": kind, "label": label,
            "cross_hub": False, "outcome": outcome, "date": date}


def test_nudge_missing_key_starts_at_one():
    assert nudge({}, "k|complementary", 0.1) == {"k|complementary": 1.1}


def test_nudge_clamps_both_ends():
    assert nudge({"k": 1.48}, "k", 0.5)["k"] == WEIGHT_MAX
    assert nudge({"k": 0.52}, "k", -0.5)["k"] == WEIGHT_MIN


def test_nudge_rounds_and_does_not_mutate():
    original = {"k": 1.0, "other": 1.2}
    result = nudge(original, "k", 0.123456)
    assert original == {"k": 1.0, "other": 1.2}
    assert result == {"k": 1.1235, "other": 1.2}


def test_outcome_delta_each_outcome():
    for outcome in ("pilot", "hire", "partnership"):
        assert outcome_delta(outcome) == OUTCOME_STEP
    assert outcome_delta("no_follow_up") == -OUTCOME_STEP
    assert 0 < DECLINE_STEP < OUTCOME_STEP


def test_outcome_delta_unknown_raises():
    with pytest.raises(ValueError):
        outcome_delta("ghosted")


def test_derive_weights_empty_history():
    assert derive_weights([]) == {}


def test_derive_weights_applies_in_date_order():
    # Clamping makes order matter: 6 hires then 2 no-follow-ups vs the reverse.
    hires = [conn(f"h{i}", "hire", f"2026-03-0{i}") for i in range(1, 7)]
    misses = [conn(f"h{i}", "no_follow_up", f"2026-04-0{i - 6}") for i in range(7, 9)]
    # list order is scrambled on purpose; dates decide
    result = derive_weights(misses + hires)
    assert result == {"individual-startup|complementary": 1.32}
    early_misses = [conn("h9", "no_follow_up", "2026-01-01"), conn("h10", "no_follow_up", "2026-01-02")]
    assert derive_weights(early_misses + hires) == {"individual-startup|complementary": 1.32}


def test_derive_weights_order_matters_at_clamp():
    many_hires = [conn(f"h{i:02d}", "hire", f"2026-02-{i:02d}") for i in range(1, 11)]
    late_miss = conn("h99", "no_follow_up", "2026-03-01")
    assert derive_weights(many_hires + [late_miss])["individual-startup|complementary"] == 1.42
    early_miss = conn("h99", "no_follow_up", "2026-01-01")
    assert derive_weights(many_hires + [early_miss])["individual-startup|complementary"] == 1.5
