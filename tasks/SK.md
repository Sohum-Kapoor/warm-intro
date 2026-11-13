# Tasks — SK (owner: `sk`)

Paths: `warmintro/`, `data/`, `tests/`, `orchestrate/`, `scripts/`. Work top to bottom. Tick the box and update the Linear issue when each is done.

## P0

- [x] **S0 Bootstrap.** `git init -b main`, add the Linear server at project scope so `.mcp.json` is created, commit the scaffold, create the private GitHub repo `warm-intro`, push, invite Jesse (his email is in the kickoff prompt and in Linear issue SOH-408; do not write it into any file). *Done when:* the repo is on GitHub and Jesse has an invite or SK has the settings link to add him.
- [x] **S1 Skeleton.** `pyproject.toml`, `warmintro/` package, `config.py`, `Makefile`, pytest wired. `llm.py` with the `LLM` protocol and a deterministic `mock` provider (hash-based embeddings; scripted chat that can vote no). *Done when:* `make test` passes offline.
- [x] **S2 Data.** `scripts/generate_data.py` writes `data/profiles.json` (about 60 members, even mix of the four types, three hubs) and `data/history.json` (about 40), following `docs/CONTRACTS.md`. Hand-write the demo members: three pairs of different kinds that should end in yes and one pair that should end in no because of a deal-breaker. Derive `data/weights.json` from the history. Invented names only. *Done when:* files exist and the validator test passes.
- [x] **S3 Scout.** `scout.py`: embed needs, offers and descriptions (cached to disk); score all pairs per the contract; threshold; at most three meetings per member; labels; evidence. Ask mode. *Done when:* tests show the planted pairs rank in the top results and fewer than 10% of pairs pass the filter.
- [x] **S4 Meeting.** `meeting.py`: one agent prompt template, run once per side with only that member's profile, deal-breakers and remaining budget. Three turns each, then a forced JSON vote with one reason (retry once on bad JSON, else vote no). Introductions on two yes votes, respecting permissions. *Done when:* on the mock provider, the planted no-pair ends in no and a planted yes-pair ends in yes.
- [x] **S5 Feedback.** `feedback.py`: an outcome or a no-vote reason nudges `weights.json` for that `kind|label`, clamped 0.5–1.5. *Done when:* a test shows a recorded outcome changes the next scout ranking.
- [x] **S6 Round and API.** `round.py` runs scout → meetings → introductions → run log (`runs/<id>.json` and `runs/latest.json`). `api.py` exposes the endpoints in the contract. *Done when:* `make round` produces a valid run log with nobody typing and `make serve` answers `GET /runs/latest`.
- [ ] **S7 watsonx provider.** Read the official `ibm-watsonx-ai` docs first; record what you verified in `orchestrate/NOTES.md`. Implement the provider behind `LLM`, model ids from `.env`. *Blocked until* SK puts keys in `.env`; if absent, write the exact variables needed in `BLOCKED.md` and continue.
- [ ] **S8 Orchestrate.** Read the watsonx Orchestrate docs on custom tools and agents first; write the verified steps in `orchestrate/NOTES.md`. Produce whatever the verified path needs (an OpenAPI file from the FastAPI app, or tool definitions) plus `orchestrate/README.md` with the click-by-click steps for SK to create the network agent. *Done when:* SK can follow the README without guessing. Account steps are SK's.
- [ ] **S9 Demo round.** `make demo` runs a round on the demo members with the real provider and saves `runs/demo.json` for the video and as the stage fallback.
- [ ] **S10 [BOB] Data validator.** Write the spec and failing tests for `scripts/validate_data.py` (checks every file against the contracts, flags real-looking names). **SK builds the implementation in IBM Bob** and saves screenshots to `bob-screenshots/sk/`.
- [ ] **S11 Ship check (5:30 PM).** Secrets scan of the full history, `SOURCES.md` current, README run steps verified from a clean clone. Then tell SK to make the repo public.

## P1 (only after S6 works end to end)

- [ ] **S12** Separate member agents in Orchestrate, one per member type (PRD R12).
- [ ] **S13** Contrast matches (PRD R13).
