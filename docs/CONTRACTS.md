# Contracts

These shapes are the boundary between SK's code (`warmintro/`, `data/`, `orchestrate/`) and Jesse's code (`web/`, `tools/`). Both sides build against this file, so neither waits on the other.

**Changing a contract:** edit this file in the same commit as the code change, and post a `CONTRACT:` comment on the Linear Coordination issue saying what changed. Add fields freely; never rename or remove one without that comment.

All files carry `"synthetic": true` at the top level where it applies.

## Member profile — `data/profiles.json` → `{"synthetic": true, "members": [Member]}`

```json
{
  "id": "m001",
  "type": "individual | startup | small_business | corporation",
  "name": "invented name",
  "hub": "detroit | grand_rapids | ann_arbor",
  "sector": "free text, e.g. machine vision",
  "description": "2-3 sentences",
  "needs": ["plain-language need", "..."],
  "offers": ["plain-language offer", "..."],
  "deal_breakers": ["e.g. no unpaid pilots"],
  "intro_budget": 2,
  "permissions": {"share_profile": true, "propose_meetings": true, "contact_member": true},
  "paused": false
}
```

`paused` is optional (absent means false). A paused member is skipped by the scout exactly like `propose_meetings: false`, but can still ask for something through `POST /ask`.

Manufacturers are `small_business` or `corporation` with a manufacturing `sector`.

## History — `data/history.json` → `{"synthetic": true, "connections": [Connection]}`

```json
{
  "id": "h001", "a": "m004", "b": "m031",
  "kind": "individual-startup",
  "label": "complementary | unexpected",
  "cross_hub": false,
  "outcome": "pilot | hire | partnership | no_follow_up",
  "date": "2026-06-02"
}
```

`kind` is the two member types sorted alphabetically and joined with `-`.

## Weights — `data/weights.json`

```json
{"individual-startup|complementary": 1.12, "corporation-startup|unexpected": 0.94}
```

Key is `kind|label`. Value is a multiplier clamped to 0.5–1.5. Missing key means 1.0.

## Scoring (scout)

```
fit      = best need→offer similarity between the pair, either direction (0–1);
           +10% if it works in both directions
novelty  = 1 − similarity(description_a, description_b)        (0–1)
base     = fit + NOVELTY_WEIGHT × novelty      only if fit ≥ FIT_THRESHOLD
score    = base × weight[kind|label] × (1 + HUB_BONUS if cross_hub else 1)
```

Defaults in `warmintro/config.py`: `FIT_THRESHOLD` tuned so roughly 5–10% of pairs pass, `NOVELTY_WEIGHT = 0.15`, `HUB_BONUS = 0.05`, `MAX_MEETINGS_PER_MEMBER = 3`. Label is `unexpected` when novelty is in the top third of passing pairs, else `complementary`.

## Candidate

```json
{
  "a": "m004", "b": "m031",
  "fit": 0.81, "novelty": 0.62, "weight": 1.12, "cross_hub": true,
  "score": 1.06, "label": "unexpected",
  "evidence": [{"need_of": "m004", "need": "...", "offer_of": "m031", "offer": "...", "similarity": 0.81}]
}
```

## Contrast match

Same problem, opposite approach: a pair whose needs are similar (`need_similarity >= CONTRAST_NEED_MIN`) but whose offers are not (`offer_similarity <= CONTRAST_OFFER_MAX`). No meeting is held for it; it is a label the scan view can draw.

```json
{
  "a": "m004", "b": "m031", "label": "contrast",
  "need_similarity": 0.577, "offer_similarity": 0.0,
  "shared_need": {"a": "need of a", "b": "need of b"},
  "approaches": {"a": "first offer of a", "b": "first offer of b"}
}
```

## Meeting

```json
{
  "id": "mt001", "a": "m004", "b": "m031",
  "candidate": { },
  "transcript": [{"speaker": "m004", "turn": 1, "text": "..."}],
  "votes": {
    "m004": {"vote": "yes | no", "reason": "one sentence"},
    "m031": {"vote": "yes | no", "reason": "one sentence"}
  },
  "result": "introduced | declined | blocked_by_permissions"
}
```

Up to three turns per agent, alternating, `a` first. Each agent is prompted with only its own member's profile plus what the other agent has said.

