"""Tests for scripts/validate_data.py. Spec: scripts/VALIDATE_DATA_SPEC.md (task S10).

Every input is written to tmp_path; the repo's data/ is never read.
"""

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "validate_data.py"

if not SCRIPT.exists():
    pytest.skip("S10: built by SK in IBM Bob", allow_module_level=True)

_spec = importlib.util.spec_from_file_location("validate_data", SCRIPT)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
validate = _mod.validate


# ---------- clean fixture data ----------

def clean_profiles():
    return {
        "synthetic": True,
        "members": [
            {
                "id": "m001",
                "type": "individual",
                "name": "Maya R.",
                "hub": "detroit",
                "sector": "machine vision",
                "description": "Invented engineer who builds inspection tools.",
                "needs": ["a factory floor to test on"],
                "offers": ["computer vision consulting"],
                "deal_breakers": ["no unpaid pilots"],
                "intro_budget": 2,
                "permissions": {"share_profile": True, "propose_meetings": True, "contact_member": True},
            },
            {
                "id": "m002",
                "type": "startup",
                "name": "Northlake Sensors",
                "hub": "detroit",
                "sector": "sensors",
                "description": "Invented startup making low-cost vibration sensors.",
                "needs": ["pilot customers in automotive"],
                "offers": ["cheap sensor hardware"],
                "deal_breakers": [],
                "intro_budget": 3,
                "permissions": {"share_profile": True, "propose_meetings": True, "contact_member": False},
            },
            {
                "id": "m003",
                "type": "small_business",
                "name": "Harbor Tool and Die",
                "hub": "grand_rapids",
                "sector": "tool and die",
                "description": "Invented shop that cuts precision dies.",
                "needs": ["automation know-how"],
                "offers": ["precision machining"],
                "deal_breakers": ["no sole-source contracts"],
                "intro_budget": 1,
                "permissions": {"share_profile": True, "propose_meetings": False, "contact_member": True},
            },
            {
                "id": "m004",
                "type": "corporation",
                "name": "Pinecrest Components",
                "hub": "ann_arbor",
                "sector": "industrial components",
                "description": "Invented parts maker looking for newer suppliers.",
                "needs": ["sensor data analytics"],
                "offers": ["supplier introductions"],
                "deal_breakers": [],
                "intro_budget": 0,
                "permissions": {"share_profile": True, "propose_meetings": True, "contact_member": True},
            },
        ],
    }


def clean_history():
    return {
        "synthetic": True,
        "connections": [
            {
                "id": "h001",
                "a": "m001",
                "b": "m002",
                "kind": "individual-startup",
                "label": "complementary",
                "cross_hub": False,
                "outcome": "pilot",
                "date": "2026-06-02",
            },
            {
                "id": "h002",
                "a": "m002",
                "b": "m004",
                "kind": "corporation-startup",
                "label": "unexpected",
                "cross_hub": True,
                "outcome": "hire",
                "date": "2026-07-19",
            },
        ],
    }


def clean_weights():
    return {"individual-startup|complementary": 1.12, "corporation-startup|unexpected": 0.94}


def write_data(tmp_path, files):
    """Write files into tmp_path. A dict value is dumped as JSON; a str is written raw."""
    for name, content in files.items():
        path = tmp_path / name
        if isinstance(content, str):
            path.write_text(content)
        else:
            path.write_text(json.dumps(content))
    return tmp_path


def clean_dir(tmp_path, **overrides):
    files = {
        "profiles.json": clean_profiles(),
        "history.json": clean_history(),
        "weights.json": clean_weights(),
    }
    files.update(overrides)
    return write_data(tmp_path, {k: v for k, v in files.items() if v is not None})


def errors(problems):
    return [p for p in problems if p.level == "error"]


def warnings(problems):
    return [p for p in problems if p.level == "warn"]


def has_error(problems, file, needle=None):
    return any(
        p.level == "error" and p.file == file and (needle is None or needle in p.message)
        for p in problems
    )


def has_warn(problems, file, needle=None):
    return any(
        p.level == "warn" and p.file == file and (needle is None or needle in p.message)
        for p in problems
    )


