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
  "permissions": {"share_profile": true, "propose_meetings": true, "contact_member": true}
}
```

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

CORS is open for `localhost` so the web page can call it.

## LLM provider (`warmintro/llm.py`)

```python
class LLM(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...
    def chat(self, system: str, messages: list[dict], json_mode: bool = False) -> str: ...
```

`LLM_PROVIDER=mock` (default) is deterministic and offline. `LLM_PROVIDER=watsonx` uses Granite on watsonx.ai, with model ids read from the environment.