## Introduction

```json
{"meeting_id": "mt001", "to": "m004", "from_agent": "agent:m004", "message": "who, why, what was discussed, proposed next step"}
```

## Run log — `runs/<run_id>.json`, copied to `runs/latest.json`

```json
{
  "synthetic": true,
  "run_id": "2026-11-13T15-02-11",
  "mode": "proactive | ask",
  "request": null,
  "stats": {"pairs_scored": 1770, "passed_filter": 96, "meetings": 8, "introductions": 5},
  "members": [{"id": "m004", "type": "startup", "name": "...", "hub": "detroit", "sector": "..."}],
  "candidates": [ ],
  "meetings": [ ],
  "introductions": [ ],
  "contrasts": [ ],
  "resource_suggestions": {"m004": [ResourceSuggestion]},
  "weights_before": { },
  "weights_after": { }
}
```

`web/fixtures/sample_run.json` is a hand-written example of this shape. The web UI must render it with no backend.

## Resources — `data/resources.json` (real, public; NOT synthetic)

Real Michigan organisations an agent can point a member to. They are resources, not members: they never speak, vote or receive messages. Only the matching is AI-generated. A missing file means no resources.

```json
{"synthetic": false, "note": "...", "resources": [Resource]}
```

```json
{"id": "r01", "name": "...", "hub": "detroit | grand_rapids | ann_arbor | statewide", "category": "...", "serves": ["startup"], "description": "one line", "helps_with": ["2-4 need-like phrases"], "url": "...", "source_page": "...", "terms_note": "..."}
```

**Suggestion** (`warmintro/resources.py: suggest(member, resources, llm, k=2)`): for each resource whose `serves` includes the member's `type`, the best cosine between any member need and any `helps_with` phrase. Resources below the provider minimum (mock 0.2, watsonx 0.65, provisional) are dropped. Ranking adds +0.02 for the member's own hub; the reported `similarity` is the raw cosine. Top k:

```json
{"resource_id": "r01", "name": "...", "url": "...", "hub": "detroit", "category": "...", "for_need": "the member need", "matched": "the helps_with phrase", "similarity": 0.41}
```

The run log's `resource_suggestions` maps each member id that appears in a meeting of the round to their suggestions (`{}` when there are no resources).

## HTTP API (FastAPI, `warmintro/api.py`) — these are also the tools Orchestrate calls

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /members` | | `{"synthetic": true, "members": [Member]}` |
| `POST /scout` | `{"member_id": "m004"}` or `{"request": "plain words", "member_id": "m004"}`, optional `top_k` | `{"candidates": [Candidate]}` |
| `POST /meeting` | `{"a": "m004", "b": "m031"}` | `Meeting` plus `"introductions": [Introduction]` |
| `POST /feedback` | `{"meeting_id": "mt001", "outcome": "pilot"}` | `{"weights_before": {}, "weights_after": {}}` |
| `POST /round` | optional `{"member_ids": [], "max_meetings": 8}` | `Run` |
| `GET /runs/latest` | | `Run` |
| `GET /resources` | | `{"synthetic": false, "note": "...", "resources": [Resource]}` (operationId `getResources`) |
| `GET /members/{member_id}/resources` | | `{"member_id": "m004", "suggestions": [Suggestion], "ai_generated": true}`; 404 for an unknown member (operationId `suggestResources`) |

Member app endpoints (errors are `{"detail": "message"}`: 404 unknown member, 422 invalid input):

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /members/{member_id}` | | `{"synthetic": true, "member": Member}` (operationId `getMember`) |
| `PATCH /members/{member_id}` | any of `needs`, `offers`, `deal_breakers` (up to 6 non-empty strings, each at most 160 characters), `description` (at most 400), `intro_budget` (0 to 5), `permissions` (partial object of the three booleans), `paused` (bool). Other fields are rejected. | `{"synthetic": true, "member": Member}`; written atomically to `data/profiles.json` (operationId `updateMember`) |
| `GET /members/{member_id}/activity` | | `{"synthetic": true, "ai_generated": true, "member_id", "stats": {"agents_met", "meetings", "yes_votes", "no_votes", "introductions"}, "meetings": [{"id", "result", "counterpart": {"id", "name", "type", "hub", "sector"}, "my_vote": Vote, "their_vote": Vote, "transcript": [Turn], "introductions": [Introduction to this member], "candidate": Candidate, "created_at"}], "introductions": [Introduction + "counterpart" + "meeting_id"]}`, both lists newest first (operationId `getMemberActivity`) |
| `POST /ask` | `{"member_id", "request": "1-300 chars", "meet": true, "top_k": 3}` | `{"synthetic": true, "ai_generated": true, "request", "member_id", "candidates": [Candidate], "meeting": Meeting with introductions or null, "note"}`. With `meet` and a candidate, the top candidate gets one meeting, saved like any other. When nobody clears the fit threshold: 200, `candidates: []`, `meeting: null`, and a note (operationId `askAgent`; the only one of these four exported for Orchestrate) |

