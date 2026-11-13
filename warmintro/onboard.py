"""Onboarding: a person's own words become a draft profile their agent proposes (nothing is saved here)."""

import json
import re
from typing import Any

from warmintro.llm import LLM, get_llm

MEMBER_TYPES = ("individual", "startup", "small_business", "corporation")
HUBS = ("detroit", "grand_rapids", "ann_arbor")
ABOUT_MIN, ABOUT_MAX = 20, 1200
UNREADABLE = "Your agent couldn't read that; add a sentence about what you need and what you offer."

SYSTEM_TEMPLATE = """\
You are the AI agent of a person joining a community network that makes warm introductions. \
Turn the text they wrote about themselves into a structured profile. Their name is {name}, \
they are a {type} in the {hub} hub.

Rules:
- Use only what the person wrote. Never invent facts, numbers, customers or names.
- "needs": 1 to 4 short plain-language phrases for what they are looking for, like \
"surface defect inspection for stamped parts" or "an advisor who knows export paperwork".
- "offers": 1 to 4 short plain-language phrases for what they can give others, like \
"a production line for pilots of camera inspection hardware". Each phrase stands on its own, no "we" or "I".
- "sector": a few words, for example "furniture manufacturing".
- "description": 1 or 2 sentences in the third person, starting with {name}.
- "deal_breakers": 0 to 2 short phrases, only things the person said they will not accept. Otherwise [].
- Every needs, offers and deal-breaker item must be something the person clearly stated. Never add vague filler such as "collaboration" or "partnership"; if only one is stated, give one.
- Keep every phrase under 100 characters.

Reply with exactly one JSON object and nothing else:
{{"sector": "...", "description": "...", "needs": ["..."], "offers": ["..."], "deal_breakers": []}}

The line block below is machine-readable context for the tool. Do not repeat it.
<context>
{context}
</context>"""
RETRY_PROMPT = (
    "[moderator] That was not a single valid JSON object with sector, description, needs, offers and "
    "deal_breakers. Reply with only the JSON object now."
)


def _phrases(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = item.strip().rstrip(".") if isinstance(item, str) else ""
        if text and text[:160] not in out:
            out.append(text[:160])
    return out[:limit]


def parse_draft(raw: str) -> dict[str, Any] | None:
    """The model's reply as clean profile fields, or None if it has no readable needs and offers."""
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    needs, offers = _phrases(data.get("needs"), 4), _phrases(data.get("offers"), 4)
    sector, description = data.get("sector"), data.get("description")
    if not needs or not offers or not isinstance(sector, str) or not isinstance(description, str):
        return None
    return {
        "sector": sector.strip()[:60] or "general",
        "description": description.strip()[:400],
        "needs": needs,
        "offers": offers,
        "deal_breakers": _phrases(data.get("deal_breakers"), 2),
    }


def validate_request(body: Any) -> dict[str, str]:
    if not isinstance(body, dict):
        raise ValueError("send a JSON object with name, type, hub and about")
    name, about = body.get("name"), body.get("about")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        raise ValueError("name must be 1 to 80 characters")
    if body.get("type") not in MEMBER_TYPES:
        raise ValueError(f"type must be one of {', '.join(MEMBER_TYPES)}")
    if body.get("hub") not in HUBS:
        raise ValueError(f"hub must be one of {', '.join(HUBS)}")
    if not isinstance(about, str) or not ABOUT_MIN <= len(about.strip()) <= ABOUT_MAX:
        raise ValueError(f"about must be {ABOUT_MIN} to {ABOUT_MAX} characters")
    return {"name": name.strip(), "type": body["type"], "hub": body["hub"], "about": about.strip()}


def draft_profile(body: Any, llm: LLM | None = None) -> dict[str, Any]:
    """Ask the agent for a draft profile; one corrective retry. Raises ValueError (422) if it stays unreadable."""
    req = validate_request(body)
    llm = llm or get_llm()
    context = json.dumps({"task": "onboard", "name": req["name"], "about": req["about"]})
    system = SYSTEM_TEMPLATE.format(name=req["name"], type=req["type"].replace("_", " "),
                                    hub=req["hub"].replace("_", " "), context=context)  # fmt: skip
    messages = [{"role": "user", "content": req["about"]}]
    parsed = None
    for _ in range(2):
        raw = llm.chat(system, messages, json_mode=True)
        parsed = parse_draft(raw)
        if parsed:
            break
        messages = [*messages, {"role": "assistant", "content": raw}, {"role": "user", "content": RETRY_PROMPT}]
    if parsed is None:
        raise ValueError(UNREADABLE)
    return {
        "name": req["name"], "type": req["type"], "hub": req["hub"], **parsed, "intro_budget": 2,
        "permissions": {"share_profile": True, "propose_meetings": True, "contact_member": True},
    }  # fmt: skip
