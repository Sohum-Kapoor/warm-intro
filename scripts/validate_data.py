"""Validate synthetic data files against contracts (spec: scripts/VALIDATE_DATA_SPEC.md).

Usage:
    python scripts/validate_data.py [--data-dir DIR]

Exit 0 when no errors (warnings are allowed). Exit 1 on any error.
"""

import argparse
import datetime
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

@dataclass
class Problem:
    level: str   # "error" | "warn"
    file: str    # basename, e.g. "profiles.json"
    message: str


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MEMBER_TYPES = {"individual", "startup", "small_business", "corporation"}
HUBS = {"detroit", "grand_rapids", "ann_arbor"}
LABELS = {"complementary", "unexpected"}
OUTCOMES = {"pilot", "hire", "partnership", "no_follow_up"}
MEMBER_KEYS = {"id", "type", "name", "hub", "sector", "description",
               "needs", "offers", "deal_breakers", "intro_budget", "permissions"}
PERMISSION_KEYS = {"share_profile", "propose_meetings", "contact_member"}
CONNECTION_KEYS = {"id", "a", "b", "kind", "label", "cross_hub", "outcome", "date"}

# 15 Michigan denylist phrases (checked whole-word, case-insensitive)
DENYLIST = [
    "Ford", "General Motors", "Chrysler", "Dow", "Herman Miller", "Steelcase",
    "Meijer", "Whirlpool", "Kellogg", "Little Caesars", "Gordon Food", "Amway",
    "Michigan Medicine", "University of Michigan", "Michigan State",
]

# Regex: email
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Regex: phone — 10-digit US with optional separators, or international +N{8+}
_PHONE_RE = re.compile(
    r"(?:"
    r"\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}"   # 10-digit US
    r"|"
    r"\+\d[\d\s\-]{7,}"                           # international +N...
    r")"
)

# Regex: individual name — "FirstName L." (hyphens/apostrophes allowed in first)
_INDIV_NAME_RE = re.compile(r"^[A-Z][A-Za-z\-']+\s[A-Z]\.$")

# Regex: date format YYYY-MM-DD
_DATE_FMT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _err(problems: list[Problem], fname: str, msg: str) -> None:
    problems.append(Problem("error", fname, msg))


def _warn(problems: list[Problem], fname: str, msg: str) -> None:
    problems.append(Problem("warn", fname, msg))


def _load_json(data_dir: Path, fname: str, problems: list[Problem]):
    """Load and parse a JSON file. Returns parsed object or None on failure."""
    path = data_dir / fname
    if not path.exists():
        _err(problems, fname, f"{fname} not found")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        _err(problems, fname, f"JSON parse error: {exc}")
        return None


def _check_string_values(data, fname: str, problems: list[Problem]) -> None:
    """Walk any JSON value recursively; warn on email or phone strings."""
    if isinstance(data, str):
        if _EMAIL_RE.search(data):
            _warn(problems, fname, f"email address found: {data!r}")
        elif _PHONE_RE.search(data):
            _warn(problems, fname, f"phone number found: {data!r}")
    elif isinstance(data, dict):
        for v in data.values():
            _check_string_values(v, fname, problems)
    elif isinstance(data, list):
        for item in data:
            _check_string_values(item, fname, problems)


# ---------------------------------------------------------------------------
# Per-file validators
# ---------------------------------------------------------------------------

