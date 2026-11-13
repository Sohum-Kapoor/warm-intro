import os

# A person's .env may say watsonx; set before warmintro (and load_dotenv) is imported.
os.environ["LLM_PROVIDER"] = "mock"
os.environ["WARMINTRO_RATE_LIMITS"] = "off"  # tests/test_guard.py turns them on

import shutil  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402

REPO_DATA = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(autouse=True)
def runs_dir(tmp_path, monkeypatch):
    path = tmp_path / "runs"
    monkeypatch.setenv("WARMINTRO_RUNS_DIR", str(path))
    return path


@pytest.fixture
def data_copy(tmp_path, monkeypatch):
    """A scratch copy of data/ for tests that write weights."""
    path = tmp_path / "data"
    shutil.copytree(REPO_DATA, path, ignore=shutil.ignore_patterns(".embeddings_cache"))
    monkeypatch.setenv("WARMINTRO_DATA_DIR", str(path))
    return path