# ---------- clean data ----------

def test_clean_dataset_has_no_errors_and_no_warnings(tmp_path):
    problems = validate(clean_dir(tmp_path))
    assert errors(problems) == []
    assert warnings(problems) == []


def test_problem_has_level_file_and_message(tmp_path):
    d = clean_dir(tmp_path, **{"weights.json": None})
    problems = validate(d)
    assert problems, "expected at least one problem"
    p = problems[0]
    assert p.level in ("error", "warn")
    assert p.file == "weights.json"
    assert isinstance(p.message, str) and p.message


# ---------- files (errors) ----------

def test_missing_file_is_error(tmp_path):
    d = clean_dir(tmp_path, **{"history.json": None})
    assert has_error(validate(d), "history.json")


def test_bad_json_is_error(tmp_path):
    d = clean_dir(tmp_path, **{"profiles.json": "{not json"})
    assert has_error(validate(d), "profiles.json")


def test_missing_synthetic_flag_is_error(tmp_path):
    profiles = clean_profiles()
    del profiles["synthetic"]
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert has_error(validate(d), "profiles.json", "synthetic")


def test_synthetic_flag_false_is_error(tmp_path):
    history = clean_history()
    history["synthetic"] = False
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json", "synthetic")


# ---------- members (errors) ----------

def test_bad_member_type_enum_is_error(tmp_path):
    profiles = clean_profiles()
    profiles["members"][1]["type"] = "nonprofit"
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert has_error(validate(d), "profiles.json", "type")


def test_bad_hub_enum_is_error(tmp_path):
    profiles = clean_profiles()
    profiles["members"][0]["hub"] = "lansing"
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert has_error(validate(d), "profiles.json", "hub")


def test_duplicate_member_id_is_error(tmp_path):
    profiles = clean_profiles()
    profiles["members"][1]["id"] = "m001"
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert has_error(validate(d), "profiles.json", "m001")


def test_empty_needs_is_error(tmp_path):
    profiles = clean_profiles()
    profiles["members"][0]["needs"] = []
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert has_error(validate(d), "profiles.json")


def test_intro_budget_negative_is_error(tmp_path):
    profiles = clean_profiles()
    profiles["members"][0]["intro_budget"] = -1
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert has_error(validate(d), "profiles.json", "intro_budget")


def test_missing_permission_boolean_is_error(tmp_path):
    profiles = clean_profiles()
    del profiles["members"][0]["permissions"]["contact_member"]
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert has_error(validate(d), "profiles.json", "permissions")


# ---------- connections (errors) ----------

def test_history_referencing_missing_member_is_error(tmp_path):
    history = clean_history()
    history["connections"][0]["b"] = "m999"
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json", "m999")


def test_history_self_connection_is_error(tmp_path):
    history = clean_history()
    history["connections"][0]["b"] = "m001"
    history["connections"][0]["kind"] = "individual-individual"
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json")


def test_wrong_kind_is_error(tmp_path):
    history = clean_history()
    history["connections"][0]["kind"] = "startup-individual"  # must be sorted
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json", "kind")


def test_wrong_cross_hub_is_error(tmp_path):
    history = clean_history()
    # m001 and m002 are both in detroit, so cross_hub must be False.
    history["connections"][0]["cross_hub"] = True
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json", "cross_hub")


def test_bad_outcome_enum_is_error(tmp_path):
    history = clean_history()
    history["connections"][1]["outcome"] = "maybe"
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json", "outcome")


def test_bad_date_is_error(tmp_path):
    history = clean_history()
    history["connections"][0]["date"] = "2026-13-45"
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json", "date")


def test_bad_date_format_is_error(tmp_path):
    history = clean_history()
    history["connections"][0]["date"] = "06/02/2026"
    d = clean_dir(tmp_path, **{"history.json": history})
    assert has_error(validate(d), "history.json", "date")


# ---------- weights (errors) ----------

