"""Export the FastAPI app as an OpenAPI 3.0.3 file that watsonx Orchestrate can import.

Usage: .venv/bin/python scripts/export_openapi.py --server-url https://<tunnel>.trycloudflare.com
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# The tools the network agent may call. /health and anything else is dropped.
TOOL_OPERATIONS = {"getMembers", "scout", "holdMeeting", "recordFeedback", "runRound", "getLatestRun", "getResources", "askAgent"}


def _is_null(schema: Any) -> bool:
    return isinstance(schema, dict) and schema.get("type") == "null"


def to_3_0(node: Any) -> Any:
    """Rewrite the OpenAPI 3.1 / JSON Schema 2020-12 constructs FastAPI emits into their 3.0 forms."""
    if isinstance(node, list):
        return [to_3_0(item) for item in node]
    if not isinstance(node, dict):
        return node

    node = {k: to_3_0(v) for k, v in node.items() if k != "$schema"}

    for key in ("anyOf", "oneOf"):
        options = node.get(key)
        if isinstance(options, list) and any(_is_null(o) for o in options):
            rest = [o for o in options if not _is_null(o)]
            del node[key]
            if len(rest) == 1:
                only = rest[0]
                node.update(only)
                # 3.0 ignores siblings of $ref, so nullable only goes on inline schemas.
                if "$ref" not in only:
                    node["nullable"] = True
            else:
                node[key] = rest
                node["nullable"] = True

    if "const" in node:
        node["enum"] = [node.pop("const")]

    if isinstance(node.get("examples"), list):
        examples = node.pop("examples")
        if examples:
            node.setdefault("example", examples[0])

    # 3.1 numeric exclusive bounds become 3.0 boolean flags next to minimum/maximum.
    for bound, limit in (("exclusiveMinimum", "minimum"), ("exclusiveMaximum", "maximum")):
        if isinstance(node.get(bound), (int, float)) and not isinstance(node[bound], bool):
            node[limit] = node.pop(bound)
            node[bound] = True
    return node


def _refs(node: Any) -> set[str]:
    if isinstance(node, list):
        return set().union(*map(_refs, node), set())
    if not isinstance(node, dict):
        return set()
    found = {node["$ref"].rsplit("/", 1)[-1]} if "$ref" in node else set()
    return found.union(*(_refs(v) for v in node.values()))


def build_spec(app_openapi: dict[str, Any], server_url: str) -> dict[str, Any]:
    paths: dict[str, Any] = {}
    for path, methods in app_openapi["paths"].items():
        for method, op in methods.items():
            if op.get("operationId") not in TOOL_OPERATIONS:
                continue
            op = dict(op)
            op["description"] = op.get("description") or op["summary"]
            op["responses"] = {c: r for c, r in op.get("responses", {}).items() if c != "422"}
            paths.setdefault(path, {})[method] = op

    schemas = app_openapi.get("components", {}).get("schemas", {})
    needed: set[str] = set()
    todo = _refs(paths)
    while todo:
        name = todo.pop()
        if name not in needed:
            needed.add(name)
            todo |= _refs(schemas[name])

    spec = {
        "openapi": "3.0.3",
        "info": {
            "title": app_openapi["info"]["title"],
            "version": app_openapi["info"]["version"],
            "description": app_openapi["info"].get("description", ""),
        },
        "servers": [{"url": server_url}],
        "paths": paths,
        "components": {"schemas": {n: schemas[n] for n in sorted(needed)}},
    }
    return to_3_0(spec)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server-url", required=True, help="public https URL of the running API")
    parser.add_argument("--out", default=str(ROOT / "orchestrate" / "openapi.json"))
    args = parser.parse_args()

    from warmintro.api import app

    spec = build_spec(app.openapi(), args.server_url.rstrip("/"))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(spec, indent=2) + "\n")
    print(f"wrote {out} ({len(spec['paths'])} paths, server {args.server_url})")


if __name__ == "__main__":
    main()
