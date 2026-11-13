from warmintro import store
from warmintro.config import CONTRAST_NEED_MIN, CONTRAST_OFFER_MAX
from warmintro.llm import get_llm
from warmintro.round import run_round
from warmintro.scout import find_contrasts


def test_contrasts_meet_thresholds_and_are_ordered():
    members = store.load_members()
    by_id = {m["id"]: m for m in members}
    found = find_contrasts(members, get_llm(), top_k=5)
    assert 0 < len(found) <= 5
    for c in found:
        assert c["label"] == "contrast"
        assert c["a"] != c["b"]
        assert all(by_id[i]["permissions"]["propose_meetings"] for i in (c["a"], c["b"]))
        assert c["need_similarity"] >= CONTRAST_NEED_MIN
        assert c["offer_similarity"] <= CONTRAST_OFFER_MAX
        assert c["shared_need"]["a"] in by_id[c["a"]]["needs"]
        assert c["approaches"]["b"] == by_id[c["b"]]["offers"][0]
    gaps = [c["need_similarity"] - c["offer_similarity"] for c in found]
    assert gaps == sorted(gaps, reverse=True)
    assert len(find_contrasts(members, get_llm(), top_k=2)) <= 2


def test_run_log_has_contrasts_in_proactive_mode_only(data_copy):
    proactive = run_round(max_meetings=1)
    assert isinstance(proactive["contrasts"], list) and proactive["contrasts"]
    ask = run_round(request="apprentices for CNC machining", requester="m001")
    assert ask["contrasts"] == []
