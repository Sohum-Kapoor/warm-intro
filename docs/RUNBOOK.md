# Runbook: run the demo and pitch alone (Jesse)

Everything below is copy-pasteable. Never commit `.env`. Secrets never go in git, Linear or chat; SK hands keys over privately.

## 1. Live URLs

| What | URL |
| --- | --- |
| Site | https://sohum-kapoor.github.io/warm-intro/ |
| Member app | https://sohum-kapoor.github.io/warm-intro/site/app/ |
| Full walkthrough | https://sohum-kapoor.github.io/warm-intro/site/full.html |
| Scan view | https://sohum-kapoor.github.io/warm-intro/web/ |
| API (hosted) | `<Code Engine URL, filled in after deploy>` (SK deploys it with `orchestrate/CODE_ENGINE.md`) |

Check the API: `curl <API URL>/health` returns `{"ok":true,"provider":"watsonx"}`.

## 2. How the site deploys

Any push to `main` rebuilds GitHub Pages in about a minute. You have write access, which is all that is needed.

```bash
gh api repos/Sohum-Kapoor/warm-intro/pages/builds/latest --jq .status   # "built" when done
```

Before every push: `git pull --rebase`, and run the secrets scan in section 8.

## 3. Live mode

- **Member app:** append `?api=<API URL>`, for example `https://sohum-kapoor.github.io/warm-intro/site/app/?api=https://<code-engine-url>`. Without it the app runs in demo mode from cached Granite runs.
- **Scan view:** `?live=1` turns on live mode, but `web/app.js` has no `?api=` option. Line 4 hard-codes `var API = 'http://localhost:8000';` and every live call (`/runs/latest`, `/round`, `/feedback`) goes there. So `?live=1` works only against an API on your own laptop (fallback 2 below). To point it at Code Engine, change that one line to the Code Engine URL (it is in your lane, `web/`), or add a `?api=` override there, then push. Without a backend the scan view shows the sample run, or the cached Granite run at `?run=demo`. **Update:** the scan view now takes `?api=<url>` (http/https only, trailing slash stripped, falls back to `http://localhost:8000`), e.g. `web/?live=1&api=<Code Engine URL>`; the live badge shows the active host.

## 4. Fallbacks, in order

1. **Hosted API on Code Engine.** Use the URLs above. If `/health` fails, check the app status in the IBM Cloud console (Code Engine > project > application), or ask SK. If a new revision is deploying, wait for **Ready**.
2. **API on your own laptop.**
   ```bash
   make setup                    # creates .venv and installs
   # create .env from .env.example and fill in the keys SK gives you privately
   make serve                    # terminal 1, port 8000
   make tunnel                   # terminal 2, prints https://<words>.trycloudflare.com (needs cloudflared)
   curl https://<words>.trycloudflare.com/health
   ```
   Use that URL as `?api=...` for the app. The tunnel URL changes on every restart. For Orchestrate, see section 5. With `LLM_PROVIDER=mock` in `.env` no keys are needed; the first `/scout` on watsonx re-embeds about 600 texts, so run it once before going on stage.
3. **No backend at all.** The site, the app in demo mode and the scan view (`web/?run=demo`) all work from the cached real Granite runs. This always works; rehearse it.

## 5. Orchestrate

- The agent `warm_intro_network_agent` lives in SK's IBM Cloud account (watsonx Orchestrate instance). You need SK to invite you: IBM Cloud console > **Manage > Access (IAM) > Users > Invite users**, with access to the Orchestrate service instance ([IBM docs: inviting users](https://cloud.ibm.com/docs/account?topic=account-iamuserinv)). **[NOT VERIFIED]** I could not load that page (the docs site returned HTTP 500), so the menu path is from memory; SK should check it against the page. Ask SK to do this today, then accept the email invite.
- Open the Orchestrate chat, pick `warm_intro_network_agent`. Type, in this order:
  1. `Run a round of Warm Intro` (the agent calls `runRound`, then polls `getLatestRun`, then summarises meetings, votes and introductions)
  2. `find me someone who can do machine vision for inspection`
- **If it errors or returns nothing, the tool URL is stale** (the tools still point to an old tunnel). Fix: `.venv/bin/python scripts/export_openapi.py --server-url <API URL>`, then re-import `orchestrate/openapi.json` (steps in `orchestrate/README.md`, section C step 5, or `orchestrate tools import -k openapi -f orchestrate/openapi.json`), and ask again. With Code Engine the URL should not go stale. If you cannot re-import, show the recorded Orchestrate screenshots instead and say it was recorded.
- Say only what exists: one agent design run per member inside the meeting tool, unless separate Orchestrate agents really shipped (see `docs/submission/tech_statement.md`).

## 6. The demo script

The beats, timings and narration are in `docs/submission/video_script.md` (you own it). The default pitch screen is `web/index.html?run=demo` in pitch mode (`f`).

## 7. Troubleshooting

- **Stale tunnel** (blank live view, "Live API unavailable", Orchestrate tool errors): the quick-tunnel URL changed or the laptop slept. Prefer the Code Engine URL; otherwise restart `make tunnel`, re-export `openapi.json`, re-import.
- **CORS** (browser console says blocked): the API allows `https://sohum-kapoor.github.io`, `null` (file pages) and `http://localhost` / `127.0.0.1` on any port. Other origins (a preview URL, a custom domain) are blocked; open the site from the GitHub Pages URL above. Changing this means an edit in `warmintro/api.py` (SK's lane).
- **Granite rate limit** (slow or failing meetings, 429 in the API log): wait a minute and retry; or switch to the cached run (`?run=demo`) or `LLM_PROVIDER=mock`. Do not run several rounds back to back.
- **409 "a round is already running"**: a round is in flight (rounds take minutes on Granite). Poll `GET <API URL>/runs/latest` until `status` is `complete`, then start another. If the API was restarted mid-round, restart it again (or redeploy) to clear the lock. Note the hosted container's `runs/` and `data/weights.json` reset on restart (ephemeral storage).
- **First scout is slow** on watsonx: it embeds about 600 texts once per container start.

## 8. Never commit `.env`

```bash
git diff --cached | grep -i apikey     # must print nothing, before every commit
git status --short | grep -i "\.env"   # must show nothing
```

IBM scans public repos and suspends accounts for exposed credentials. If a key leaks, tell SK at once so it is revoked.
