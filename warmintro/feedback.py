"""Learning loop: outcomes nudge the per kind|label weights (pure part)."""

from warmintro.config import WEIGHT_MAX, WEIGHT_MIN
from warmintro.store import (
    Connection,
    Meeting,
    get_meeting,
    kind_of,
    load_members,
    load_weights,
    save_weights,
    weight_key,
)

POSITIVE_OUTCOMES = {"pilot", "hire", "partnership"}
OUTCOME_STEP = 0.08  # +step for a positive outcome, -step for "no_follow_up"
DECLINE_STEP = 0.02  # -step when a meeting ends in a no vote


def nudge(weights: dict[str, float], key: str, delta: float) -> dict[str, float]:
    """Return a new dict with `key` moved by `delta`, clamped and rounded."""
    updated = dict(weights)
    value = updated.get(key, 1.0) + delta
    updated[key] = round(min(WEIGHT_MAX, max(WEIGHT_MIN, value)), 4)
    return updated


def outcome_delta(outcome: str) -> float:
    if outcome in POSITIVE_OUTCOMES:
        return OUTCOME_STEP
    if outcome == "no_follow_up":
        return -OUTCOME_STEP
    raise ValueError(f"unknown outcome: {outcome!r}")


def derive_weights(history: list[Connection]) -> dict[str, float]:
    """Replay the history oldest first (ties by id) from neutral weights."""
    weights: dict[str, float] = {}
    for conn in sorted(history, key=lambda c: (c["date"], c["id"])):
        key = weight_key(conn["kind"], conn["label"])
        weights = nudge(weights, key, outcome_delta(conn["outcome"]))
    return weights


def _apply(meeting: Meeting, delta: float) -> dict:
    members = {m["id"]: m for m in load_members()}
    kind = kind_of(members[meeting["a"]], members[meeting["b"]])
    key = weight_key(kind, meeting["candidate"]["label"])
    before = load_weights()
    after = nudge(before, key, delta)
    save_weights(after)
    return {"weights_before": before, "weights_after": after, "key": key}


def record_outcome(meeting_id: str, outcome: str) -> dict:
    """Record a real-world outcome of an introduced meeting and nudge that kind|label weight."""
    delta = outcome_delta(outcome)
    meeting = get_meeting(meeting_id)
    if meeting is None:
        raise KeyError(f"unknown meeting id: {meeting_id!r}")
    return _apply(meeting, delta)


def record_decline(meeting: Meeting) -> dict:
    """A meeting that ended in a no vote nudges its kind|label weight down a little."""
    return _apply(meeting, -DECLINE_STEP)
