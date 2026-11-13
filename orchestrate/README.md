# Create the Warm Intro network agent in watsonx Orchestrate

For SK. Account steps are yours. Everything here is from the official docs read on 2026-11-13 (details and links in `orchestrate/NOTES.md`). Items the docs do not settle are marked **[NOT VERIFIED]** with the check to do.

The agent calls our FastAPI service through six tools: `getMembers`, `scout`, `holdMeeting`, `recordFeedback`, `runRound`, `getLatestRun`. Orchestrate runs in IBM's cloud and cannot reach your laptop, so the API needs a public https URL. A `cloudflared` tunnel gives one with a single command.

## A. Start the API and the tunnel

Use two terminals, from the repo root. Keep `LLM_PROVIDER=mock` for the stage (see F).

1. Terminal 1: `make serve`
2. Terminal 2: `make tunnel` (runs `cloudflared tunnel --url http://localhost:8000`). It prints a line with `https://<random-words>.trycloudflare.com`. Copy that URL.
3. Check from a third terminal: `curl https://<random-words>.trycloudflare.com/health` should return `{"ok":true,"provider":"mock"}`.

## B. Export the OpenAPI file with your URL

```bash
.venv/bin/python scripts/export_openapi.py --server-url https://<random-words>.trycloudflare.com
```

This rewrites `orchestrate/openapi.json` (OpenAPI 3.0.3, one server, the six tools only). Open it and confirm `servers[0].url` is your URL, not `REPLACE-WITH-TUNNEL-URL`. Re-run this whenever the tunnel restarts (F1).

## C. Path 1: the web UI

Menu wording differs between releases. The paths below combine two IBM pages; if a label is not there, look for the nearest one.

1. Open watsonx Orchestrate and sign in.
2. Create the agent: main menu > **Active inventory > Agents** > **Create agent** > **Create from scratch**. (The ADK tutorial reaches the same place via the chat page > **Manage agents** > **Create agent** > **Create from Scratch**.)
3. **Name:** `warm_intro_network_agent` (snake_case, no spaces). **Description:** paste the `description:` text from `orchestrate/warm_intro_network_agent.yaml`. Click **Build** (or **Create**).
4. **Build** tab > **Behavior > Profile**: pick the AI model (the YAML uses `groq/openai/gpt-oss-120b`, the default on IBM Cloud; use whatever the list offers) and paste the `instructions:` text from the YAML into **Instructions**.
5. Add the tools: in the agent's **Toolset** (or the **Tools** section), **Add tool** > **OpenAPI**. Some releases call it **Add from file or MCP server**. Drag in or browse to `orchestrate/openapi.json`, wait for **Validation successful**, **Next**, and select all six tools.
   **[NOT VERIFIED]** The exact OpenAPI import wording came from a partner lab guide, not an IBM page. If validation fails, go to F3.
6. Check the six tools show up under the agent's tools: `runRound`, `getLatestRun`, `scout`, `holdMeeting`, `recordFeedback`, `getMembers`. **[NOT VERIFIED]** The docs say `operationId` becomes the tool name, and a newer release shows `summary` as the display name instead. If a tool is displayed by its summary ("Run a full introduction round"), that is fine; the agent still calls it by operationId.
7. Test in **Draft Preview** (or the chat bar): type `Run a round of Warm Intro`. Expect: the agent calls `runRound`, says it is running, calls `getLatestRun` until complete, then summarises each meeting with votes and introductions. Then try `find me someone who can do machine vision for inspection`.
8. **Deploy** tab > **Deploy to Live**. Then in **Deploy > Draft** turn on **Orchestrate Chat** visibility so the agent shows on the Orchestrate Chat home page. (Tutorial variant: **Deploy**, then pick the agent from the **Agents** list on the chat page.)

## D. Path 2: the ADK CLI (alternative)

Only commands the docs verify. The ADK needs Python 3.11 to 3.14; use a separate venv so it does not touch `.venv`.

```bash
python3 -m venv .venv-orchestrate && source .venv-orchestrate/bin/activate
pip install --upgrade ibm-watsonx-orchestrate
```

Credentials: in the Orchestrate web UI, user icon (top right) > **Settings** > **API details** tab. Copy the **service instance URL** (use this one, not the IBM Cloud resource page). Click **Generate API key** (IBM Cloud sends you to IAM: click **Create**, name it, copy the key). Keep the key out of git.

```bash
orchestrate env add -n warmintro -u <service-instance-url> --type ibm_iam --activate
orchestrate env activate warmintro                      # prompts for the API key
orchestrate models list                                 # confirm the llm id in the YAML is listed
orchestrate tools import -k openapi -f orchestrate/openapi.json
orchestrate agents import -f orchestrate/warm_intro_network_agent.yaml   # lands in DRAFT
orchestrate agents deploy --name warm_intro_network_agent
orchestrate agents list
orchestrate chat start                                  # local chat UI to test
```

