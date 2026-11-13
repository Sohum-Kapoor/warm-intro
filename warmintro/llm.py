"""LLM provider interface plus a deterministic, offline mock."""

import hashlib
import json
import math
import re
from typing import Any, Protocol

EMBED_DIM = 256
CONTEXT_RE = re.compile(r"<context>\s*(\{.*?\})\s*</context>", re.DOTALL)

# Negators are stop words on purpose: "no unpaid pilots" must match "an unpaid pilot site".
STOP_WORDS = frozenset(
    "a an the and or of to in on at by for from with without we our us you your it its is are be "
    "this that as who no not never only any".split()
)


class LLM(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...

    def chat(self, system: str, messages: list[dict], json_mode: bool = False) -> str: ...


def tokenize(text: str) -> list[str]:
    tokens = [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOP_WORDS]
    return [t[:-1] if len(t) > 3 and t.endswith("s") and not t.endswith("ss") else t for t in tokens]


def _embed_one(text: str) -> list[float]:
    vec = [0.0] * EMBED_DIM
    for token in tokenize(text):
        vec[int(hashlib.sha256(token.encode()).hexdigest()[:8], 16) % EMBED_DIM] += 1.0
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm else vec


def _context(system: str) -> dict[str, Any]:
    match = CONTEXT_RE.search(system)
    if not match:
        raise ValueError("system prompt has no <context> block")
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        raise ValueError(f"<context> block is not valid JSON: {exc}") from exc


def _other_side_text(messages: list[dict]) -> str:
    """What the other agent said: `user` turns, minus moderator notes."""
    return " ".join(
        m["content"]
        for m in messages
        if m.get("role") == "user" and not m["content"].startswith("[moderator]")
    )


def _best_need(needs: list[str], other_tokens: set[str]) -> str | None:
    if not needs:
        return None
    return max(needs, key=lambda n: len(set(tokenize(n)) & other_tokens))


class MockLLM:
    def embed(self, texts: list[str]) -> list[list[float]]:
        return [_embed_one(t) for t in texts]

    def chat(self, system: str, messages: list[dict], json_mode: bool = False) -> str:
        ctx = _context(system)
        task = ctx.get("task")
        if task == "speak":
            return self._speak(ctx)
        if task == "vote":
            return self._vote(ctx, messages)
        if task == "introduce":
            return self._introduce(ctx, messages)
        raise ValueError(f"unknown task in <context>: {task!r}")

    def _speak(self, ctx: dict[str, Any]) -> str:
        member = ctx["member"]
        turn = ctx.get("turn", 1)
        if turn == 1:
            return (
                f"{member['name']} here. {member['description']} "
                f"We need: {'; '.join(member['needs'])}."
            )
        if turn == 2:
            return f"What we offer: {'; '.join(member['offers'])}."
        return "If this fits both sides, a 30-minute call between our members is the right next step."

    def _vote(self, ctx: dict[str, Any], messages: list[dict]) -> str:
        member = ctx["member"]
        other_tokens = set(tokenize(_other_side_text(messages)))
        if ctx.get("remaining_intro_budget", 0) <= 0:
            vote, reason = "no", "No introductions left this round."
        else:
            hit = next(
                (
                    d
                    for d in member["deal_breakers"]
                    if (toks := set(tokenize(d))) and toks <= other_tokens
                ),
                None,
            )
            if hit:
                vote, reason = "no", f"The other side's proposal conflicts with my deal-breaker: {hit}."
            else:
                need = _best_need(member["needs"], other_tokens)
                vote = "yes"
                reason = f"They speak to my need: {need}." if need else "Nothing conflicts with my limits."
        return json.dumps({"vote": vote, "reason": reason})

    def _introduce(self, ctx: dict[str, Any], messages: list[dict]) -> str:
        member = ctx["member"]
        other_text = _other_side_text(messages)
        need = _best_need(member["needs"], set(tokenize(other_text)))
        why = f"it matches your need: {need}" if need else "the two of you look complementary"
        return (
            f"Meet {ctx['counterpart_name']}: {why}. Our agents compared notes and both agreed "
            f"the fit is worth a conversation. Suggested next step: a 30-minute call."
        )


def get_llm(provider: str | None = None) -> LLM:
    if provider is None:
        from warmintro.config import get_settings

        provider = get_settings().llm_provider
    if provider == "mock":
        return MockLLM()
    if provider == "watsonx":
        raise NotImplementedError("watsonx provider arrives in task S7")
    raise ValueError(f"unknown LLM provider: {provider!r}")
