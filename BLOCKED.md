# Blocked — needs a person

Newest first. Format: `time — agent id — task — what is needed — who`.

- 12:05 — sk-sohums-macbook-pro-5 — S7, S9 — watsonx.ai values in `.env` (copy `.env.example`): `LLM_PROVIDER=watsonx`, `WATSONX_APIKEY`, `WATSONX_URL`, `WATSONX_PROJECT_ID`, `WATSONX_CHAT_MODEL`, `WATSONX_EMBED_MODEL`. Agents never read `.env`; fill it yourself. Until then everything runs on the mock provider. S7 code is done and tested offline; to finish it, put these in `.env`: `WATSONX_URL` for your region (e.g. https://us-south.ml.cloud.ibm.com), `WATSONX_CHAT_MODEL=ibm/granite-4-h-small`, `WATSONX_EMBED_MODEL=ibm/granite-embedding-278m-multilingual`, `WATSONX_PROJECT_ID` (watsonx project: Manage, General, Details), `WATSONX_APIKEY` (IBM Cloud console, API keys); then run `.venv/bin/python scripts/check_watsonx.py`. Install the SDK with `.venv/bin/pip install -e ".[watsonx]"`. — SK
- 12:05 — sk-sohums-macbook-pro-5 — S8 — watsonx Orchestrate instance access on the hackathon IBM Cloud account (instance URL and an API key for the ADK CLI, or the web UI open). Step-by-step instructions will be in `orchestrate/README.md`. — SK
- 12:05 — sk-sohums-macbook-pro-5 — S10 — IBM Bob trial (https://bob.ibm.com/trial) started, so SK can build `scripts/validate_data.py` in Bob from `scripts/VALIDATE_DATA_SPEC.md` and save screenshots to `bob-screenshots/sk/`. — SK
