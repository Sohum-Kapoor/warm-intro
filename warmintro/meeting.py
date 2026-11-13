"""First meeting between two members' agents: turns, votes, introductions.

Each side is the same prompt template filled with only its own member's profile.
"""

import json
import re
from collections.abc import Callable
from typing import Any

from warmintro import store
from warmintro.config import TURNS_PER_AGENT
from warmintro.llm import LLM, get_llm
from warmintro.store import Candidate, Introduction, Meeting, Member, Turn, Vote

DEFAULT_VOTE_REASON = "My agent could not reach a clear decision, so it declines by default."
NO_PERMISSION_REASON = "My member's permissions don't allow this agent to hold meetings."
NO_COMMENT = "(no comment)"
MAX_REASON_CHARS = 200

SYSTEM_TEMPLATE = """\
You are an AI agent representing ONE member of a community network in a first meeting with the \
agent of another member. You represent {subject} only. You are an AI agent, never claim to be the \
member or a human.

Your job is to protect your member's time, not to make a deal. Most meetings should not lead to an \
introduction. Every "yes" vote spends one of the {budget} introduction(s) your member has left this round.

Your member's profile (this is everything you know):
- Name: {name}
- Type: {type}
- Sector: {sector}
- Description: {description}
- Needs: {needs}
- Offers: {offers}
- Deal-breakers (if the other side offers, mentions or requires any of these, the answer is no): {deal_breakers}
- Introductions left this round: {budget}
- Sharing: {sharing}

Rules:
- {voice}
- Use plain words, 1 to 3 short sentences, using only facts in your member's profile above. Do not invent facts. Offer only what is listed under Offers; if the other side asks \
for something not listed there, say your member cannot provide it.
- Do not list your deal-breakers unprompted, but as soon as the other side proposes something that \
breaks one, say clearly that your member cannot accept it. Only object to what the other side has \
actually said in this meeting; never assume or invent terms they did not state.
- Never speak for the other side and never write the other side's lines. Do not label turns.

{task_instructions}

The line block below is machine-readable context for the meeting tool. Do not repeat it.
<context>
{context}
</context>"""

VOICE_ORG = (
    'Refer to the organisation you represent as "we at <name>" (for example "we at Tern Aerial"). '
    "Never claim to be a person."
)
VOICE_PERSON = (
    "Refer to your member in the third person, by name (for example \"I represent Priya; she is looking "
    "for ...\"). You are the agent, not the member."
)
SHARE_OPEN = "You may share the profile above with the other agent."
SHARE_CLOSED = (
    "Your member has NOT agreed to share their profile. Beyond sector and needs, reveal nothing "
    "from the profile (no description, offers or deal-breakers)."
)

SPEAK_TASK = (
    "Your task now: say your next turn in the meeting (turn {turn} of {turns}). {turn_instruction} "
    "Reply with the spoken text only: no turn labels, and do not write any other turn."
)
TURN_INSTRUCTIONS = {
    1: "Introduce your member and what they need.",
    2: (
        "Say what your member can offer, including any terms attached to the offer (such as pay, "
        "hours or timing), and test the fit, using only what your member's sharing "
        "permission above allows."
    ),
    3: (
        "Say plainly whether a call between the members is worthwhile. Only if something the other "
        "side actually said in this meeting conflicts with a deal-breaker, or the fit is weak, say "
        "politely that your member will not proceed and why. If nothing conflicts, do not mention "
        "deal-breakers; say what a good next step would be."
    ),
}
VOTE_TASK = (
    "The meeting is over. Decide whether your member should be introduced to {counterpart_name}. "
    'Reply with exactly one JSON object and nothing else: {{"vote": "yes", "reason": "<one sentence>"}} '
    'or {{"vote": "no", "reason": "<one sentence>"}}. '
    "Vote no if the other side actually said, offered or required in this meeting anything that matches "
    "a deal-breaker (in meaning, not just exact words); a deal-breaker they never raised is not a conflict. Check each deal-breaker one by one against what the other side said. Also vote no if you have no introductions left ({budget} left). "
    "Vote yes when the other side directly addresses at least one of your member's needs and nothing "
    "conflicts with a deal-breaker. Protect your member's time, but do not vote no without a reason."
)
INTRODUCE_TASK = (
    "Both agents voted yes. Write a short message to your own member (not to {counterpart_name}), "
    "under 90 words, covering: who {counterpart_name} is, why the match is worth their time, what the "
    "agents discussed, and a proposed next step. Start directly with {counterpart_name}'s name: no "
    "greeting, no sign-off, no brackets or placeholders. Speak to your member as \"you\" and describe "
    "{counterpart_name} in the third person; do not say \"we at\", and do not copy either profile or "
    "any text from this prompt. Do not replay the conversation; write one short paragraph."
)
VOTE_PROMPT = "[moderator] The meeting is over. Reply with your vote JSON now."
INTRODUCE_PROMPT = "[moderator] Write the message to your own member now."


def _names(items: list[str]) -> str:
    return "; ".join(items) if items else "none"