def test_weight_out_of_range_is_error(tmp_path):
    weights = clean_weights()
    weights["individual-startup|complementary"] = 1.8
    d = clean_dir(tmp_path, **{"weights.json": weights})
    assert has_error(validate(d), "weights.json", "individual-startup|complementary")


def test_weight_below_range_is_error(tmp_path):
    weights = clean_weights()
    weights["corporation-startup|unexpected"] = 0.2
    d = clean_dir(tmp_path, **{"weights.json": weights})
    assert has_error(validate(d), "weights.json")


def test_bad_weight_key_label_is_error(tmp_path):
    weights = clean_weights()
    weights["individual-startup|lucky"] = 1.0
    d = clean_dir(tmp_path, **{"weights.json": weights})
    assert has_error(validate(d), "weights.json", "lucky")


def test_weight_key_without_separator_is_error(tmp_path):
    weights = clean_weights()
    weights["individual-startup"] = 1.0
    d = clean_dir(tmp_path, **{"weights.json": weights})
    assert has_error(validate(d), "weights.json")


# ---------- demo (errors) ----------

def test_demo_with_missing_member_is_error(tmp_path):
    demo = {"synthetic": True, "member_ids": ["m001", "m777"]}
    d = clean_dir(tmp_path, **{"demo.json": demo})
    assert has_error(validate(d), "demo.json", "m777")


def test_demo_with_known_members_is_clean(tmp_path):
    demo = {"synthetic": True, "member_ids": ["m001", "m002"]}
    d = clean_dir(tmp_path, **{"demo.json": demo})
    assert errors(validate(d)) == []


# ---------- real-looking names (warnings) ----------

def test_email_address_is_warning(tmp_path):
    profiles = clean_profiles()
    profiles["members"][1]["description"] = "Reach them at jo.park@example.org for details."
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    problems = validate(d)
    assert has_warn(problems, "profiles.json", "email")
    assert errors(problems) == []


def test_phone_number_is_warning(tmp_path):
    profiles = clean_profiles()
    profiles["members"][2]["description"] = "Call the shop at 313-555-0142 after noon."
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    problems = validate(d)
    assert has_warn(problems, "profiles.json", "phone")
    assert errors(problems) == []


def test_individual_name_not_first_initial_is_warning(tmp_path):
    profiles = clean_profiles()
    profiles["members"][0]["name"] = "Maya Rao"
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    problems = validate(d)
    assert has_warn(problems, "profiles.json", "Maya Rao")
    assert errors(problems) == []


def test_denylisted_organisation_word_is_warning(tmp_path):
    profiles = clean_profiles()
    profiles["members"][2]["name"] = "Gordon Food Service Supply"
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    problems = validate(d)
    assert has_warn(problems, "profiles.json", "Gordon Food")
    assert errors(problems) == []


def test_denylist_matches_whole_words_only(tmp_path):
    profiles = clean_profiles()
    # "Fordham" contains "Ford" but is not the word "Ford".
    profiles["members"][1]["name"] = "Fordham Sensors"
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    assert not has_warn(validate(d), "profiles.json", "Fordham")


# ---------- CLI ----------

def run_cli(data_dir):
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--data-dir", str(data_dir)],
        capture_output=True,
        text=True,
    )


def test_cli_exit_zero_on_clean_data(tmp_path):
    d = clean_dir(tmp_path)
    result = run_cli(d)
    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.strip().splitlines()[-1].startswith("0 errors")


def test_cli_exit_one_on_error(tmp_path):
    d = clean_dir(tmp_path, **{"weights.json": None})
    result = run_cli(d)
    assert result.returncode == 1, result.stdout + result.stderr
    assert "ERROR weights.json:" in result.stdout
    assert "1 errors, 0 warnings" in result.stdout


def test_cli_warnings_do_not_change_exit_code(tmp_path):
    profiles = clean_profiles()
    profiles["members"][0]["name"] = "Maya Rao"
    d = clean_dir(tmp_path, **{"profiles.json": profiles})
    result = run_cli(d)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "WARN profiles.json:" in result.stdout
    assert "0 errors, 1 warnings" in result.stdout
