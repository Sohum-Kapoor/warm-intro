import importlib.util
import json
from pathlib import Path

from warmintro.api import app

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "export_openapi.py"
URL = "https://example.trycloudflare.com"
TOOLS = {"getMembers", "scout", "holdMeeting", "recordFeedback", "runRound", "getLatestRun"}


def _spec() -> dict:
    spec = importlib.util.spec_from_file_location("export_openapi", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return json.loads(json.dumps(module.build_spec(app.openapi(), URL)))


def _walk(node):
    yield node
    children = node.values() if isinstance(node, dict) else node if isinstance(node, list) else []
    for child in children:
        yield from _walk(child)


def test_openapi_30_with_one_server():
    spec = _spec()
    assert spec["openapi"] == "3.0.3"
    assert spec["servers"] == [{"url": URL}]


def test_exactly_the_six_tool_operations_with_ids_and_descriptions():
    ops = [op for methods in _spec()["paths"].values() for op in methods.values()]
    assert {op["operationId"] for op in ops} == TOOLS and len(ops) == 6
    assert all(op["description"].strip() for op in ops)


def test_no_31_only_constructs():
    for node in _walk(_spec()):
        if isinstance(node, dict):
            assert "const" not in node and "examples" not in node and "$schema" not in node
            for key in ("anyOf", "oneOf"):
                assert not any(isinstance(o, dict) and o.get("type") == "null" for o in node.get(key, []))


def test_cli_writes_valid_json(tmp_path, monkeypatch, capsys):
    import sys

    out = tmp_path / "openapi.json"
    monkeypatch.setattr(sys, "argv", ["export_openapi.py", "--server-url", URL, "--out", str(out)])
    spec = importlib.util.spec_from_file_location("export_openapi", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.main()
    assert json.loads(out.read_text())["servers"][0]["url"] == URL