Onboarding endpoints ("Create your agent"). User-created members are real input, not synthetic, so these responses carry `"synthetic": false`; the rest of the network stays synthetic:

| Method and path | Body | Returns |
| --- | --- | --- |
| `POST /onboard/draft` | `{"name": 1-80 chars, "type": "individual" or "startup" or "small_business" or "corporation", "hub": "detroit" or "grand_rapids" or "ann_arbor", "about": 20-1200 chars}` | `{"synthetic": false, "ai_generated": true, "draft": {name, type, hub, sector, description, needs (1-4), offers (1-4), deal_breakers (0-2), intro_budget: 2, permissions: all true}}`. Nothing is saved. If the agent cannot read the text after one retry: 422 with `detail` "Your agent couldn't read that; add a sentence about what you need and what you offer." (operationId `draftProfile`) |
| `POST /onboard` | a draft as above, possibly edited. `name` (1-80), `sector` (1-60), `type`, `hub`, and the PATCH rules for `needs`, `offers`, `deal_breakers`, `description`, `intro_budget`, `permissions`; needs and offers must be non-empty; all those fields are required | `{"synthetic": false, "member": Member, "first_matches": [Candidate, up to 3, best first, may be empty]}`. Assigns the next id (`m061`, ...), sets `user_created: true`, saves atomically to `data/profiles.json` (operationId `createMember`) |

`Member.user_created` is an optional boolean, true only for members created through `POST /onboard`.

Saved meetings carry an ISO `created_at`; older ones may lack it.

Public-deployment guards (`warmintro/guard.py`; errors are `{"detail": "message"}`):

- `WARMINTRO_ADMIN_KEY` (optional env var), sent as the request header `X-Admin-Key`. When it is set, `PATCH /members/{id}` on a member without `user_created: true` returns **403** `"This is a seeded demo member; edits need the presenter key. Create your own agent to edit freely."` unless the header matches. User-created members stay editable without a key. When it is unset nothing changes.
- `POST /admin/reset` (header `X-Admin-Key`, no body) restores `profiles.json`, `weights.json`, `meetings.json` and `latest.json` to their state at process start and returns `{"ok": true}`. 403 with a wrong or missing key, 404 when no key is configured, 409 while a round runs. Not in the OpenAPI schema.
- Rate limits on `POST /round`, `/ask`, `/meeting`, `/onboard/draft`, `/onboard` and `/scout` with a `request`: 10 per minute per client IP (leftmost `X-Forwarded-For`, else the socket address), `WARMINTRO_HOURLY_LLM_CAP` (default 300) per rolling hour overall, and 60 s between round starts. A valid `X-Admin-Key` skips the per-IP limit only. Over a limit: **429** `"Your agent is busy; try again in N seconds."` with a `Retry-After: N` header. GET endpoints are never limited. `WARMINTRO_RATE_LIMITS=off` disables the limits (tests).
- CORS allows the `X-Admin-Key` request header and exposes `Retry-After`.

CORS is open for `localhost`, `127.0.0.1`, `null` (file://) and `https://sohum-kapoor.github.io` (GET, POST, PATCH) so the web pages can call it.

## LLM provider (`warmintro/llm.py`)

```python
class LLM(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...
    def chat(self, system: str, messages: list[dict], json_mode: bool = False) -> str: ...
```

`LLM_PROVIDER=mock` (default) is deterministic and offline. `LLM_PROVIDER=watsonx` uses Granite on watsonx.ai, with model ids read from the environment.
