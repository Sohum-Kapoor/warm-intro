#!/usr/bin/env python3
"""Copy the site's Granite data bundle into the extension.

MV3 forbids remote code, so the popup ships its own copy of
site/data/site_data.js. Re-run this whenever the site data is regenerated:

    python3 extension/sync_data.py
"""
import json
import pathlib
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "site" / "data" / "site_data.js"
DST = HERE / "data" / "site_data.js"


def check(path: pathlib.Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if "window.WARM_INTRO" not in text:
        sys.exit(f"{path}: does not set window.WARM_INTRO")
    data = json.loads(text[text.index("{"): text.rindex("}") + 1])
    for key in ("members", "demo_run", "asks"):
        if key not in data:
            sys.exit(f"{path}: missing '{key}'")
    return data


def main() -> None:
    check(SRC)  # never copy a half-written file
    DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC, DST)
    data = check(DST)
    run = data["demo_run"]
    print(
        f"copied {SRC.relative_to(HERE.parent)} -> {DST.relative_to(HERE.parent)}: "
        f"{len(data['members'])} members, {len(run['meetings'])} demo meetings, "
        f"{len(data['asks'])} asks, generated {data.get('generated_at', '?')}"
    )


if __name__ == "__main__":
    main()
