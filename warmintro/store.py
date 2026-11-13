"""Contract types and all JSON file IO. Nothing else reads or writes data files."""

import json
import os
import tempfile
from pathlib import Path
from typing import Any, NotRequired, TypedDict

from warmintro.config import get_settings


class Permissions(TypedDict):
    share_profile: bool
    propose_meetings: bool
    contact_member: bool


class Member(TypedDict):
    id: str
    type: str
    name: str
    hub: str
    sector: str
    description: str
    needs: list[str]
    offers: list[str]
    deal_breakers: list[str]
    intro_budget: int
    permissions: Permissions
    demo: NotRequired[bool]


class Connection(TypedDict):
    id: str
    a: str
    b: str
    kind: str
    label: str
    cross_hub: bool
    outcome: str
    date: str


class Evidence(TypedDict):
    need_of: str
    need: str
    offer_of: str
    offer: str
    similarity: float


class Candidate(TypedDict):
    a: str
    b: str
    fit: float
    novelty: float
    weight: float
    cross_hub: bool
    score: float
    label: str
    evidence: list[Evidence]


class Turn(TypedDict):
    speaker: str
    turn: int
    text: str


class Vote(TypedDict):
    vote: str
    reason: str


class Meeting(TypedDict):
    id: str
    a: str
    b: str
    candidate: Candidate
    transcript: list[Turn]
    votes: dict[str, Vote]
    result: str
    ai_generated: bool


class Introduction(TypedDict):
    meeting_id: str
    to: str
    from_agent: str
    message: str
    ai_generated: bool


class Run(TypedDict):
    synthetic: bool
    run_id: str
    mode: str
    request: str | None
    status: str
    stats: dict[str, int]
    members: list[dict[str, Any]]
    candidates: list[Candidate]
    meetings: list[Meeting]
    introductions: list[Introduction]
    weights_before: dict[str, float]
    weights_after: dict[str, float]
    ai_generated: bool


def _write_json(path: Path, payload: Any) -> None:
    """Atomic write: the web page polls these files while a round runs."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(payload, f, indent=2)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def _read_json(path: Path) -> Any:
    with path.open() as f:
        return json.load(f)


def _read_data(name: str) -> Any:
    path = get_settings().data_dir / name
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing; run `make data` first")
    return _read_json(path)


def load_members() -> list[Member]:
    return _read_data("profiles.json")["members"]


def load_history() -> list[Connection]:
    return _read_data("history.json")["connections"]


def load_weights() -> dict[str, float]:
    path = get_settings().data_dir / "weights.json"
    return _read_json(path) if path.exists() else {}


def save_weights(weights: dict[str, float]) -> None:
    _write_json(get_settings().data_dir / "weights.json", weights)


def kind_of(a: Member, b: Member) -> str:
    return "-".join(sorted((a["type"], b["type"])))


def weight_key(kind: str, label: str) -> str:
    return f"{kind}|{label}"


def _meetings_path() -> Path:
    return get_settings().runs_dir / "meetings.json"


def _load_meetings() -> dict[str, Meeting]:
    path = _meetings_path()
    return _read_json(path)["meetings"] if path.exists() else {}


def next_meeting_id() -> str:
    numbers = [int(i[2:]) for i in _load_meetings() if i[2:].isdigit()]
    return f"mt{max(numbers, default=0) + 1:03d}"


def save_meeting(meeting: Meeting) -> None:
    meetings = _load_meetings()
    meetings[meeting["id"]] = meeting
    _write_json(_meetings_path(), {"synthetic": True, "meetings": meetings})


def get_meeting(meeting_id: str) -> Meeting | None:
    return _load_meetings().get(meeting_id)


def save_run(run: Run) -> None:
    runs_dir = get_settings().runs_dir
    _write_json(runs_dir / f"{run['run_id']}.json", run)
    _write_json(runs_dir / "latest.json", run)


def load_latest_run() -> Run | None:
    path = get_settings().runs_dir / "latest.json"
    return _read_json(path) if path.exists() else None
