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
  "weights_before": { },
  "weights_after": { }
}
```

`web/fixtures/sample_run.json` is a hand-written example of this shape. The web UI must render it with no backend.

## HTTP API (FastAPI, `warmintro/api.py`) — these are also the tools Orchestrate calls

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /members` | | `{"synthetic": true, "members": [Member]}` |
| `POST /scout` | `{"member_id": "m004"}` or `{"request": "plain words", "member_id": "m004"}`, optional `top_k` | `{"candidates": [Candidate]}` |
| `POST /meeting` | `{"a": "m004", "b": "m031"}` | `Meeting` plus `"introductions": [Introduction]` |
| `POST /feedback` | `{"meeting_id": "mt001", "outcome": "pilot"}` | `{"weights_before": {}, "weights_after": {}}` |
| `POST /round` | optional `{"member_ids": [], "max_meetings": 8}` | `Run` |
| `GET /runs/latest` | | `Run` |

CORS is open for `localhost` so the web page can call it.

## LLM provider (`warmintro/llm.py`)

```python
class LLM(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...
    def chat(self, system: str, messages: list[dict], json_mode: bool = False) -> str: ...
```

`LLM_PROVIDER=mock` (default) is deterministic and offline. `LLM_PROVIDER=watsonx` uses Granite on watsonx.ai, with model ids read from the environment.
