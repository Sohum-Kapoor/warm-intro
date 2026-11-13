"""WatsonxLLM with the SDK replaced by fakes: no network, no SDK needed."""

import sys
import types

import pytest

from warmintro.llm import MockLLM, WatsonxLLM, get_llm

VARS = {
    "WATSONX_APIKEY": "k",
    "WATSONX_URL": "https://example.invalid",
    "WATSONX_PROJECT_ID": "p",
    "WATSONX_CHAT_MODEL": "chat-model",
    "WATSONX_EMBED_MODEL": "embed-model",
}


class FakeEmbeddings:
    instances: list["FakeEmbeddings"] = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.calls: list[list[str]] = []
        FakeEmbeddings.instances.append(self)

    def embed_documents(self, texts):
        self.calls.append(texts)
        return [[float(len(t)), 1.0] for t in texts]


class FakeModel:
    reject_response_format = False

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.calls: list[dict] = []

    def chat(self, messages, params=None):
        self.calls.append({"messages": messages, "params": dict(params or {})})
        if self.reject_response_format and "response_format" in (params or {}):
            raise RuntimeError("Unsupported parameter: response_format")
        return {"choices": [{"message": {"content": "hello"}}]}


@pytest.fixture
def sdk(monkeypatch):
    FakeEmbeddings.instances.clear()
    FakeModel.reject_response_format = False
    pkg = types.ModuleType("ibm_watsonx_ai")
    pkg.Credentials = lambda **kw: ("creds", kw)
    fm = types.ModuleType("ibm_watsonx_ai.foundation_models")
    fm.Embeddings = FakeEmbeddings
    fm.ModelInference = FakeModel
    meta = types.ModuleType("ibm_watsonx_ai.metanames")
    meta.EmbedTextParamsMetaNames = types.SimpleNamespace(TRUNCATE_INPUT_TOKENS="truncate_input_tokens")
    for name, mod in [("ibm_watsonx_ai", pkg), ("ibm_watsonx_ai.foundation_models", fm), ("ibm_watsonx_ai.metanames", meta)]:
        monkeypatch.setitem(sys.modules, name, mod)
    for k, v in VARS.items():
        monkeypatch.setenv(k, v)


def test_missing_variables_named_not_valued(sdk, monkeypatch):
    monkeypatch.delenv("WATSONX_PROJECT_ID")
    monkeypatch.delenv("WATSONX_EMBED_MODEL")
    with pytest.raises(RuntimeError) as err:
        WatsonxLLM()
    msg = str(err.value)
    assert "WATSONX_PROJECT_ID" in msg and "WATSONX_EMBED_MODEL" in msg
    assert "WATSONX_APIKEY" not in msg and VARS["WATSONX_APIKEY"] not in msg.replace("WATSONX_APIKEY", "")


def test_embed_passes_texts_and_config(sdk):
    llm = WatsonxLLM()
    assert llm.embed(["ab", "cde"]) == [[2.0, 1.0], [3.0, 1.0]]
    emb = FakeEmbeddings.instances[0]
    assert emb.calls == [["ab", "cde"]]
    assert emb.kwargs["model_id"] == "embed-model"
    assert emb.kwargs["project_id"] == "p"
    assert emb.kwargs["params"] == {"truncate_input_tokens": 512}


def test_chat_puts_system_first(sdk):
    llm = WatsonxLLM()
    msgs = [{"role": "user", "content": "[moderator] go"}, {"role": "assistant", "content": "hi"}]
    assert llm.chat("SYS", msgs) == "hello"
    call = llm._model.calls[0]
    assert call["messages"] == [{"role": "system", "content": "SYS"}, *msgs]
    assert call["params"] == {"temperature": 0, "max_completion_tokens": 300}


def test_context_block_is_stripped_before_the_sdk_call(sdk):
    llm = WatsonxLLM()
    system = (
        "Profile text.\n\nThe line block below is machine-readable context for the meeting tool. "
        'Do not repeat it.\n<context>\n{"task": "vote"}\n</context>'
    )
    llm.chat(system, [])
    sent = llm._model.calls[0]["messages"][0]["content"]
    assert "<context>" not in sent and "task" not in sent and "machine-readable" not in sent
    assert sent == "Profile text."


def test_json_mode_sets_response_format(sdk):
    llm = WatsonxLLM()
    llm.chat("SYS", [], json_mode=True)
    assert llm._model.calls[0]["params"]["response_format"] == {"type": "json_object"}


def test_json_mode_falls_back_once_when_unsupported(sdk):
    FakeModel.reject_response_format = True
    llm = WatsonxLLM()
    assert llm.chat("SYS", [], json_mode=True) == "hello"
    assert len(llm._model.calls) == 2
    assert "response_format" not in llm._model.calls[1]["params"]


def test_other_errors_are_not_retried(sdk):
    llm = WatsonxLLM()

    def boom(messages, params=None):
        raise RuntimeError("401 unauthorized")

    llm._model.chat = boom
    with pytest.raises(RuntimeError, match="401"):
        llm.chat("SYS", [], json_mode=True)


def test_get_llm_watsonx(sdk):
    assert isinstance(get_llm("watsonx"), WatsonxLLM)


def test_mock_works_without_sdk(monkeypatch):
    monkeypatch.setitem(sys.modules, "ibm_watsonx_ai", None)
    assert isinstance(get_llm("mock"), MockLLM)
