"""Suggest real, public Michigan organisations that fit a member's needs. Resources never take part in meetings."""

from warmintro.config import RESOURCE_HUB_BONUS, get_settings
from warmintro.llm import LLM
from warmintro.scout import _cos, embed_texts
from warmintro.store import Member, Resource, ResourceSuggestion


def suggest(member: Member, resources: list[Resource], llm: LLM, k: int = 2) -> list[ResourceSuggestion]:
    """Top k resources serving the member's type, by best cosine between a member need and a helps_with phrase."""
    eligible = [r for r in resources if member["type"] in r["serves"] and r["helps_with"]]
    if not eligible or not member["needs"]:
        return []
    vecs = embed_texts(llm, [*member["needs"], *(p for r in eligible for p in r["helps_with"])])
    minimum = get_settings().resource_min_similarity
    ranked: list[tuple[float, ResourceSuggestion]] = []
    for r in eligible:
        sim, need, phrase = max((_cos(vecs[n], vecs[p]), n, p) for n in member["needs"] for p in r["helps_with"])
        if sim < minimum:
            continue
        bonus = RESOURCE_HUB_BONUS if r["hub"] == member["hub"] else 0.0
        ranked.append((sim + bonus, {
            "resource_id": r["id"], "name": r["name"], "url": r["url"], "hub": r["hub"],
            "category": r["category"], "for_need": need, "matched": phrase, "similarity": round(sim, 3),
        }))  # fmt: skip
    ranked.sort(key=lambda x: -x[0])
    return [s for _, s in ranked[:k]]
