# Deploy the API to IBM Cloud Code Engine (stable URL)

For SK. Goal: `warmintro.api:app` on a public HTTPS URL that does not depend on a laptop. Read from IBM's docs on 2026-11-13; items the docs do not settle are marked **[NOT VERIFIED]**. Container storage is ephemeral: `runs/` and `data/weights.json` reset on every restart or redeploy, which is fine for a demo (the first scout call on watsonx re-embeds about 600 texts because `data/.embeddings_cache` is git-ignored).

Needs: an IBM Cloud account, the public repo `https://github.com/Sohum-Kapoor/warm-intro`, the `Dockerfile` at the repo root (it listens on `$PORT`, default 8080, which is Code Engine's default).

## Console steps

1. Open the Code Engine console: <https://cloud.ibm.com/containers/serverless/overview>. **[NOT VERIFIED]** exact URL; the docs say "open the Code Engine console, then click **Start creating**".
2. **Project.** Projects page > **Create**. Choose a **location** (region), a project name, a resource group, then **Create**. Wait until the project is **Active**. ([Managing projects](https://cloud.ibm.com/docs/codeengine?topic=codeengine-manage-project)) Pick a region near you; any works for the free tier **[NOT VERIFIED]** that every region offers it.
3. In the project: **Application** > **Create**. Name: `warmintro`. Select **Build container image from source code** > **Specify build details**. ([Deploying from source](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-source-code))
4. Source: **Code repo URL** `https://github.com/Sohum-Kapoor/warm-intro`, **Branch** `main`. For a public repo set **Code repo access** to `None`, then **Next**. The docs' own sample is a public GitHub HTTPS URL with access `None`. **[NOT VERIFIED]** The [code repositories page](https://cloud.ibm.com/docs/codeengine?topic=codeengine-code-repositories) says repo URLs must be SSH form for repos that need access; if the console rejects the HTTPS URL for our repo, use `git@github.com:Sohum-Kapoor/warm-intro.git` with a deploy key, or fall back to the CLI.
5. Build strategy: **Dockerfile** (Code Engine builds with BuildKit; it is also the CLI default, Dockerfile path default `Dockerfile`, build context default is the repo root; [Planning your build](https://cloud.ibm.com/docs/codeengine?topic=codeengine-plan-build), [Writing a Dockerfile](https://cloud.ibm.com/docs/codeengine?topic=codeengine-dockerfile)). Build size `medium` (default; 1 vCPU, 4 GB) is enough. **Next**.
6. Container registry: choose the IBM Container Registry location offered (for example `IBM Registry <region>`), **Registry secret** = `Code Engine managed secret`, let Code Engine create the namespace. **Done**. ([source page](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-source-code), steps 9 to 12.)
7. **Secret (do before Create, or add afterwards).** In the project, **Secrets and configmaps** > **Create** > **Generic secret** > **Next**. Name `warmintro-env`. **Add key-value pair** for each, typing the values yourself (never in git, Linear or chat):
   - `LLM_PROVIDER` = `watsonx`
   - `WATSONX_APIKEY`
   - `WATSONX_URL`
   - `WATSONX_PROJECT_ID`
   - `WATSONX_CHAT_MODEL`
   - `WATSONX_EMBED_MODEL`

   Then **Create**. ([Secrets](https://cloud.ibm.com/docs/codeengine?topic=codeengine-secret))
8. Reference the secret: in the application, **Environment variables** tab > **Add** > **Reference full secret** > pick `warmintro-env` (leave prefix empty so the names stay exactly as above) > **Add**, then **Save**. Deploy the change with **New revision** > **Save and deploy**; the app restarts to read new variables. (Same page.) During creation the page only says "modify runtime settings and environment variables", so doing it right after the first deploy is the safe path.
9. **Port.** Nothing to set: the docs say Code Engine assumes port `8080` and sets `PORT` to it ([Application workloads](https://cloud.ibm.com/docs/codeengine?topic=codeengine-application-workloads)); our Dockerfile uses `${PORT:-8080}`. If a different port is ever needed, it is set in the console at deploy time or with `--port`. Leave endpoint visibility on **Public** (the default).
10. **Min instances 1 (no cold start on stage).** App > **Configuration** > **Resources & scaling** > **Autoscaling**: set minimum instances to `1` (max can stay 1 to 2; our round lock is per process, so use max 1 to keep the "round already running" 409 behaviour and one shared `runs/latest`). Click **Deploy** (new revision). ([Configuring application scaling](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-scale)) Default is min 0, which scales to zero and cold-starts (the docs do not quantify the cold start).
    Cost: the docs say apps that scale to zero incur no charges, and that billing follows consumed vCPU and memory (a 1 vCPU, 2 GB app at min scale 1 is billed 1 vCPU-hour and 2 GB-hours per hour). The scale page does not state it directly, but min above 0 keeps an instance running, so you pay for idle time ([pricing](https://cloud.ibm.com/docs/codeengine?topic=codeengine-pricing)). **[NOT VERIFIED]** The free-tier allowance numbers (vCPU-seconds, GB-seconds, requests per month) are not on any docs page I could read; the docs say there is a free tier and point to <https://cloud.ibm.com/codeengine/overview#pricing>. Read that page before leaving min 1 on. Defaults are 1 vCPU and 4 GB; consider lowering to 0.5 vCPU / 1 GB or 2 GB in **Resources & scaling** to stay inside the free tier longer **[NOT VERIFIED]** that combination is valid (see [supported combinations](https://cloud.ibm.com/docs/codeengine?topic=codeengine-limits)). Delete the project or set min back to 0 after the event.
11. Create/deploy. Build takes a few minutes. When the application status is **Ready**, click **Application URL** (or **Test application**). That `https://warmintro.<id>.<region>.codeengine.appdomain.cloud` URL is the stable URL.
12. Test: `curl <url>/health` should return `{"ok":true,"provider":"watsonx"}`. Then `curl <url>/members | head -c 200`. The first `POST /scout` on watsonx embeds about 600 texts once; run one scout call yourself before the pitch so the cache is warm (a restart or new revision empties it again).

## Redeploy after a git push

The build is a snapshot of the branch at build time; a push does not rebuild by itself **[NOT VERIFIED]** (no automatic trigger is described in the pages I read). To rebuild, in the console open the app and use **New revision** with the same source so it rebuilds. **[NOT VERIFIED]** exact console label for "rebuild from source"; the CLI form is documented: `ibmcloud ce application update --name warmintro --rebuild` (requires the app's associated build; each update creates a new revision), or `ibmcloud ce buildrun submit --build <build-name>` and then update the app to the new image. ([CLI reference](https://cloud.ibm.com/docs/codeengine?topic=codeengine-cli))

## CLI alternative (briefly)

Not installed here. Install the CLI and the plugin, then `ibmcloud login` (add `--sso` if you use SSO), `ibmcloud target -g <resource-group>`, `ibmcloud plugin install code-engine` **[NOT VERIFIED]** plugin command and name from memory.

```bash
ibmcloud ce project create --name warmintro-demo        # selects it; or: ibmcloud ce project select --name ...
ibmcloud ce secret create --name warmintro-env \
  --from-literal LLM_PROVIDER=watsonx \
  --from-literal WATSONX_APIKEY=... --from-literal WATSONX_URL=... \
  --from-literal WATSONX_PROJECT_ID=... --from-literal WATSONX_CHAT_MODEL=... --from-literal WATSONX_EMBED_MODEL=...
ibmcloud ce application create --name warmintro \
  --build-source https://github.com/Sohum-Kapoor/warm-intro --build-branch main \
  --build-strategy dockerfile --port 8080 --min-scale 1 --max-scale 1 \
  --env-from-secret warmintro-env
ibmcloud ce application get --name warmintro            # URL field
```

`project create/select`, `--build-strategy dockerfile`, `--port`, `--min-scale`, `--env-from-secret` and `--rebuild` are in IBM's pages ([projects](https://cloud.ibm.com/docs/codeengine?topic=codeengine-manage-project), [CLI](https://cloud.ibm.com/docs/codeengine?topic=codeengine-cli)). **[NOT VERIFIED]** `secret create --from-literal`, `--build-branch` and `--max-scale 1` spellings; run `ibmcloud ce application create --help`. Typing the keys in a shell stores them in shell history; prefer the console.

## After it is Ready

Send the URL to Jesse (a URL is not a secret), fill it into `docs/RUNBOOK.md`, and follow "Stable URL (Code Engine)" in `orchestrate/README.md` to re-export `openapi.json` and re-import it in Orchestrate.
