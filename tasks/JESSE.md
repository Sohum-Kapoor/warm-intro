# Tasks — Jesse (owner: `jesse`)

Paths: `web/`, `tools/`, `docs/submission/`. Work top to bottom. Tick the box and update the Linear issue when each is done. You never need SK's code to be finished: build against `docs/CONTRACTS.md` and `web/fixtures/sample_run.json`.

## P0

- [ ] **J0 Setup.** Accept the GitHub invite, clone the repo, connect Linear to Claude (see `tasks/PROMPTS.md`), start the IBM Bob trial. *Done when:* your agent can list the issues in the Linear project.
- [ ] **J1 Scan view.** `web/index.html`: one static page, no build step, that loads a run log and shows:
  - the three hubs (Detroit, Grand Rapids, Ann Arbor) with members as dots, styled by type;
  - meetings appearing one at a time as lines between two members, colored by result (introduced or declined);
  - a side panel with the selected meeting's transcript, both votes and reasons;
  - an outbox panel with the introductions;
  - a visible "synthetic data, AI-generated" label.
  It reads `web/fixtures/sample_run.json` by default and `http://localhost:8000/runs/latest` when `?live=1`. *Done when:* opening the file shows the sample run playing through.
- [ ] **J2 Replay controls.** Play, pause and step through meetings; a "run a round" button that calls `POST /round` in live mode. *Done when:* the demo can be driven from this page.
- [ ] **J3 [BOB] Run summary tool.** Write the spec and tests for `tools/summarize_run.py` (turns a run log into a short Markdown summary: stats, each meeting's result and reasons). **Jesse builds the implementation in IBM Bob** and saves screenshots to `bob-screenshots/jesse/`.
- [ ] **J4 Submission text.** In `docs/submission/`: `problem_solution.md` (500 words max: use case, target users, how they use it, why it's creative, how it uses AI), `tech_statement.md` (exactly how IBM Bob and watsonx Orchestrate were used; describe what was built, nothing more), `video_script.md` (3 minutes max, at least 90 seconds of the product on screen, Bob and Orchestrate both shown). Draw from `docs/PRD.md`.
- [ ] **J5 Sources and README.** Keep `SOURCES.md` current (every AI tool used, the pitch statistics with links, the synthetic-data statement). README: what it is, how to run it, screenshots.

## P1

- [ ] **J6** Before/after view of the weights when an outcome is recorded.
- [ ] **J7** Polish: animation timing, a legend, a full-screen mode for the pitch.
