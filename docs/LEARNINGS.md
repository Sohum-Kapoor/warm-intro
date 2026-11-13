# Learnings

Durable, reusable things a future session would do better for knowing: tool quirks, dead ends, approaches that worked. Not status. Up to three lines per task, newest first. Format: `time — agent id — learning`.
13:10 — jesse-Jessechg-44 — fetch() is blocked on file://, so any static page that must open by double-click needs its data as a script-tag JS file.
13:10 — jesse-Jessechg-44 — Headless Chrome check: `Chrome --headless=new --screenshot=out.png --window-size=1600,1000 --virtual-time-budget=9000 URL`; macOS `sed -i` needs `-i ''`.
- Headless Chrome `--screenshot` ignores real-time waits; to test polling or timing, drive Chrome over the DevTools protocol (node 22 has a global WebSocket) and capture after real sleeps. A `display:` rule on an element overrides the `hidden` attribute — add `[hidden]{display:none}`.