def _validate_profiles(data, problems: list[Problem]) -> dict[str, dict] | None:
    """Validate profiles.json. Returns {id: member} map on success, or None."""
    fname = "profiles.json"

    # Rule 2: synthetic flag
    if data.get("synthetic") is not True:
        _err(problems, fname, "missing or false 'synthetic' flag")

    # Rule 3: members list
    if not isinstance(data.get("members"), list):
        _err(problems, fname, "'members' must be a list")
        return None

    members: dict[str, dict] = {}
    seen_ids: set[str] = set()

    for i, m in enumerate(data["members"]):
        prefix = f"member[{i}]"

        # Rule 4: required keys
        missing = MEMBER_KEYS - set(m.keys()) if isinstance(m, dict) else MEMBER_KEYS
        if missing:
            _err(problems, fname, f"{prefix}: missing keys {sorted(missing)}")
            continue

        mid = m["id"]

        # Rule 10: unique ids
        if mid in seen_ids:
            _err(problems, fname, f"duplicate member id {mid!r}")
        else:
            seen_ids.add(mid)

        # Rule 5: type enum
        if m["type"] not in MEMBER_TYPES:
            _err(problems, fname, f"{prefix} {mid!r}: invalid type {m['type']!r}")

        # Rule 5: hub enum
        if m["hub"] not in HUBS:
            _err(problems, fname, f"{prefix} {mid!r}: invalid hub {m['hub']!r}")

        # Rule 6: non-empty strings
        for field in ("id", "name", "sector", "description"):
            if not isinstance(m[field], str) or not m[field]:
                _err(problems, fname, f"{prefix}: '{field}' must be a non-empty string")

        # Rule 7: needs/offers non-empty lists; deal_breakers list
        for field in ("needs", "offers"):
            val = m[field]
            if not isinstance(val, list) or len(val) == 0:
                _err(problems, fname, f"{prefix}: '{field}' must be a non-empty list of strings")
        if not isinstance(m["deal_breakers"], list):
            _err(problems, fname, f"{prefix}: 'deal_breakers' must be a list")

        # Rule 8: intro_budget is int (not bool) >= 0
        ib = m["intro_budget"]
        if isinstance(ib, bool) or not isinstance(ib, int) or ib < 0:
            _err(problems, fname, f"{prefix}: 'intro_budget' must be a non-negative int (got {ib!r})")

        # Rule 9: permissions
        perms = m["permissions"]
        if not isinstance(perms, dict):
            _err(problems, fname, f"{prefix}: 'permissions' must be an object")
        else:
            missing_p = PERMISSION_KEYS - set(perms.keys())
            if missing_p:
                _err(problems, fname, f"{prefix}: 'permissions' missing keys {sorted(missing_p)}")
            for pk, pv in perms.items():
                if not isinstance(pv, bool):
                    _err(problems, fname, f"{prefix}: 'permissions.{pk}' must be boolean")

        members[mid] = m

    # Rule 21: individual name format
    for mid, m in members.items():
        if m["type"] == "individual":
            name = m.get("name", "")
            if not _INDIV_NAME_RE.match(name):
                _warn(problems, fname, f"individual name not 'First L.' style: {name!r}")

    # Rule 22: denylist for non-individual orgs
    for mid, m in members.items():
        if m["type"] != "individual":
            name = m.get("name", "")
            for phrase in DENYLIST:
                # Whole-word match, case-insensitive
                pattern = r"(?<![A-Za-z])" + re.escape(phrase) + r"(?![A-Za-z])"
                if re.search(pattern, name, re.IGNORECASE):
                    _warn(problems, fname, f"name {name!r} contains denylist phrase {phrase!r}")
                    break  # one warning per member

    # Rule 20: scan all string values for email / phone
    _check_string_values(data["members"], fname, problems)

    return members


def _validate_history(data, member_map: dict[str, dict] | None,
                      problems: list[Problem]) -> None:
    fname = "history.json"

    # Rule 2: synthetic flag
    if data.get("synthetic") is not True:
        _err(problems, fname, "missing or false 'synthetic' flag")

    # Rule 3: connections list
    if not isinstance(data.get("connections"), list):
        _err(problems, fname, "'connections' must be a list")
        return

    seen_ids: set[str] = set()

    for i, c in enumerate(data["connections"]):
        prefix = f"connection[{i}]"

        # Rule 11: required keys
        if not isinstance(c, dict):
            _err(problems, fname, f"{prefix}: must be an object")
            continue
        missing = CONNECTION_KEYS - set(c.keys())
        if missing:
            _err(problems, fname, f"{prefix}: missing keys {sorted(missing)}")
            continue

        cid = c["id"]

        # Rule 11: unique ids
        if cid in seen_ids:
            _err(problems, fname, f"duplicate connection id {cid!r}")
        else:
            seen_ids.add(cid)

        a_id, b_id = c["a"], c["b"]

        # Rule 12: a != b
        if a_id == b_id:
            _err(problems, fname, f"{prefix}: a and b must be different ({a_id!r})")

        # Rule 12: existing member ids (only when profiles parsed)
        if member_map is not None:
            if a_id not in member_map:
                _err(problems, fname, f"{prefix}: unknown member id {a_id!r}")
            if b_id not in member_map:
                _err(problems, fname, f"{prefix}: unknown member id {b_id!r}")

            # Rule 13: kind must equal sorted types joined with '-'
            if a_id in member_map and b_id in member_map:
                type_a = member_map[a_id]["type"]
                type_b = member_map[b_id]["type"]
                expected_kind = "-".join(sorted([type_a, type_b]))
                if c["kind"] != expected_kind:
                    _err(problems, fname,
                         f"{prefix}: kind {c['kind']!r} expected {expected_kind!r}")

                # Rule 15: cross_hub
                hub_a = member_map[a_id]["hub"]
                hub_b = member_map[b_id]["hub"]
                expected_cross = hub_a != hub_b
                if c["cross_hub"] != expected_cross:
                    _err(problems, fname,
                         f"{prefix}: cross_hub {c['cross_hub']!r} expected {expected_cross!r}")

        # Rule 14: label enum
        if c["label"] not in LABELS:
            _err(problems, fname, f"{prefix}: invalid label {c['label']!r}")

        # Rule 14: outcome enum
        if c["outcome"] not in OUTCOMES:
            _err(problems, fname, f"{prefix}: invalid outcome {c['outcome']!r}")

        # Rule 16: date format and validity
        date_str = c["date"]
        if not _DATE_FMT_RE.match(str(date_str)):
            _err(problems, fname, f"{prefix}: date {date_str!r} not in YYYY-MM-DD format")
        else:
            try:
                datetime.date.fromisoformat(date_str)
            except ValueError:
                _err(problems, fname, f"{prefix}: date {date_str!r} is not a real calendar date")

    # Rule 20: scan all string values for email / phone
    _check_string_values(data["connections"], fname, problems)


