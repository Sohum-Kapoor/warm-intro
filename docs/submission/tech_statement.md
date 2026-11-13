# Technology statement

*Describes what is built and what is planned in the repository. Items marked **TODO (humans confirm)** are not verified as shipped and must be filled in or deleted before submission. Nothing here is a claim about work that did not happen.*

## Architecture as designed

Warm Intro has three tools behind a small FastAPI service (`warmintro/`, contract in `docs/CONTRACTS.md`):

- **Scout** (`POST /scout`): embeds each member's needs and offers, scores every pair on fit (most of the score), a novelty bonus, learned weights and a capped cross-hub bonus, and returns only pairs above a fit threshold.
- **Meeting** (`POST /meeting`): runs the first meeting between two members' agents for up to three turns each, then collects both votes and, on two yes votes, writes an introduction to each member.
- **Feedback** (`POST /feedback`): records an outcome and updates the weights used by the next scout run.

A network agent in watsonx Orchestrate runs the loop by calling these tools. The scan view in `web/` reads the run log these tools produce.

All members, history, transcripts and messages are synthetic. Everything runs offline on a deterministic mock provider (`LLM_PROVIDER=mock`) with no keys, and the watsonx provider sits behind the same interface.

**Agent layer, stated plainly:** there is one agent design run once per member inside the meeting tool, each prompted with only its own member's profile. These are not separate Orchestrate agents.

## IBM Bob

- Built with Bob: `tools/summarize_run.py`, a tool that turns a run log into a Markdown summary (stats, then each meeting's result and both members' reasons). The spec (`tools/SPEC_summarize_run.md`) and tests (`tools/tests/test_summarize_run.py`) were written first, and Jesse built the implementation in Bob against them.
- Built with Bob: `scripts/validate_data.py`, built by SK (task S10).
- Screenshots: `bob-screenshots/jesse/` and `bob-screenshots/sk/`.
- **TODO (humans confirm):** that `tools/summarize_run.py` was built in Bob and what Bob did (plan, code, test fixes). Add a one-line description per screenshot file once captured.
- **TODO (humans confirm):** that `scripts/validate_data.py` was built in Bob, and any other Bob use.

Other AI tools used are listed in `SOURCES.md` (Claude and Claude Code for planning and most of the implementation).

## watsonx Orchestrate

- Role: hosts the network agent that runs scouting, meetings, introductions and outcome recording by calling the three tools above, in proactive rounds and on request.
- Integration notes, with the documentation they were checked against, are in `orchestrate/NOTES.md`.
- **TODO (humans confirm):** that the network agent exists and what it is called.
- **TODO (humans confirm):** how the tools are exposed to it (for example imported from the service's OpenAPI description, or hosted at a public URL on Code Engine), taken from `orchestrate/NOTES.md`.
- **TODO (humans confirm):** whether a full round ran end to end through Orchestrate with nobody typing, and the date and run id of that run.
- **TODO (humans confirm):** whether member agents shipped as separate Orchestrate agents (requirement R12, P1). If not, keep the sentence above as is.
- **TODO (humans confirm):** that the agent definition and any exported work were saved before the account closes on Nov 24.

## watsonx.ai (Granite)

- Used for embeddings (scoring) and for each agent's meeting text, vote and message to its member, when `LLM_PROVIDER=watsonx`.
- **TODO (humans confirm):** the Granite model ids actually used (they are read from the environment, not hard-coded), and whether the submitted demo run used watsonx or the mock provider.

## What we did not build

- Contact with real people: every member is synthetic and messages go to a demo outbox.
- Accounts, logins, calendars or email integration.
- Proof that the learning loop improves outcomes: the history is synthetic, so only the mechanism is real.
