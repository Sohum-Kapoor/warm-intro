# Tools and setup

What each person's Claude Code gets from this repo, and what still needs a manual step.

## Comes with the repo (nothing to do)

| What | File | Effect |
| --- | --- | --- |
| Project rules | `CLAUDE.md` | Loaded at the start of every session |
| Working style | `docs/WORKING_STYLE.md` | SK's standing practices for agents; `CLAUDE.md` tells every agent to read it first |
| Permissions | `.claude/settings.json` (copied from `setup/claude-settings.json` by SK's first run) | Git, `make`, `pytest` and `uv` commands run without a prompt; reading `.env` and force-pushing are blocked |
| Linear connection | `.mcp.json` (created by SK's first run) | Points Claude Code at Linear's official MCP server |
| Contracts and sample data | `docs/CONTRACTS.md`, `web/fixtures/sample_run.json` | Both halves build against the same shapes |

Two things to know:

- The allow rules in `.claude/settings.json` take effect only after you accept Claude Code's prompt to trust this folder. The deny rules apply immediately.
- If you want different permissions for yourself, put them in `.claude/settings.local.json`. That file stays out of git.

## Needs one manual step each

- **Linear sign-in.** In a Claude Code session, run `/mcp` and sign in to Linear in the browser. If the server isn't listed, add it with the command from Linear's docs (https://linear.app/docs/mcp): `claude mcp add --transport http linear-server https://mcp.linear.app/mcp`.
- **GitHub CLI.** `gh auth status` should show you signed in. If not, `gh auth login`.
- **IBM Bob.** Start the trial at https://bob.ibm.com/trial. It's required for the `[BOB]` tasks and the screenshots.
- **watsonx keys.** Copy `.env.example` to `.env` and fill it in yourself. Agents are blocked from reading it.

## Does not travel with the repo

These live in SK's own Claude setup, not in this project, so Jesse's agents won't have them unless he installs his own:

- SK's personal skills and plugins (engineering and design skill packs, his knowledge-vault skills).
- His user-level hooks, including the end-of-task capture check. The repo version of that habit is the "At the end of a task" section of the working-style rules.
- His user-level `CLAUDE.md` and memory.

The practices from those that matter for this build are written into `docs/WORKING_STYLE.md`.
