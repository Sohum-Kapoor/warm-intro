"""Contract defaults and environment-driven settings."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")  # does not override variables already set

FIT_THRESHOLD = 0.30  # mock embeddings: 108 of 1,711 eligible pairs (6.3%) pass
NOVELTY_WEIGHT = 0.15
HUB_BONUS = 0.05
MAX_MEETINGS_PER_MEMBER = 3
BIDIRECTIONAL_BONUS = 0.10
TURNS_PER_AGENT = 3
MAX_MEETINGS_PER_ROUND = 8
WEIGHT_MIN = 0.5
WEIGHT_MAX = 1.5


@dataclass(frozen=True)
class Settings:
    llm_provider: str
    data_dir: Path
    runs_dir: Path
    fit_threshold: float
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
    return Settings(
        llm_provider=env.get("LLM_PROVIDER") or "mock",
        data_dir=Path(env.get("WARMINTRO_DATA_DIR") or ROOT / "data"),
        runs_dir=Path(env.get("WARMINTRO_RUNS_DIR") or ROOT / "runs"),
        fit_threshold=float(env.get("FIT_THRESHOLD") or FIT_THRESHOLD),
        novelty_weight=NOVELTY_WEIGHT,
        hub_bonus=HUB_BONUS,
        max_meetings_per_member=MAX_MEETINGS_PER_MEMBER,
        watsonx_api_key=env.get("WATSONX_APIKEY") or None,
        watsonx_url=env.get("WATSONX_URL") or None,
        watsonx_project_id=env.get("WATSONX_PROJECT_ID") or None,
        watsonx_chat_model_id=env.get("WATSONX_CHAT_MODEL") or None,
        watsonx_embedding_model_id=env.get("WATSONX_EMBED_MODEL") or None,
    )
