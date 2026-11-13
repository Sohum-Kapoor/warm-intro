# Warm Intro

LiDAR for connections: an agent for every member of Michigan's innovation ecosystem. The agents scout for each other, hold the first meeting themselves, and bring their people in only when both agents vote yes.

Built at the Michigan DevFest AI Hackathon, Nov 13, 2026, by SK and Jesse.

**All members, history and messages in this repo are synthetic and AI-generated.** No real people or companies appear in the data.

## Where things are

| Path | What |
| --- | --- |
| `docs/PRD.md` | What we're building and why |
| `docs/CONTRACTS.md` | Data shapes and the API both halves build against |
| `tasks/` | Who builds what; kickoff prompts for Claude Code |
| `CLAUDE.md` | Rules for coding agents working in this repo |
| `docs/WORKING_STYLE.md` | How agents work here: SK's standing practices |
| `.claude/settings.json` | Shared permissions (copied from `setup/claude-settings.json` on first run) |
| `docs/TOOLS.md` | What each person's Claude Code gets from the repo, and the manual steps |
| `warmintro/` | Python package: scout, meeting, feedback, round, API |
| `data/` | Synthetic profiles, history and weights |
| `web/` | Scan view (static page) |
| `orchestrate/` | watsonx Orchestrate setup notes and tool definitions |
| `bob-screenshots/` | Each teammate's IBM Bob screenshots (required for submission) |
| `SOURCES.md` | AI tools used, statistics sources, data statement |

## Run it

To be filled in as it's built. Target:

```
make test     # offline, mock provider
make data     # generate synthetic profiles and history
make round    # run one round, write runs/latest.json
make serve    # API on localhost:8000
open web/index.html
```

## IBM technology

- **watsonx Orchestrate:** hosts the network agent that runs scouting, meetings and introductions.
- **Granite on watsonx.ai:** embeddings for scoring; every agent's words, votes and messages.
- **IBM Bob:** used to build the pieces listed in `bob-screenshots/`.

## Before submitting

The repo is private while we build. Before 5:45 PM: check the history for secrets, then make it public (`gh repo edit --visibility public --accept-visibility-change-consequences`).
