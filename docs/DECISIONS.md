# Decisions

One line per decision the PRD and contracts don't settle. Newest first. Format: `time — agent id — decision — why — rejected alternative`.

- 13:05 — jesse-Jessechg-44 — web page is plain HTML/CSS/JS with an inline-SVG map; `web/fixtures/sample_run.js` (`window.SAMPLE_RUN`) is a generated copy of the JSON so file:// works (browsers block fetch there); regenerate with `(printf 'window.SAMPLE_RUN = '; cat web/fixtures/sample_run.json; printf ';\n') > web/fixtures/sample_run.js` — chart/graph libraries need a CDN or build step.
- 11:45 — planning — Python and FastAPI for the tools — the IBM SDKs are Python, and FastAPI produces an OpenAPI description for free — Node.
- 11:45 — planning — Commit straight to `main`, no pull requests — speed for a one-day build — branches with review.
- 11:45 — planning — Repo private until the 5:30 PM secrets check — IBM suspends accounts for exposed credentials — public from the start.
- 12:20 — jesse-Jessechg-44 — live mode polls `GET /runs/latest` every 1.5s while `status` is running and appends new meetings without restarting; the weights panel renders `weights_before/after` from the run (or the `POST /feedback` response after an outcome button) and hides when absent — a push stream or websocket needs backend work.