- `--type ibm_iam` is for IBM Cloud; AWS instances use `mcsp`. **[NOT VERIFIED]** which one your hackathon instance is; the flag is only needed if it is not inferred from the URL.
- If `orchestrate models list` does not show `groq/openai/gpt-oss-120b`, edit `llm:` in the YAML to a listed id.
- **[NOT VERIFIED]** The import of an unauthenticated OpenAPI tool without `-a <app-id>` (the flag is documented as optional; never run). If the CLI asks for a connection, tell Jesse and use the UI path in C.
- **[NOT VERIFIED]** The tool names the agent YAML refers to are the operationIds. If `agents import` says a tool is not found, look at the names the tools import printed and fix the `tools:` list.
- Deploy errors on Developer Edition (it only has draft). Use the SaaS instance.

## E. What to screenshot (video and tech statement)

1. The agent builder: name, description, instructions, and the tools list showing all six tools.
2. The OpenAPI import screen showing validation success (proves the tools are our own service).
3. A chat where you type `Run a round of Warm Intro` and the agent calls `runRound`, then `getLatestRun`, then summarises meetings, votes and introductions.
4. The tool-call trace or reasoning panel if the UI shows one, with `runRound` visible.
5. A second chat for a request (`find me someone who can do machine vision for inspection`) and one for `recordFeedback` showing the weight change.
6. The deployed agent on the Orchestrate Chat home page.

Tech statement wording: see "What is honestly built" below.

## F. Troubleshooting

1. **Tunnel URL changes on every restart.** Re-run step B with the new URL, then re-import the tools (UI: remove the old tools and add the new file; CLI: run `orchestrate tools import -k openapi -f orchestrate/openapi.json` again). Do not restart the tunnel after the video recording starts. The tunnel dies when your laptop sleeps or the terminal closes.
2. **40 s tool timeout.** The docs disagree: 40 s for synchronous tools in the UI, 2 min in the performance guide. Plan for 40 s. That is why the agent calls `runRound` with `background: true` (returns at once) and polls `getLatestRun`. `holdMeeting` is synchronous: on the mock provider it takes well under a second, but with a real model it may take 20 to 40 s. For the stage use `LLM_PROVIDER=mock` (the default), or run a round beforehand so the latest run is already complete. Async OpenAPI tools need a `callbackUrl` header and our API does not call back, so they are not used.
3. **OpenAPI import errors.** The docs say "The OpenAPI version must be 3.0." FastAPI emits 3.1, so `scripts/export_openapi.py` converts it (3.0.3, nullable instead of `anyOf` null, no `const`, no `examples`, one server, six operations with `operationId` and `description`). Never import the raw `/openapi.json` from the running app. If validation still fails, read the message, run `.venv/bin/python -m pytest -q tests/test_export_openapi.py`, and tell Claude the message.
4. **Tools called with wrong arguments, or the agent loops.** The instructions cap the polling at 12 calls. The default gpt-oss model does best with short instructions and 10 or fewer tools (we have six). Edit the instructions in the agent builder and retest.
5. **Last resort (PRD risk table): no custom tool import.** Two fallbacks from `orchestrate/NOTES.md` section 6 and the recommendation:
   - Python `@tool` wrappers (`from ibm_watsonx_orchestrate.agent_builder.tools import tool`, import with `orchestrate tools import -k python -f my_tool.py -r requirements.txt`) that run inside Orchestrate and bundle the mock pipeline and data under the package, read via `__file__`. It needs Python 3.12 compatible code, packages on the tenant allowlist (**[NOT VERIFIED]** whether pydantic and others are), and a read-only filesystem (the mock run log cannot be written to disk, so the wrapper must return results in memory). Expect 1 to 2 hours.
   - Or a Python tool that calls our public URL with `requests`. **[NOT VERIFIED]** Outbound public https from a Python tool is not documented; test with one tiny tool first.
   - PRD fallback: an agent built with Orchestrate's built-in features and the profiles loaded as knowledge. Show a recorded round from the web UI next to it.
6. **Permanent hosting instead of a tunnel (optional).** IBM Cloud Code Engine, see "Integration decisions" in `orchestrate/NOTES.md`. Only worth it if the tunnel proves flaky.

## What is honestly built

One network agent in watsonx Orchestrate calls our six tools (an OpenAPI import of the Warm Intro service). The member agents are one agent design run once per member inside the meeting tool, each seeing only its own member's profile. They are not separate Orchestrate agents. Members, meetings, votes and messages are synthetic; transcripts, votes and messages are AI-generated. A schedule ("run every Monday") is only claimed if you actually create one in chat and show it **[NOT VERIFIED]** available on a trial instance (needs `is_schedulable: true` in the YAML; we leave it off).