def _validate_weights(data, problems: list[Problem]) -> None:
    fname = "weights.json"

    # Rule 3: must be a JSON object
    if not isinstance(data, dict):
        _err(problems, fname, "weights.json must be a JSON object")
        return

    for key, value in data.items():
        # Rule 17: key format kind|label
        if "|" not in key:
            _err(problems, fname, f"key {key!r}: missing '|' separator")
            continue

        kind, label = key.split("|", 1)

        # Rule 17: label must be complementary or unexpected
        if label not in LABELS:
            _err(problems, fname, f"key {key!r}: invalid label {label!r}")

        # Rule 17: kind must be two member types sorted alphabetically joined with '-'
        parts = kind.split("-", 1)
        if len(parts) != 2 or parts[0] not in MEMBER_TYPES or parts[1] not in MEMBER_TYPES:
            _err(problems, fname, f"key {key!r}: kind {kind!r} must be two member types joined with '-'")
        else:
            if parts[0] > parts[1]:
                _err(problems, fname, f"key {key!r}: kind {kind!r} types must be in alphabetical order")

        # Rule 18: value is a number (not bool) in [0.5, 1.5]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            _err(problems, fname, f"key {key!r}: value must be a number, got {value!r}")
        elif not (0.5 <= value <= 1.5):
            _err(problems, fname, f"key {key!r}: value {value} out of range [0.5, 1.5]")


def _validate_demo(data, member_map: dict[str, dict] | None,
                   problems: list[Problem]) -> None:
    """Rule 19: walk demo.json recursively and check member id references."""
    fname = "demo.json"

    if member_map is None:
        return  # can't check without profiles

    def _walk(node, in_member_ids_list: bool = False) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("a", "b", "member_id") and isinstance(v, str):
                    if v not in member_map:
                        _err(problems, fname, f"unknown member id {v!r}")
                elif k == "member_ids" and isinstance(v, list):
                    for item in v:
                        if isinstance(item, str) and item not in member_map:
                            _err(problems, fname, f"unknown member id {item!r}")
                        else:
                            _walk(item)
                else:
                    _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item, in_member_ids_list)

    _walk(data)

    # Rule 20: scan strings for email / phone
    _check_string_values(data, fname, problems)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def validate(data_dir: Path) -> list[Problem]:
    problems: list[Problem] = []

    # Rule 1: load the three required files
    profiles_data = _load_json(data_dir, "profiles.json", problems)
    history_data = _load_json(data_dir, "history.json", problems)
    weights_data = _load_json(data_dir, "weights.json", problems)

    # Validate profiles (also builds member_map)
    member_map: dict[str, dict] | None = None
    if profiles_data is not None:
        member_map = _validate_profiles(profiles_data, problems)

    # Validate history
    if history_data is not None:
        _validate_history(history_data, member_map, problems)

    # Validate weights
    if weights_data is not None:
        _validate_weights(weights_data, problems)

    # Rule 19: optional demo.json
    demo_path = data_dir / "demo.json"
    if demo_path.exists():
        demo_data = _load_json(data_dir, "demo.json", problems)
        if demo_data is not None:
            _validate_demo(demo_data, member_map, problems)

    return problems


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Validate warm-intro synthetic data files.")
    parser.add_argument(
        "--data-dir",
        default="data",
        help="Directory containing profiles.json, history.json, weights.json (default: data/)",
    )
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    problems = validate(data_dir)

    n_errors = sum(1 for p in problems if p.level == "error")
    n_warns = sum(1 for p in problems if p.level == "warn")

    for p in problems:
        tag = "ERROR" if p.level == "error" else "WARN"
        print(f"{tag} {p.file}: {p.message}")

    print(f"{n_errors} errors, {n_warns} warnings")
    sys.exit(1 if n_errors > 0 else 0)


if __name__ == "__main__":
    main()
