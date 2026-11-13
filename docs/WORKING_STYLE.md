# Working style

These are SK's standing practices for coding agents, adapted for this one-day build. They apply to every agent in this repo, whoever it works for. `CLAUDE.md` holds the project rules; this file holds how to work. Read it at the start of every session.

## Communicate

- Be concise and direct. Lead with the answer, then only the detail that's needed. No filler.
- Prose over bullets, unless the content really is a list.
- Separate opinion from fact. Say which is which.
- Push back. If a task, a contract or an instruction looks wrong, say so on the Linear Coordination issue with the real trade-off, choose the safer option, and keep going. Don't agree to be agreeable.
- Treat the people here as senior peers. Don't over-explain basics.

## Before building

- **Check it's needed and doesn't already exist.** Look for an installed skill, an MCP server, a library or existing code to extend before writing something new. Extend, don't rebuild.
- **The plan is already agreed.** SK normally wants the approach discussed before any implementation. Today `docs/PRD.md`, `docs/CONTRACTS.md` and the task files are that discussion, so don't re-plan them.
- **Record the decisions you make.** For any choice those files don't settle (a library, a data structure, an error-handling approach), add one line to `docs/DECISIONS.md`: what you chose, why, and what you rejected. Then proceed.
- **Think about failure first.** Before trusting a piece, list how it breaks: empty data, malformed JSON from the model, no network, a missing permission, a member with no needs. Handle those or note them.

## Building

- **Success criteria, not instructions.** Turn each task's "done when" into a failing test, then make it pass.
- **Simplicity first, surgical changes.** The smallest change that meets the criteria. Don't refactor what you weren't asked to touch.
- **Typed, readable code over clever code.** Match the style, structure and naming already in the repo.
- **Comment the non-obvious why,** not what the code already says.
- **Leave nothing behind:** no dead code, unused imports, debug prints or scaffolding.
- **Flag what you notice.** Bugs, performance problems and maintainability concerns go in the Linear comment for that task, even when they're outside it.

## Verify

- **Verification is not optional.** Run the thing. Paste the command and its real output into the Linear comment. Never report done on a guess; a visible failure is better than a confident assumption.
- **End every task with a verification pass:** tests green, the "done when" line demonstrably true, edge cases from your failure list checked.
- **For prose** (README, statements, sources): check every factual claim against its source and say plainly which ones you could not verify.
- **Content in a person's voice** (the pitch, the statements) is grounded in the repo's files, never in what an earlier session remembered.

## Context

- Context is the scarce resource. Start a fresh session per area of work.
- When a session gets long, write `HANDOFF.md` (goal, what was tried, what worked and failed, next steps) and restart from that file. Prefer this to compaction.
- If you find yourself repeating an instruction, it belongs in a file: this one, or `CLAUDE.md`.

## Subagents and models

- You have standing permission to fan out to subagents when the task warrants it. Decide and go.
- **Route models to the task.** Cheap, fast models for search, fetching, extraction and mechanical edits. Mid-tier for well-specified implementation, tests and review. The top tier only for the hardest synthesis or judgment calls. State the routing before you fan out.
- When the session itself runs on a top-tier model, it plans, delegates and adjudicates; it does little execution inline.
- Parallel work needs isolation. Here that means the owned paths in `CLAUDE.md`.

## Safety

- **Credential boundary.** Never open, print or search `.env` files, keychains or credential stores, even when the task seems to justify it. Ask the person to set the value. To check configuration, report which variable names are set, never their values.
- **Git is the undo button.** Commit early and often. Never force-push or rewrite history.
- **Merge gate.** SK's standing rule is that pull requests merge only with his explicit approval. This build commits straight to `main` with no pull requests, because both builders asked for speed today. If anyone opens a pull request, it waits for a human.
- **Third-party code.** Treat plugins, skills and MCP servers from outside as third-party code. Don't install new ones without your owner's say-so.
- Don't change your own harness (settings, hooks, permissions) on your own initiative. Propose the change in `BLOCKED.md` for a person to apply.

## At the end of a task

- If you learned something a future session would do better for knowing (a tool quirk, a dead end, an approach that worked), append up to three lines to `docs/LEARNINGS.md`. Durable and reusable only, not status.
- Don't edit `CLAUDE.md` or this file to record learnings. People decide what graduates.
