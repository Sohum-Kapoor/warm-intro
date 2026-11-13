"""Contract defaults and environment-driven settings."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")  # does not override variables already set

FIT_THRESHOLD = 0.30  # mock embeddings: 108 of 1,711 eligible pairs (6.3%) pass
# Per-provider thresholds. Granite cosines run much higher (median best fit 0.60, p95 0.69).
# watsonx 0.68: 117 of 1,711 eligible pairs (6.8%) pass; all four planted pairs (fit 0.91-0.99) pass.
FIT_THRESHOLDS = {"mock": FIT_THRESHOLD, "watsonx": 0.68}
NOVELTY_WEIGHT = 0.15
HUB_BONUS = 0.05
MAX_MEETINGS_PER_MEMBER = 3
BIDIRECTIONAL_BONUS = 0.10
# two turns per agent: Granite drifted and invented terms at three; the contract allows up to three
TURNS_PER_AGENT = 2
MAX_MEETINGS_PER_ROUND = 8
WEIGHT_MIN = 0.5
WEIGHT_MAX = 1.5
CONTRAST_NEED_MIN = 0.35  # same problem: needs at least this similar
CONTRAST_OFFER_MAX = 0.2  # opposite approach: offers no more similar than this
# watsonx: need >= 0.68 (about the top 8% of pairs), offer <= 0.50 (about the 20th percentile band).
CONTRAST_THRESHOLDS = {"mock": (CONTRAST_NEED_MIN, CONTRAST_OFFER_MAX), "watsonx": (0.68, 0.50)}
# Minimum cosine for a resource suggestion. PROVISIONAL: mock is a guess; watsonx not yet tuned on real data.
RESOURCE_MIN_SIMILARITIES = {"mock": 0.2, "watsonx": 0.70}
RESOURCE_HUB_BONUS = 0.02  # ranking tie-break only; the reported similarity stays raw


@dataclass(frozen=True)
class Settings:
    llm_provider: str
    data_dir: Path
    runs_dir: Path
    fit_threshold: float
    contrast_need_min: float
    contrast_offer_max: float
    resource_min_similarity: float
    novelty_weight: float
    hub_bonus: float
    max_meetings_per_member: int
    watsonx_api_key: str | None
    watsonx_url: str | None
    watsonx_project_id: str | None
    watsonx_chat_model_id: str | None
    watsonx_embedding_model_id: str | None


def get_settings() -> Settings:
    """Read the environment on every call so tests can monkeypatch it."""
    env = os.environ
    provider = env.get("LLM_PROVIDER") or "mock"
    need_min, offer_max = CONTRAST_THRESHOLDS.get(provider, CONTRAST_THRESHOLDS["mock"])
    return Settings(
        llm_provider=provider,
        data_dir=Path(env.get("WARMINTRO_DATA_DIR") or ROOT / "data"),
        runs_dir=Path(env.get("WARMINTRO_RUNS_DIR") or ROOT / "runs"),
        fit_threshold=float(env.get("FIT_THRESHOLD") or FIT_THRESHOLDS.get(provider, FIT_THRESHOLD)),
        contrast_need_min=need_min,
        contrast_offer_max=offer_max,
        resource_min_similarity=RESOURCE_MIN_SIMILARITIES.get(provider, RESOURCE_MIN_SIMILARITIES["mock"]),
        novelty_weight=NOVELTY_WEIGHT,
        hub_bonus=HUB_BONUS,
        max_meetings_per_member=MAX_MEETINGS_PER_MEMBER,
        watsonx_api_key=env.get("WATSONX_APIKEY") or None,
        watsonx_url=env.get("WATSONX_URL") or None,
        watsonx_project_id=env.get("WATSONX_PROJECT_ID") or None,
        watsonx_chat_model_id=env.get("WATSONX_CHAT_MODEL") or None,
        watsonx_embedding_model_id=env.get("WATSONX_EMBED_MODEL") or None,
    )
