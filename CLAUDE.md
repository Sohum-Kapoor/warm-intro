# Warm Intro — instructions for coding agents

Hackathon build. Submissions close **6:00 PM ET on Fri Nov 13, 2026**. Feature freeze is 5:00 PM. Finished beats fancy.

Read in this order before writing code: `docs/PRD.md`, `docs/CONTRACTS.md`, then your owner's task file (`tasks/SK.md` or `tasks/JESSE.md`).

**Also read `docs/WORKING_STYLE.md` at the start of every session.** It is how agents work here (communication, verification, model routing, safety) and applies to every agent, whoever it works for. Setup and tools are in `docs/TOOLS.md`.

## Who you are

The kickoff prompt sets `OWNER` to `sk` or `jesse`. Your agent id is `<owner>-<hostname>` (for example `sk-macbook`). Use it in every Linear comment and in commit trailers.

## Rules

1. **Work without asking.** Go through your owner's task file top to bottom, P0 before P1. Do not stop for confirmation. If you are blocked (missing credentials, an account step only a human can do, an unclear contract), write the blocker in `BLOCKED.md` and on the Linear issue, then move to the next task.
2. **Stay in your lane.** Edit only your owner's paths:
   - `sk`: `warmintro/`, `data/`, `tests/`, `orchestrate/`, `scripts/`, `runs/demo.json`
   - `jesse`: `web/`, `tools/`, `docs/submission/`
   - Shared, edit with a heads-up on the Coordination issue: `docs/CONTRACTS.md`, `README.md`, `SOURCES.md`, `CLAUDE.md`, `tasks/`
3. **Contracts are fixed points.** Build to `docs/CONTRACTS.md`. To change one, follow the rule at the top of that file.
4. **Mock first.** `LLM_PROVIDER=mock` is the default. Everything must run and every test must pass with no network and no keys. The watsonx provider is added behind the same interface.
5. **Do not guess IBM APIs.** Before coding against watsonx.ai or watsonx Orchestrate, read the official documentation and the hackathon guide, and write what you verified (with links) in `orchestrate/NOTES.md`. Model ids, URLs and project ids come from the environment, never from memory.
6. **Secrets never enter git, and you never read them.** Keys live in `.env` (git-ignored), filled in by a person. Do not open or print `.env`; the code loads it at run time. Run `git diff --cached` before each commit and check for keys. IBM scans public repos and suspends accounts for exposed credentials. No personal email addresses or phone numbers in any committed file either: this repo becomes public.
7. **Synthetic data only.** Invented people and companies. No real company or person names, no client data, nothing scraped. Every data file and every screen says it is synthetic.
8. **Label AI output.** Agent transcripts, votes and messages are marked AI-generated in the UI and the run log.
9. **Leave `[BOB]` tasks for the humans.** Tasks tagged `[BOB]` must be built by a person using IBM Bob, with screenshots. Write the spec and the tests for them, then leave the implementation alone.
10. **Describe what exists.** In docs and statements, say "one agent design run per member inside the meeting tool" unless separate Orchestrate agents really shipped.

## Git

- One repo, `main` only. Commit after each task with tests green. Small commits.
- `git pull --rebase` before every push. Never force-push. Never rewrite history.
- If a rebase conflicts in a file you don't own, stop that task, note it in `BLOCKED.md`, and tell the other side on the Coordination issue.

## Coordination through Linear

Linear project: **Warm Intro (DevFest)** in the `Sohum` workspace, team `SOH`. Issue titles start with `[SK]` or `[JESSE]` and the task id.

- **Before a task:** read new comments on the **Coordination** issue. Set your task's issue to In Progress and comment `start <agent-id>`.
- **After a task:** comment a two-line summary and the commit hash, then set the issue to Done.
- **To message another agent or person:** comment on the Coordination issue, starting with `@sk`, `@jesse` or `@all`. Keep it to what they need to act on.
- **When a message is addressed to your owner** and asks for something in your paths, do it next.
- **Several machines for one owner:** claim a task by setting it In Progress before you start. Never start a task that is already In Progress.
- **Don't create issues freely.** The workspace may have an issue limit. Comment on an existing issue instead. Create a new issue only for a new task a person asked for. If Linear refuses to create one, use `COORDINATION.md` and tell your owner; never delete or archive anything in Linear to make room.
- **If Linear is not connected:** use `COORDINATION.md` in the repo the same way (append-only; pull before reading, push after writing).

This is polling, not live chat. Check at task boundaries.

## Stack

- Python 3.11+, FastAPI, pytest. Use `uv` if installed, else `venv` and `pip`.
- `warmintro/` package: `config.py`, `llm.py`, `scout.py`, `meeting.py`, `feedback.py`, `round.py`, `api.py`.
- `web/`: one static page, plain HTML, CSS and JavaScript, no build step. It must render `web/fixtures/sample_run.json` with no backend.
- A `Makefile` with `make test`, `make data`, `make round`, `make serve`.

## Done means

Tests pass on the mock provider, the task's "done when" line is true, the commit is pushed, and the Linear issue is Done with a summary.
