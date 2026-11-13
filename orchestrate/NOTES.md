# Verified IBM facts

Verified IBM facts, with links, gathered 2026-11-13. Re-check anything marked Not verified before relying on it.

## watsonx.ai (Granite) — verified 2026-11-13

Everything below was read from a page opened on 2026-11-13, or observed by running a command today (marked "observed"). Where a page could not be read, it is listed under "Not verified".

### 1. Package

- pip name `ibm-watsonx-ai`, latest 1.9.1. `requires_python` is `<3.15,>=3.11`; classifiers list 3.11, 3.12, 3.13, 3.14. Source: https://pypi.org/pypi/ibm-watsonx-ai/json
- Core deps: requests, httpx (<0.29,>=0.27), urllib3, pandas (>=2.3.3 on Python >=3.14), certifi, lomond, tabulate, packaging, ibm-cos-sdk (<2.15), cachetools. The `rag` extra (langchain etc.) and `mcp` extra are optional; do not install them. Source: same PyPI JSON.
- Observed: `python3 -m venv` (Python 3.14.6) then `pip install ibm-watsonx-ai` succeeded, installed 1.9.1 with pandas 3.1.1, numpy 2.5.4, httpx 0.28.1; venv 161 MB; `import ibm_watsonx_ai` works. So the SDK installs on 3.14 today. Install is heavy (pandas, numpy, ibm-cos-sdk); the REST route in section 6 avoids that.

### 2. Authentication

```python
from ibm_watsonx_ai import APIClient, Credentials
credentials = Credentials(url="https://us-south.ml.cloud.ibm.com", api_key=IAM_API_KEY)
client = APIClient(credentials)
```
Source: https://ibm.github.io/watsonx-ai-python-sdk/v1.9.1/setup_cloud.html

- API key: IBM Cloud console, "API keys" (same page).
- Regional URLs (same page): Dallas `https://us-south.ml.cloud.ibm.com`, Frankfurt `https://eu-de.ml.cloud.ibm.com`, London `https://eu-gb.ml.cloud.ibm.com`, Sydney `https://au-syd.ml.cloud.ibm.com`, Tokyo `https://jp-tok.ml.cloud.ibm.com`, Toronto `https://ca-tor.ml.cloud.ibm.com`, plus AWS-hosted `https://ap-south-1.aws.wxai.ibm.com` and `https://us-east-1.aws.wxai.ibm.com`. Use the region where the service instance was provisioned.
- project_id: a default project or space is required. Find it in the project: Manage, General, Details (same page). With `Embeddings` or `ModelInference`, pass `credentials=` together with `project_id=` (constructor docs below), no APIClient needed.
- Observed: `Credentials.__init__` accepts keyword-only `url`, `api_key`, `token`, `username`, `password`, `instance_id`, `version`, `verify`, etc.

### 3. Embeddings

```python
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import Embeddings
from ibm_watsonx_ai.metanames import EmbedTextParamsMetaNames as EmbedParams

emb = Embeddings(
    model_id=WATSONX_EMBED_MODEL,          # plain string id works
    params={EmbedParams.TRUNCATE_INPUT_TOKENS: 512},
    credentials=Credentials(api_key=KEY, url=URL),
    project_id=PROJECT_ID,
)
vectors = emb.embed_documents(texts=list_of_str)   # -> list[list[float]]
```
Source: https://ibm.github.io/watsonx-ai-python-sdk/v1.9.1/fm_embeddings.html

