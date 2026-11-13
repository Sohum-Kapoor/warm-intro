import json
import math

import pytest

from warmintro.llm import MockLLM, get_llm, tokenize

llm = MockLLM()


def cosine(a: str, b: str) -> float:
    va, vb = llm.embed([a, b])
    return sum(x * y for x, y in zip(va, vb))


def system(task: str, member: dict, **extra) -> str:
    ctx = {"task": task, "member": member, "remaining_intro_budget": 2, "turn": 1, **extra}
    return f"You are an agent.\n<context>\n{json.dumps(ctx)}\n</context>\n"


MEMBER = {
    "name": "Acme Vision",
    "description": "We build cameras.",
    "needs": ["a pilot factory floor", "machine learning engineer"],
    "offers": ["inspection software", "sensor hardware"],
    "deal_breakers": ["no unpaid pilots"],
}


def vote(member: dict, other: str, budget: int = 2, extra: list[dict] | None = None) -> dict:
    msgs = (extra or []) + [{"role": "user", "content": other}]
    raw = llm.chat(system("vote", member, remaining_intro_budget=budget), msgs, json_mode=True)
    return json.loads(raw)


def test_tokenize_drops_stop_words_and_plural_s():
    assert tokenize("No unpaid pilots, without the Business!") == ["unpaid", "pilot", "business"]
    assert tokenize("gas bus ads cats") == ["gas", "bus", "ads", "cat"]  # plural s only when length > 3


def test_embeddings_deterministic_unit_length():
    a, b = llm.embed(["machine vision startup"]), MockLLM().embed(["machine vision startup"])
    assert a == b
    assert len(a[0]) == 256
    assert math.isclose(math.sqrt(sum(x * x for x in a[0])), 1.0)


def test_empty_text_is_zero_vector():
    assert llm.embed([""]) == [[0.0] * 256]


def test_shared_words_score_higher_than_unrelated():
    close = cosine("inspection software for machine vision", "machine vision inspection software")
    far = cosine("inspection software for machine vision", "organic bakery wholesale bread")
    assert close > 0.9
    assert far < 0.3
    assert close > far + 0.5


def test_speak_turns():
    t1 = llm.chat(system("speak", MEMBER, turn=1), [{"role": "user", "content": "[moderator] go"}])
    assert t1 == "Acme Vision here. We build cameras. We need: a pilot factory floor; machine learning engineer."
    t2 = llm.chat(system("speak", MEMBER, turn=2), [])
    assert t2 == "What we offer: inspection software; sensor hardware."
    t3 = llm.chat(system("speak", MEMBER, turn=3), [])
    assert "30-minute call" in t3
    assert "unpaid" not in (t1 + t2 + t3)


def test_vote_no_on_deal_breaker():
    v = vote(MEMBER, "We need an unpaid pilot site.")
    assert v["vote"] == "no"
    assert "no unpaid pilots" in v["reason"]


def test_vote_no_at_zero_budget():
    assert vote(MEMBER, "We offer sensors.", budget=0)["vote"] == "no"


def test_vote_yes_names_best_need():
    v = vote(MEMBER, "We run a factory floor and can host a pilot.")
    assert v["vote"] == "yes"
    assert "a pilot factory floor" in v["reason"]


def test_vote_yes_with_no_needs_or_deal_breakers():
    bare = {**MEMBER, "needs": [], "deal_breakers": []}
    assert vote(bare, "anything")["vote"] == "yes"


def test_vote_ignores_moderator_messages():
    mod = [{"role": "user", "content": "[moderator] unpaid pilot rules apply"}]
    assert vote(MEMBER, "We offer paid sensors.", extra=mod)["vote"] == "yes"


def test_vote_ignores_own_assistant_turns():
    msgs = [{"role": "assistant", "content": "unpaid pilot"}, {"role": "user", "content": "hello"}]
    raw = llm.chat(system("vote", MEMBER), msgs, json_mode=True)
    assert json.loads(raw)["vote"] == "yes"


def test_introduce_names_counterpart():
    msgs = [{"role": "user", "content": "We run a factory floor."}]
    text = llm.chat(system("introduce", MEMBER, counterpart_name="Birch Works"), msgs)
    assert "Birch Works" in text
    assert "call" in text


def test_missing_context_raises():
    with pytest.raises(ValueError, match="context"):
        llm.chat("You are an agent.", [])


def test_bad_context_json_and_unknown_task_raise():
    with pytest.raises(ValueError):
        llm.chat("<context>{nope}</context>", [])
    with pytest.raises(ValueError, match="task"):
        llm.chat(system("dance", MEMBER), [])


def test_get_llm(monkeypatch):
    assert isinstance(get_llm("mock"), MockLLM)
    assert isinstance(get_llm(), MockLLM)  # conftest forces LLM_PROVIDER=mock
    monkeypatch.delenv("WATSONX_APIKEY", raising=False)
    with pytest.raises(RuntimeError, match="WATSONX_APIKEY"):
        get_llm("watsonx")
    with pytest.raises(ValueError):
        get_llm("nope")
