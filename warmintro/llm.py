"""LLM provider interface plus a deterministic, offline mock."""

import hashlib
import json
import math
import re
from typing import Any, Protocol

EMBED_DIM = 256
CONTEXT_RE = re.compile(r"<context>\s*(\{.*?\})\s*</context>", re.DOTALL)
# The block plus the sentence introducing it; the real model gets the readable profile instead.
CONTEXT_STRIP_RE = re.compile(
    r"(?:^[^\n]*machine-readable context[^\n]*\n)?[ \t]*<context>.*?</context>[ \t]*", re.DOTALL | re.MULTILINE
)


def strip_context(system: str) -> str:
    return CONTEXT_STRIP_RE.sub("", system).rstrip()

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
        if task == "onboard":
            return self._onboard(ctx)
        raise ValueError(f"unknown task in <context>: {task!r}")

    def _onboard(self, ctx: dict[str, Any]) -> str:
        """Keyword split of the person's sentences into needs, offers and deal-breakers."""
        sentences = [s.strip(" .") for s in re.split(r"[.!?\n]+", ctx.get("about", "")) if s.strip(" .")]
        words = lambda s: set(re.findall(r"[a-z']+", s.lower()))  # noqa: E731
        needs = [s for s in sentences if words(s) & {"need", "needs"} or re.search(r"looking for|want", s, re.I)]
        offers = [s for s in sentences if words(s) & {"offer", "offers", "can", "provide", "provides", "bring"}]
        breakers = [s for s in sentences if words(s) & {"won't", "no", "not"}]
        return json.dumps({
            "sector": " ".join(sentences[0].split()[:4]) if sentences else "general",
            "description": ". ".join(sentences[:2]) + ".",
            "needs": needs[:4], "offers": offers[:4], "deal_breakers": breakers[:2],
        })  # fmt: skip

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


class WatsonxLLM:
    """IBM watsonx.ai (Granite) behind the LLM protocol. Docs checked: orchestrate/NOTES.md."""

    def __init__(self) -> None:
        from warmintro.config import get_settings

        s = get_settings()
        required = {
            "WATSONX_APIKEY": s.watsonx_api_key,
            "WATSONX_URL": s.watsonx_url,
            "WATSONX_PROJECT_ID": s.watsonx_project_id,
            "WATSONX_CHAT_MODEL": s.watsonx_chat_model_id,
            "WATSONX_EMBED_MODEL": s.watsonx_embedding_model_id,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError(f"watsonx provider needs these variables set in .env: {', '.join(missing)}")

        # Lazy so the mock path never needs the SDK.
        from ibm_watsonx_ai import Credentials
        from ibm_watsonx_ai.foundation_models import Embeddings, ModelInference
        from ibm_watsonx_ai.metanames import EmbedTextParamsMetaNames

        credentials = Credentials(url=s.watsonx_url, api_key=s.watsonx_api_key)
        self._embeddings = Embeddings(
            model_id=s.watsonx_embedding_model_id,
            credentials=credentials,
            project_id=s.watsonx_project_id,
            params={EmbedTextParamsMetaNames.TRUNCATE_INPUT_TOKENS: 512},
        )
        self._model = ModelInference(
            model_id=s.watsonx_chat_model_id,
            credentials=credentials,
            project_id=s.watsonx_project_id,
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        return self._embeddings.embed_documents(texts)

    def chat(self, system: str, messages: list[dict], json_mode: bool = False) -> str:
        full = [{"role": "system", "content": strip_context(system)}, *messages]
        # max_tokens is deprecated in the REST docs; max_completion_tokens is current.
        params: dict[str, Any] = {"temperature": 0, "max_completion_tokens": 300}
        if json_mode:
            params["response_format"] = {"type": "json_object"}
        try:
            resp = self._model.chat(messages=full, params=params)
        except Exception as exc:
            if "response_format" not in params or "response_format" not in str(exc).lower():
                raise
            del params["response_format"]
            resp = self._model.chat(messages=full, params=params)
        return resp["choices"][0]["message"]["content"]


def get_llm(provider: str | None = None) -> LLM:
    if provider is None:
        from warmintro.config import get_settings

        provider = get_settings().llm_provider
    if provider == "mock":
        return MockLLM()
    if provider == "watsonx":
        return WatsonxLLM()
    raise ValueError(f"unknown LLM provider: {provider!r}")