- Constructor (keyword-only): `Embeddings(*, model_id, params=None, credentials=None, project_id=None, space_id=None, api_client=None, gateway=None, verify=None, batch_size=1000, concurrency_limit=5, max_retries=None, delay_time=None, retry_status_codes=None)`. `batch_size` default 1000 (sync only), `concurrency_limit` default 5, max 10. Same page.
- `embed_documents(texts, params=None, concurrency_limit=5)` returns `list[list[float]]`, one vector per input. `embed_query(text)` returns `list[float]`. Async variants `aembed_documents`, `aembed_query`. Same page.
- Params: `TRUNCATE_INPUT_TOKENS` (int) and `RETURN_OPTIONS` (dict). Same page. REST docs say truncation is from the right (https://cloud.ibm.com/apidocs/watsonx-ai, Text Embeddings request).
- The SDK docs example imports `EmbeddingModels` from `ibm_watsonx_ai.foundation_models.utils.enums`. Observed in 1.9.1: that import raises ImportError (the enums module has `EmbeddingTypes`, with only the two original slate-*-rtrvr ids). Do not use the enum; pass the model id string from the env.
- Max input per text: 512 tokens for ibm/granite-embedding-278m-multilingual (768 dimensions). Source: https://www.ibm.com/docs/en/SSYOK8/wsj/analyze-data/fm-models-embed.html. That page says nothing about handling of over-length input or a per-request batch limit. SDK page says max texts per request "is determined by API" and gives no number.
- Rate limits: the SDK rate-limit page says a limit is per service instance per second and exceeding it returns HTTP 429 (https://ibm.github.io/watsonx-ai-python-sdk/v1.9.1/rate_limit.html). From SDK source for embeddings (https://ibm.github.io/watsonx-ai-python-sdk/v1.6.3/_modules/ibm_watsonx_ai/foundation_models/embeddings/embeddings.html): a token bucket assumes 8 requests/second and adjusts from the `x-requests-limit-rate` header. The 8/s figure is a code comment in the SDK, not a published limit.
- For ~400 short texts: one `embed_documents` call, SDK batches 1000 per call; set `TRUNCATE_INPUT_TOKENS` to avoid 400s on long text.

### 4. Chat

```python
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.foundation_models.schema import TextChatParameters

model = ModelInference(
    model_id=WATSONX_CHAT_MODEL,
    credentials=Credentials(api_key=KEY, url=URL),
    project_id=PROJECT_ID,
    params=TextChatParameters(temperature=0.2, max_tokens=800),
)
resp = model.chat(messages=[
    {"role": "system", "content": system},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."},
])
text = resp["choices"][0]["message"]["content"]
```
Source: https://ibm.github.io/watsonx-ai-python-sdk/v1.9.1/fm_model_inference.html (constructor, `chat(messages, params=None, tools=None, ...)`, return is a dict, text at `choices[0].message.content`, example has a system message then a user message). `params` may be a dict or `TextChatParameters`.

- `ModelInference` keyword-only constructor includes `max_retries=10`, `delay_time=0.5`, `retry_status_codes=[429, 503, 504, 520]`, `validate=True` (validates the model id). Same page.
- `TextChatParameters` fields (all default None): `temperature`, `max_tokens`, `max_completion_tokens`, `top_p`, `seed`, `stop`, `time_limit`, `response_format`, `guided_json`, `guided_choice`, `guided_regex`, `guided_grammar`, others. Source: https://ibm.github.io/watsonx-ai-python-sdk/v1.9.1/fm_schema.html
- REST chat docs: `max_tokens` is deprecated and ignored if `max_completion_tokens` is also set. Source: https://cloud.ibm.com/apidocs/watsonx-ai (Text Chat request body).
- Roles must be lowercase. Source: https://www.ibm.com/docs/en/SSYOK8/wsj/analyze-data/fm-api-chat.html
- If a response is an HTML "Gateway time-out", raise `time_limit` (same page).

JSON mode:
- REST API reference documents `response_format.type` values `text`, `json_object` (JSON with no guaranteed schema), `json_schema` (needs a `json_schema` object), and warns the prompt must also instruct the model to produce JSON or generation can run to the token limit. Source: https://cloud.ibm.com/apidocs/watsonx-ai (Text Chat).
- SDK: `TextChatParameters.response_format` takes a dict or `TextChatResponseFormat(type, json_schema)`. Sources: fm_schema page above; observed in installed 1.9.1 source.
- Granite specifically: the only Granite mention is a sample-notebook blurb on the chat API page ("generate responses in JSON format while chatting with the granite-4-h-small model"). No page I opened states that Granite honors `response_format` reliably, and I did not make an authenticated call. Treat JSON mode as documented for the endpoint but unconfirmed for Granite: implement `json_mode` as (a) pass `response_format={"type": "json_object"}`, (b) also instruct JSON in the system prompt, (c) always parse defensively and retry once on parse failure.

### 5. Model ids available on 2026-11-13

Docs tables:
- Embeddings (https://www.ibm.com/docs/en/SSYOK8/wsj/analyze-data/fm-models-embed.html): `ibm/granite-embedding-278m-multilingual` (512 tokens, 768 dims); `ibm/slate-125m-english-rtrvr-v2` and `ibm/slate-30m-english-rtrvr-v2` (512 tokens, deprecated, withdrawal Aug 8 2026 per the page); `sentence-transformers/all-minilm-l6-v2` (128 tokens, deprecated); `intfloat/multilingual-e5-large` (512, 1024 dims). Page says availability varies by data center.
- Chat (https://www.ibm.com/docs/en/watsonx/saas?topic=solutions-supported-foundation-models): the Granite chat model with an API id and pay-per-token is `ibm/granite-4-h-small` (131,072 context). Other Granite chat/instruct models (granite-4-1-*, granite-3-3-*, etc.) are "deploy on demand" and listed without an API model id.

Observed live, unauthenticated GET on the model-specs endpoint in us-south (`/ml/v1/foundation_model_specs?version=2024-09-16&filters=function_embedding` and `filters=function_text_chat`), 2026-11-13:
- Embedding: granite-embedding-278m-multilingual, slate-125m-english-rtrvr-v2, slate-30m-english-rtrvr-v2, multilingual-e5-large, all-minilm-l6-v2, all `available`.
- Chat: `ibm/granite-4-h-small` is the only Granite model; others returned were meta-llama, mistral, openai/gpt-oss models.
- The `filters=function_text_chat` filter is mentioned on the chat API docs page. I did not open a docs page for the model-specs endpoint itself.

Candidates for the human's .env: `WATSONX_CHAT_MODEL=ibm/granite-4-h-small`, `WATSONX_EMBED_MODEL=ibm/granite-embedding-278m-multilingual`. The human should confirm in their own region and project.

### 6. REST alternative

IAM token (https://www.ibm.com/docs/en/DSXDOC/wsj/getting-started/wx-api-credentials.html and https://www.ibm.com/watsonx/developer/get-started/quick-start via search snippet):
```
POST https://iam.cloud.ibm.com/identity/token
Content-Type: application/x-www-form-urlencoded
grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${APIKEY}
```
Read `access_token` from the JSON. The docs page does not state lifetime; refresh on expiry. Observed: a bad key gives HTTP 400 with `errorCode` BXNIM0415E.

Chat: `POST {WATSONX_URL}/ml/v1/text/chat?version=2024-10-08`, headers `Authorization: Bearer <token>`, `Content-Type: application/json`. Body required fields `model_id`, `messages`; plus `project_id` or `space_id`; optional `temperature`, `max_completion_tokens`, `response_format`, `time_limit`, `stop`, `seed`. Response `choices[0].message.content`, plus `usage`. Sources: https://www.ibm.com/docs/en/SSYOK8/wsj/analyze-data/fm-api-chat.html (version 2024-10-08 in the curl), https://cloud.ibm.com/apidocs/watsonx-ai (body and response fields).

Embeddings: `POST {WATSONX_URL}/ml/v1/text/embeddings?version=<YYYY-MM-DD>`. Body `{"model_id": "...", "project_id": "...", "inputs": ["..."], "parameters": {"truncate_input_tokens": 512}}`. Response fields `model_id`, `results`, `created_at`, `input_token_count`. Vector is `results[i].embedding` (confirmed from SDK source parsing above). Sources: apidocs page (body/response), SDK embeddings source.

`version` value: the API reference says `YYYY-MM-DD` and gives no example for chat or embeddings. Docs curl examples use 2024-10-08 (chat), 2025-02-11 (text generation, on-prem). Observed: installed SDK 1.9.1 ships `API_VERSION_PARAM` = `2026-11-05`, and it is what the SDK sends. Use the doc-shown date or that one; I could not test a successful call without credentials.

### 7. Errors

- SDK retries automatically on 429, 503, 504, 520, up to 10 times, exponential backoff capped at 8 s, 429 retried when a slot frees. Source: https://ibm.github.io/watsonx-ai-python-sdk/v1.9.1/rate_limit.html. Configurable via `max_retries`, `delay_time`, `retry_status_codes`.
- Observed class hierarchy in 1.9.1 `ibm_watsonx_ai.wml_client_error`: `WMLClientError(Exception)`; `ApiRequestFailure(WMLClientError)` with `__init__(error_msg, response, reason=None)`; `AuthenticationError(ApiRequestFailure)`; also `InvalidCredentialsError`, `ExceededLimitOfAPICalls`, `MissingFoundationModel`, `NoWMLCredentialsProvided`, `SpaceIDandProjectIDCannotBeNone`, all subclasses of `WMLClientError`. The docs pages I opened do not list exceptions; this comes from the installed package, not documentation. Catch `WMLClientError` broadly, inspect `ApiRequestFailure.response.status_code`.
- Observed REST error shape (bad token, HTTP 401): `{"errors":[{"code":"authentication_token_not_valid","message":"...","more_info":"https://cloud.ibm.com/apidocs/watsonx-ai#text-chat"}],"trace":"...","status_code":401}`. The API reference lists 400, 401, 500 for embeddings (403/404 for chat appear as headings without descriptions).
- Which exception the SDK raises for a bad model id or a 404: not verified. `ModelInference(validate=True)` checks the model id at construction.
- Rate-limit guidance: construct `APIClient`/`ModelInference`/`Embeddings` once and reuse (SDK best-practices page said, via search snippet, that repeated init sends auth requests and can cause rate-limit errors).

### Not verified

- Any authenticated call (no key available): embeddings and chat successful responses, real return values, and that `version=2024-10-08` or `2026-11-05` is accepted on the embeddings endpoint.
- Whether Granite (`ibm/granite-4-h-small`) honors `response_format=json_object` or `json_schema`; only a notebook blurb was seen.
- Embedding batch size limit and over-length input behavior on the REST side; published rate limits in requests/second (only the SDK code comment of 8/s).
- IAM token lifetime and response field list (docs page names only `access_token`).
- Which SDK exception is raised for model-not-found, and for 401 versus 429 after retries are exhausted.
- cloud.ibm.com/apidocs/watsonx-ai was only partly read (the fetch returned the first ~300k of ~360k characters in slices; the Text Embeddings section and the Authentication/Versioning sections did not appear in the slices read), and dataplatform.cloud.ibm.com pages returned only page chrome via the fetch tool; I used ibm.com/docs mirrors instead.
- Foundation-model lifecycle/regional availability pages were not opened; deprecation dates come from the encoder-models table only.
- The model-specs endpoint results are from a live GET, not from a documentation page.


## watsonx Orchestrate — verified 2026-11-13

All pages below were opened on 2026-11-13 (through a fetch tool that summarizes pages, so quotes are as relayed by that tool; re-check anything load-bearing in the live page). ADK on PyPI at fetch time: `ibm-watsonx-orchestrate` 2.20.0, released 2026-11-11, Python >=3.11,<3.15 ([PyPI](https://pypi.org/project/ibm-watsonx-orchestrate/)).

Doc index (2.x, 521 pages): https://developer.watson-orchestrate.ibm.com/_llms/2-x.txt

### 1. Custom tools

#### 1a. OpenAPI tool (ADK CLI)

Command (source: [Authoring OpenAPI based tools](https://developer.watson-orchestrate.ibm.com/tools/create_openapi_tool)):

```bash
orchestrate tools import -k openapi -f <file-path-or-URL> -a <app-id>
```

- `-k/--kind` required, always `openapi`. `-f/--file` required, local path or a URL. `-a/--app-id` optional, a connection app id, at most one.
- The page says: "The OpenAPI version must be 3.0." It never mentions 3.1. **3.1 is therefore not documented as supported.** FastAPI emits `"openapi": "3.1.0"` (with `anyOf: [{type: X}, {type: null}]` for optional fields). Safest: generate the file, set `openapi` to `3.0.3`, and avoid null-typed unions. (The `anyOf/null` handling is my engineering inference, not in the docs.)
- `servers`: exactly one URL, no parameterization (no `{var}`).
- `operationId`: required on each path; becomes the tool name; snake_case recommended.
- `description`: required on each path; the agent uses it to decide when to call the tool.
- Endpoints must accept and return JSON.
- Older Skills `x-ibm-*` extensions are unsupported (except `x-ibm-orchestrate-meta` and `x-ibm-orchestrate-audience`).
- Auth uses the Connections framework (Basic, Bearer, API Key, OAuth, IDP SSO); one connection per tool. The page does not say a connection is required, and `-a` is marked optional, so an unauthenticated API should import without one. Not tested.
- Public HTTPS: the page does not state that the server URL must be public. See section 6: SaaS cannot reach your internal network, so for SaaS treat a public HTTPS URL as required.
- Timeouts: the OpenAPI page says async tools "can run longer than the 40-second UI execution timeout that applies to synchronous tools". The performance guide says synchronous tools (Python, Langflow, OpenAPI sync, MCP) have a "2 min" maximum per call; async OpenAPI tools "None (via OpenAPI callback syntax)" ([Performance guide, tools](https://developer.watson-orchestrate.ibm.com/tutorials/performance/performance-guide-v2-tools.md)). **The two pages disagree (40 s vs 2 min).** Plan for 40 s. Async needs a header parameter named exactly `callbackUrl`; the service would have to POST the result back, which our API does not do.
- Response size limit: not stated on either page.
- Docs warn that endpoints with large input sets work poorly for agents; keep schemas small.
- Tool display name: since ADK 1.12.0 the OpenAPI `summary` is the display name, falling back to `operationId` (from a search snippet of the release notes; page not opened).

#### 1b. OpenAPI tool (agent builder UI)

I did NOT find an official IBM page with the UI import wording. The only description I found is a partner lab guide ([IBM lab guide](https://ibm.github.io/select-t-partner-market-launchpad/tracks/track-01/labs/lab-101/insurance/use-case-1/lab-guide/), via search snippet, page not opened): Toolset (left nav) > Add tool > OpenAPI > drag in or browse to the spec > wait for "Validation successful" > Next > review tools. A different guide describes a newer menu entry, "Add from file or MCP server" under Add tool. Labels vary by release; the humans should confirm in their instance. Official UI tutorial uses Toolset > Tools > Add tool > "Add from local instance" for tools already in the instance ([Empower tutorial](https://developer.watson-orchestrate.ibm.com/tutorials/tutorial_2_arrows_internal_employees.md)).

#### 1c. Python tool (`@tool`)

Source: [Authoring Python-Based Tools](https://developer.watson-orchestrate.ibm.com/tools/create_tool), [Python dependency management](https://developer.watson-orchestrate.ibm.com/tools/python_dependency_management.md).

```python
from ibm_watsonx_orchestrate.agent_builder.tools import tool
```

```bash
orchestrate tools import -k python -f my_tool.py -r requirements.txt
# multi-file package:
orchestrate tools import -k python -p tools/pkg -f tools/pkg/my_tool.py -r tools/pkg/requirements.txt
```

- Flags: `-k python`, `-f` tool file, `-r` requirements (used in the doc examples, not in its flag list), `-a` connection (repeatable), `-p/--package-root`, `--safe`.
- Type hints plus a Google-style docstring (Args/Returns) generate the schemas.
- Runs inside Orchestrate's own runtime, so no hosting is needed. Packages are installed server-side from `requirements.txt` (pin exact versions). Imports are checked against a tenant allowlist, including transitive dependencies; a missing package fails the import. The CLI also imports your file locally, so those packages must be installed in the local venv.
- Bundling: static files (e.g. CSV) can be packaged and read relative to `__file__`. Max compressed tool size 50 MB. File and folder names: alphanumeric and underscore only; imports inside the package must be relative (`from .utils import x`); only `@tool` functions in the `-f` file are imported.
- Runtime: Python 3.12 only; uv venv; read-only filesystem; 2 vCPU, 2 GB memory; 2 min timeout (performance guide above); keep CPU-bound work to about 50 ms. Standalone tools add 100-300 ms startup.
- Outbound HTTPS from a Python tool: the create_tool page's networking notes say SaaS "cannot reach your internal network". It does not state that public outbound HTTPS works (it is the obvious reading, but not documented). Not verified.

#### 1d. MCP toolkits

Source: [Importing remote MCP toolkits](https://developer.watson-orchestrate.ibm.com/tools/toolkits/remote_mcp_toolkits.md).

```bash
orchestrate toolkits add --kind mcp --name <n> --description <d> --url <url> --transport streamable_http --tools "*"
```

- `--transport` is required: `sse` or `streamable_http`, no fallback. `--app-id` only supports `key_value` connections.
- Tool-list fetch and SSE handshake have a 30 s timeout. Whether the URL must be public is not stated.
- The page does not mention a toolkit-call timeout; the performance guide puts MCP tools at 2 min.
- The UI also supports adding MCP servers ([IBM Docs, MCP servers](https://www.ibm.com/docs/en/SSAVQO/tools/agent_mcp_servers.html)); limits there: tool lists do not refresh (reimport), tools only (no resources or prompts), running tools cannot be cancelled.
- Our FastAPI service is not an MCP server, so this path means extra code. Not recommended for today.

### 2. Defining an agent

#### UI (two official sources, slightly different entry points)

- IBM Docs ([Creating agents](https://www.ibm.com/docs/en/SSAVQO/agent_builder/creating-agents.html)): main menu > **Active inventory > Agents** > on "Build agents and tools" click **Create agent** > **Create from scratch** > enter **Name** and **Description** > **Build** tab > **Behavior > Profile**: choose the AI model and write the **Instructions** > **Tools**: **Add Tool**, pick a tool > test in **Draft Preview** > **Deploy** tab > **Deploy to Live** > in **Deploy > Draft** turn on **Orchestrate Chat** visibility so the agent shows on the Orchestrate Chat home page.
- ADK tutorial ([Empower](https://developer.watson-orchestrate.ibm.com/tutorials/tutorial_2_arrows_internal_employees.md)): on the chat page click **Manage agents** > **Create agent** > **Create from Scratch** > Name, Description > **Create** > **Toolset** > Tools: **Add tool** > **Add from local instance** > select > **Add to agent** > type a test prompt in the chat bar > **Deploy** > back to the chat page and pick the agent from the **Agents** list.

Agent names: snake_case, no spaces ([Descriptions and instructions](https://developer.watson-orchestrate.ibm.com/agents/descriptions.md)).

#### YAML spec

Source: [Authoring native agents](https://developer.watson-orchestrate.ibm.com/agents/build_agent.md). Fields: `spec_version` (v1), `kind` (native default; external; assistant), `name`, `llm`, `style` (examples use `react_core`), `description`, `instructions`, `tools` (list of tool names), `collaborators` (list of agent names), `hide_reasoning`, `memory_enabled`, `is_schedulable`, `knowledge_base`, `restrictions`.

```yaml
spec_version: v1
kind: native
name: warm_intro_agent
llm: groq/openai/gpt-oss-120b
style: react_core
description: |
  Short summary of what the agent does.
instructions: |
  Guidance that controls the agent's behavior.
tools:
  - my_tool
collaborators: []
```

(The first-agent tutorial uses the same pattern: [Hello world tutorial](https://developer.watson-orchestrate.ibm.com/tutorials/tutorial_1_hello_world.md).)

Guidance for instructions: say when and how to call each tool, add error handling, break multi-step logic into sequential steps; for the default gpt-oss model, cap reasoning depth and tell it to ask for missing inputs; models do best with 10 or fewer tools ([Descriptions and instructions](https://developer.watson-orchestrate.ibm.com/agents/descriptions.md)).

#### CLI

Install ([Getting started](https://developer.watson-orchestrate.ibm.com/getting_started/installing.md)):

```bash
python -m venv .venv && source .venv/bin/activate
pip install --upgrade ibm-watsonx-orchestrate
```

Credentials ([Getting credentials](https://developer.watson-orchestrate.ibm.com/environment/production_import.md)): in the Orchestrate web UI, user icon (top right) > **Settings** > **API details** tab: copy the service instance URL, then **Generate API key** (IBM Cloud: redirected to IAM, click Create, name it, copy the key). Use the URL from Settings > API details, not the IBM Cloud resource page.

```bash
orchestrate env add -n <environment-name> -u <service-instance-url> --type ibm_iam --activate
orchestrate env activate <environment-name>                          # prompts for the API key
orchestrate env activate <environment-name> --api-key <your-api-key> # non-interactive
```

(`--type` is only needed if not inferred from the URL: `ibm_iam` for IBM Cloud, `mcsp` for AWS. [Configure remote environments](https://developer.watson-orchestrate.ibm.com/environment/initiate_environment.md).)

Import and deploy ([Importing and deploying agents](https://developer.watson-orchestrate.ibm.com/agents/import_agent.md)):

```bash
orchestrate agents import -f agent.yaml     # lands in DRAFT state; does not deploy
orchestrate agents deploy --name agent_name # draft -> live (5 min default timeout)
orchestrate agents list
orchestrate chat start                      # local chat UI (the tutorial uses it after import)
```

Draft agents show on the Manage Agents page; live agents are reachable through Web chat. Developer Edition has only draft; deploy errors there.

### 3. Models

Source: [Choosing your LLM](https://developer.watson-orchestrate.ibm.com/llm/getting_started_llm.md). Id format is `provider/creator/model`. Listed built-ins:

- `groq/openai/gpt-oss-120b` (default on AWS and IBM Cloud)
- `bedrock/openai.gpt-oss-120b-1:0`
- `watsonx/openai/gpt-oss-120b` (default on AWS GovCloud)
- `azure-openai/gpt-5.4` (Premier, disabled by default, not on trial tenants)
- `bedrock/us.anthropic.claude-sonnet-4-6` (Public Preview, regional)
- `bedrock-mantle/google.gemma-4-31b` (Public Preview)

`orchestrate models list` shows what the tenant actually has. `watsonx/*` models need enabling ([Enabling watsonx/* LLMs](https://developer.watson-orchestrate.ibm.com/llm/watsonx_models.md), page not opened). A `watsonx/ibm/granite-3-8b-instruct` id appeared in the build_agent page's examples, but it is not in the built-in list; do not assume it is available. In the UI the model is picked under Build > Behavior > Profile.

### 4. Collaborators

- YAML: `collaborators` is a list of agent names (native, external, or watsonx Assistants). Default cap is 10 direct collaborators (`WO_MAX_COLLABORATORS` raises it) ([Authoring native agents](https://developer.watson-orchestrate.ibm.com/agents/build_agent.md)).
- Example from the page: `collaborators: [billing_agent, shipping_agent]` with instructions "Decide which collaborator should answer the request, then hand off the question."
- The supervisor routes using each collaborator's `description`, so descriptions must be specific ([Agents overview](https://developer.watson-orchestrate.ibm.com/agents/overview.md), [Descriptions](https://developer.watson-orchestrate.ibm.com/agents/descriptions.md)).
- UI: on the agent's **Toolset** screen, in **Agents** click **Add agent** > **Add from local instance** > select > **Add to agent** ([Empower tutorial](https://developer.watson-orchestrate.ibm.com/tutorials/tutorial_2_arrows_internal_employees.md)). The IBM Docs index also lists "Adding agents from catalog". Import collaborator agents before the agent that references them (my inference).
- The docs do not describe runtime hand-off mechanics, depth limits, or whether a collaborator's own tool timeouts differ.

### 5. Scheduling and triggers

- Scheduling exists. Set `is_schedulable: true` in the agent YAML (off by default; must be enabled when the agent is created). Schedules are then created by a person asking in the Chat UI in natural language (e.g. "every Monday at 9 AM EST"), through interactive forms; users manage only their own schedules ([Scheduling overview](https://developer.watson-orchestrate.ibm.com/scheduling/overview.md), [Enabling scheduling](https://developer.watson-orchestrate.ibm.com/scheduling/enabling.md)).
- Plan or trial availability of scheduling is not stated. No inbound "trigger" page exists in the 2.x index; the nearest is the flow Timer node.
- Honest demo wording: "one message starts the round", optionally "and a schedule can be set up in chat". Do not claim autonomous triggers unless a schedule is actually created and shown running.

### 6. Hosting the service

- **SaaS cannot reach your internal network** (create_tool page networking notes); localhost on a laptop is unreachable. The OpenAPI page does not state a public-URL requirement, but a public HTTPS `servers` URL is the only working option for SaaS. Local tunnels (ngrok etc.) were not researched in the docs and are not covered here.
- **Developer Edition**: `orchestrate server start -e .env` (needs 8 cores, 16 GB RAM min, `WO_INSTANCE` and `WO_API_KEY` or other credentials in `.env`); UI via `orchestrate chat start`; local env via `orchestrate env activate local` ([Developer Edition setup](https://developer.watson-orchestrate.ibm.com/developer_edition/wxOde_setup.md)). The create_tool page says in Developer Edition "localhost refers to the container" and tells you to use a host address (it spells it `docker.host.internal`, which looks like a typo for `host.docker.internal`; unverified) or the host IP. The setup page itself does not discuss calling host services.
- **IBM Cloud Code Engine** (shortest documented path from local source, [Code Engine docs](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-local-source-code)): from the directory containing the source,

```bash
ibmcloud ce application create --name myapp-local --build-source .
ibmcloud ce application get --name myapp-local   # URL: field is the public URL
```

  A project must already be selected (the commands to create or select one were not on the pages I opened; `ibmcloud ce project create/select` is from memory, unverified). Port and Dockerfile/buildpack requirements are not covered on that page. Defaults seen in sample output and the limits page: request timeout 300 s (max 600 s), min scale 0 (cold start possible; the docs do not quantify it), max scale 10 ([Limits](https://cloud.ibm.com/docs/codeengine?topic=codeengine-limits)). The Orchestrate tutorial for Code Engine only covers Docker build/tag commands and does not help here.
- **Python tools inside Orchestrate** avoid hosting entirely (section 1c). They could bundle the mock-provider code and data under a package root and read bundled files via `__file__`, subject to the dependency allowlist, Python 3.12, and read-only filesystem (run output written to disk would fail).

### 7. Hackathon and trial limits

- No official page I opened lists agent, tool or model-count limits for trial or hackathon instances. The 2.x index has no "limits" or "trial" page.
- IBM pricing/catalog search snippets: a 30-day free trial of the Standard plan ([IBM Cloud catalog](https://cloud.ibm.com/catalog/services/watsonx-orchestrate), snippet only).
- Known model restriction: `azure-openai/gpt-5.4` is not available on trial tenants (see section 3).
- Python toolkit `--tier` is Premium-only by default (create_tool page); standalone `@tool` imports are what we would use.

### Recommendation

**Primary (OpenAPI tools to a public deployment).** Deploy the FastAPI service to Code Engine; set the `openapi` field to 3.0.x in the exported file, with one `servers` URL, and an `operationId` and `description` on every operation; import with `orchestrate tools import -k openapi -f openapi.json`; write `agent.yaml` with `llm: groq/openai/gpt-oss-120b` (or whatever `orchestrate models list` shows), `style: react_core`, the imported tool names, and step-by-step instructions (scout, then meeting per pair, then summarize; feedback on request); `orchestrate agents import -f agent.yaml`; `orchestrate agents deploy --name ...`; chat from the UI. Keep the demo on `LLM_PROVIDER=mock` or make `/meeting` fast, because the sync tool timeout is 40 s (UI) or 2 min (performance guide). Alternatively do the same steps in the UI (create agent from scratch, Toolset > Add tool).

**Fallback (no hosting).** Python `@tool` wrappers inside an ADK package that import the mock pipeline and bundled data, run inside Orchestrate; or, if the dependency allowlist blocks it, a Python tool that calls the public Code Engine URL with `requests`/`httpx` (outbound HTTPS undocumented, test early). Last resort: record the round from the web UI and show Orchestrate with a single tool.

**Needs from the humans:**
1. Orchestrate web UI > user icon > Settings > API details: copy the service instance URL; Generate API key (IBM IAM, Create), store it outside git.
2. IBM Cloud: `ibmcloud login`, install the Code Engine plugin, create/select a project, run the `application create` command above, copy the public URL.
3. Run `orchestrate models list` and record the model id to put in `llm:`.
4. Run the import and deploy commands and confirm the Draft Preview chat works; note whether scheduling and the OpenAPI import menu exist on their instance.

### Not verified

- The hackathon guide itself (behind sign-in).
- Official IBM page for the UI OpenAPI import (menu wording came from a partner lab guide in a search snippet; page not opened; the ibm.com `import_openapi.html` guess returned 404).
- Whether OpenAPI 3.1 documents work in practice (docs say 3.0 only; never tested), and how `anyOf`/null schemas are handled.
- Which timeout applies to a synchronous OpenAPI tool (40 s UI figure vs 2 min), and any response-size limit.
- Whether a connection/app-id is truly optional for an unauthenticated API (CLI flag is documented as optional; not executed).
- Whether Python tools in SaaS can make outbound public HTTPS calls, and which packages are on the tenant allowlist (pydantic, fastapi, etc.).
- Whether the Developer Edition can reach host localhost (create_tool page says use a host address, with a suspect spelling).
- Trial/hackathon limits on agents, tools, models; whether scheduling is available on a trial instance.
- Runtime mechanics and limits of collaborator hand-off beyond the 10-collaborator default.
- `ibmcloud ce project create/select` commands, Code Engine port configuration, cold-start latency.
- Whether `watsonx/ibm/granite-*` models are enabled on the hackathon instance.
- Release-notes claim about summary-as-display-name (search snippet only).

## Integration decisions (S8, 2026-11-13)

- **Path chosen: OpenAPI tools over a public URL from a `cloudflared` tunnel.** Orchestrate SaaS cannot reach a laptop, and neither `ibmcloud` nor `docker` is installed on SK's machine while `cloudflared` is: `make tunnel` is one command and prints a public https URL. Rejected for today: Code Engine (needs login, plugin, project and a container build we cannot verify in time); Python `@tool` wrappers (tenant allowlist and read-only filesystem unverified); MCP (our API is not an MCP server).
- **Code Engine is the permanent alternative** if the tunnel is flaky: log in with `ibmcloud login`, select a project (the create/select commands are not on the pages read; unverified), then from the repo directory `ibmcloud ce application create --name warmintro --build-source .` and `ibmcloud ce application get --name warmintro` (the `URL:` field). Port and buildpack/Dockerfile needs are not covered by the docs read. Then re-run `scripts/export_openapi.py --server-url <that URL>`.
- **40 s tool timeout.** The OpenAPI page says synchronous tools have a 40 s UI limit; the performance guide says 2 min. We plan for 40 s: `POST /round` accepts `{"background": true}` and returns `{run_id, status: "running"}` at once, and the agent polls `getLatestRun` until status is `complete`. Async OpenAPI tools need a `callbackUrl` header and a callback we do not implement. `holdMeeting` stays synchronous (mock is instant; a real model may take 20 to 40 s).
- **OpenAPI 3.0 conversion.** The docs require 3.0 and never mention 3.1; FastAPI emits 3.1. `scripts/export_openapi.py` keeps only the six tool operations, sets `openapi: 3.0.3` and one `servers` entry, and rewrites `anyOf` with a null type to `nullable: true`, `examples` to `example`, `const` to a one-value `enum`, drops `$schema`, converts numeric exclusive bounds to the 3.0 boolean form, and drops the 422 responses and the schemas only they used. Whether 3.1 would have worked is untested.
- **Tool names are the operationIds** (`getMembers`, `scout`, `holdMeeting`, `recordFeedback`, `runRound`, `getLatestRun`), camelCase although the docs recommend snake_case; they are fixed by the contract and S6. Not verified that the agent YAML `tools:` list accepts these names for imported OpenAPI tools (the docs say operationId becomes the tool name).