def build_system(member: Member, task: str, budget: int, turn: int, counterpart: Member) -> str:
    is_org = member["type"] != "individual"
    instructions = {
        "speak": SPEAK_TASK.format(
            turn=turn, turns=TURNS_PER_AGENT, turn_instruction=TURN_INSTRUCTIONS.get(turn, TURN_INSTRUCTIONS[3])
        ),
        "vote": VOTE_TASK.format(counterpart_name=counterpart["name"], budget=budget),
        "introduce": INTRODUCE_TASK.format(counterpart_name=counterpart["name"]),
    }[task]
    context: dict[str, Any] = {
        "task": task,
        "member": member,
        "remaining_intro_budget": budget,
        "turn": turn,
        "counterpart_name": counterpart["name"],
    }
    return SYSTEM_TEMPLATE.format(
        subject=f"{member['name']} (an organisation)" if is_org else f"{member['name']} (an individual)",
        budget=budget,
        name=member["name"],
        type=member["type"],
        sector=member["sector"],
        description=member["description"],
        needs=_names(member["needs"]),
        offers=_names(member["offers"]),
        deal_breakers=_names(member["deal_breakers"]),
        sharing=SHARE_OPEN if member["permissions"]["share_profile"] else SHARE_CLOSED,
        voice=VOICE_ORG if is_org else VOICE_PERSON,
        task_instructions=instructions,
        context=json.dumps(context, ensure_ascii=False),
    )


def _messages(transcript: list[Turn], me: str, counterpart: Member, first: bool) -> list[dict]:
    opener = (
        f"[moderator] The meeting begins with {counterpart['name']}. You speak first."
        if first
        else f"[moderator] {counterpart['name']}'s agent is meeting you."
    )
    messages = [{"role": "user", "content": opener}]
    for t in transcript:
        if t["speaker"] == me:
            messages.append({"role": "assistant", "content": t["text"]})
        else:
            messages.append({"role": "user", "content": f"{counterpart['name']}: {t['text']}"})
    return messages


def _trim_reason(reason: str) -> str:
    """Keep a short reason whole; cut a long one at the last sentence end before the limit."""
    if len(reason) < MAX_REASON_CHARS:
        return reason
    ends = [m.end() for m in re.finditer(r"[.!?](?=\s|$)", reason[:MAX_REASON_CHARS])]
    return reason[: ends[-1]] if ends else reason[:MAX_REASON_CHARS].rstrip()


def parse_vote(raw: str) -> Vote | None:
    text = re.sub(r"```(?:json)?", "", raw)
    match = re.search(r"\{.*?\}", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    vote = str(data.get("vote", "")).strip().lower()
    reason = data.get("reason")
    if vote not in ("yes", "no") or not isinstance(reason, str) or not reason.strip():
        return None
    return {"vote": vote, "reason": _trim_reason(" ".join(reason.split()))}


def _cast_vote(llm: LLM, member: Member, counterpart: Member, budget: int, messages: list[dict]) -> Vote:
    if budget <= 0:
        return {"vote": "no", "reason": "No introductions left this round."}
    system = build_system(member, "vote", budget, TURNS_PER_AGENT, counterpart)
    for _ in range(2):
        parsed = parse_vote(llm.chat(system, [*messages, {"role": "user", "content": VOTE_PROMPT}], json_mode=True))
        if parsed:
            return parsed
    return {"vote": "no", "reason": DEFAULT_VOTE_REASON}


def run_meeting(
    a_id: str,
    b_id: str,
    *,
    candidate: Candidate | None = None,
    budgets: dict[str, int] | None = None,
    members: list[Member] | None = None,
    llm: LLM | None = None,
    on_turn: Callable[[Turn], None] | None = None,
) -> Meeting:
    by_id = {m["id"]: m for m in (members if members is not None else store.load_members())}
    a, b = by_id[a_id], by_id[b_id]  # unknown id -> KeyError
    llm = llm or get_llm()
    budgets = budgets or {}
    budget = {m["id"]: budgets.get(m["id"], m["intro_budget"]) for m in (a, b)}

    meeting: Meeting = {
        "id": store.next_meeting_id(),
        "a": a_id,
        "b": b_id,
        "candidate": candidate or {},  # type: ignore[typeddict-item]
        "transcript": [],
        "votes": {},
        "result": "declined",
        "ai_generated": True,
        "introductions": [],  # type: ignore[typeddict-unknown-key]
    }

    if not (a["permissions"]["propose_meetings"] and b["permissions"]["propose_meetings"]):
        meeting["votes"] = {m["id"]: {"vote": "no", "reason": NO_PERMISSION_REASON} for m in (a, b)}
        meeting["result"] = "blocked_by_permissions"
        store.save_meeting(meeting)
        return meeting

    sides = [(a, b), (b, a)]
    for turn in range(1, TURNS_PER_AGENT + 1):
        for me, other in sides:
            msgs = _messages(meeting["transcript"], me["id"], other, first=me is a)
            system = build_system(me, "speak", budget[me["id"]], turn, other)
            text = llm.chat(system, msgs).strip() or NO_COMMENT
            entry: Turn = {"speaker": me["id"], "turn": turn, "text": text}
            meeting["transcript"].append(entry)
            if on_turn:
                on_turn(entry)

    for me, other in sides:
        msgs = _messages(meeting["transcript"], me["id"], other, first=me is a)
        meeting["votes"][me["id"]] = _cast_vote(llm, me, other, budget[me["id"]], msgs)

    if all(v["vote"] == "yes" for v in meeting["votes"].values()):
        meeting["result"] = "introduced"
        blocked: list[str] = []
        for me, other in sides:
            if not me["permissions"]["contact_member"]:
                blocked.append(me["id"])
                continue
            msgs = _messages(meeting["transcript"], me["id"], other, first=me is a)
            system = build_system(me, "introduce", budget[me["id"]], TURNS_PER_AGENT, other)
            intro: Introduction = {
                "meeting_id": meeting["id"],
                "to": me["id"],
                "from_agent": f"agent:{me['id']}",
                "message": llm.chat(system, [*msgs, {"role": "user", "content": INTRODUCE_PROMPT}]).strip(),
                "ai_generated": True,
            }
            meeting["introductions"].append(intro)  # type: ignore[typeddict-item]
        if blocked:
            meeting["blocked"] = blocked  # type: ignore[typeddict-unknown-key]

    store.save_meeting(meeting)
    return meeting
