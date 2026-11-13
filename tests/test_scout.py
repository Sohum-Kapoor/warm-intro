import json
from collections import Counter

import pytest

from warmintro import scout as scout_mod
from warmintro.config import get_settings
from warmintro.llm import MockLLM
from warmintro.scout import score_pairs, scout, select_meetings
from warmintro.store import load_members

ROUND_SIZE = 8


@pytest.fixture(scope="module")
def members():
    return load_members()


@pytest.fixture(scope="module")
def demo():
    return json.loads((get_settings().data_dir / "demo.json").read_text())


@pytest.fixture(scope="module")
def scored(members):
    return score_pairs(members, {}, MockLLM())


def _pair(c):
    return frozenset((c["a"], c["b"]))


def _planted(demo):
    return [frozenset(p) for p in demo["yes_pairs"]] + [frozenset(demo["no_pair"])]


def test_fewer_than_ten_percent_pass(scored):
    candidates, stats = scored
    share = stats["passed_filter"] / stats["pairs_scored"]
    assert stats["passed_filter"] == len(candidates)
    assert 0.02 < share < 0.10


def test_planted_pairs_pass_the_filter(scored, demo):
    passing = {_pair(c) for c in scored[0]}
    for pair in _planted(demo):
        assert pair in passing, f"{sorted(pair)} fails the filter"


def test_planted_pairs_make_the_round(scored, demo):
    selected = [_pair(c) for c in select_meetings(scored[0], max_meetings=ROUND_SIZE)]
    for pair in _planted(demo):
        assert pair in selected, f"{sorted(pair)} not in the top {ROUND_SIZE} meetings"


def test_no_member_in_more_than_three_meetings(scored):
    chosen = select_meetings(scored[0])
    counts = Counter(m for c in chosen for m in (c["a"], c["b"]))
    assert max(counts.values()) <= 3


def test_labels_split_about_a_third_unexpected(scored):
    candidates, _ = scored
    share = sum(c["label"] == "unexpected" for c in candidates) / len(candidates)
    assert 0.25 <= share <= 0.5
    assert {c["label"] for c in candidates} == {"unexpected", "complementary"}


def test_candidates_are_sorted_and_have_evidence(scored):
    candidates, _ = scored
    scores = [c["score"] for c in candidates]
    assert scores == sorted(scores, reverse=True)
    for c in candidates:
        assert c["evidence"] and all(e["similarity"] >= get_settings().fit_threshold - 1e-3 for e in c["evidence"])
        assert c["evidence"][0]["need_of"] == c["a"]


def test_weights_change_scores(members, scored):
    top = scored[0][0]
    members_by_id = {m["id"]: m for m in members}
    from warmintro.store import kind_of, weight_key

    key = weight_key(kind_of(members_by_id[top["a"]], members_by_id[top["b"]]), top["label"])
    boosted, _ = score_pairs(members, {key: 1.5}, MockLLM())
    after = next(c for c in boosted if _pair(c) == _pair(top))
    assert after["weight"] == 1.5
    assert after["score"] > top["score"]


def test_cross_hub_bonus_applied(scored):
    for c in scored[0]:
        base = (c["fit"] + 0.15 * c["novelty"]) * c["weight"]
        expected = base * (1.05 if c["cross_hub"] else 1)
        assert c["score"] == pytest.approx(expected, abs=0.01)
    assert any(c["cross_hub"] for c in scored[0])


def test_member_mode_puts_member_first(members, scored):
    candidates, _ = scored
    member_id = candidates[0]["b"]  # a member who is only `b` in the best pair
    result = scout(member_id, members=members, llm=MockLLM())
    assert result and all(c["a"] == member_id for c in result)
    assert any(_pair(c) == _pair(candidates[0]) for c in result)
    assert len(result) <= 10


def test_unknown_member_raises(members):
    with pytest.raises(KeyError, match="m999"):
        scout("m999", members=members, llm=MockLLM())


def test_ask_mode_returns_planted_counterpart_first(members, demo):
    by_id = {m["id"]: m for m in members}
    a_id, b_id = demo["yes_pairs"][0]
    # Reword the planted need: keep the content words, change the framing.
    need = max(by_id[a_id]["needs"], key=lambda n: max(_overlap(n, o) for o in by_id[b_id]["offers"]))
    request = f"Looking for help: {need}"
    result = scout(a_id, request=request, members=members, llm=MockLLM())
    assert result[0]["b"] == b_id
    assert result[0]["evidence"][0]["need"] == request


def _overlap(need, offer):
    from warmintro.llm import tokenize

    return len(set(tokenize(need)) & set(tokenize(offer)))


class CountingLLM:
    model_id = "fake-embed"

    def __init__(self):
        self.calls = []

    def embed(self, texts):
        self.calls.append(list(texts))
        return MockLLM().embed(texts)

    def chat(self, system, messages, json_mode=False):
        raise NotImplementedError


def test_embedding_cache_written_and_reused(members, tmp_path, monkeypatch):
    monkeypatch.setenv("WARMINTRO_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LLM_PROVIDER", "fakeprovider")
    llm = CountingLLM()
    first, _ = score_pairs(members, {}, llm)
    assert len(llm.calls) == 1
    cache_file = tmp_path / ".embeddings_cache" / "fakeprovider-fake-embed.json"
    assert cache_file.exists()

    again, _ = score_pairs(members, {}, llm)
    assert len(llm.calls) == 1  # nothing new to embed
    assert again == first

    scout_mod.embed_texts(llm, ["brand new text"])
    assert llm.calls[-1] == ["brand new text"]
