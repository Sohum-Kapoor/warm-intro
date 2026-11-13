from warmintro import config


def test_defaults(monkeypatch):
    for var in ("WARMINTRO_DATA_DIR", "WARMINTRO_RUNS_DIR", "FIT_THRESHOLD"):
        monkeypatch.delenv(var, raising=False)
    s = config.get_settings()
    assert s.llm_provider == "mock"
    assert s.data_dir == config.ROOT / "data"
    assert s.fit_threshold == config.FIT_THRESHOLD
    assert (s.novelty_weight, s.hub_bonus, s.max_meetings_per_member) == (0.15, 0.05, 3)
    assert config.WEIGHT_MIN == 0.5 and config.WEIGHT_MAX == 1.5


def test_env_overrides(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_PROVIDER", "watsonx")
    monkeypatch.setenv("WARMINTRO_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("FIT_THRESHOLD", "0.5")
    monkeypatch.setenv("WATSONX_PROJECT_ID", "p1")
    s = config.get_settings()
    assert s.llm_provider == "watsonx"
    assert s.data_dir == tmp_path
    assert s.fit_threshold == 0.5
    assert s.watsonx_project_id == "p1"


def test_settings_read_on_every_call(monkeypatch):
    monkeypatch.setenv("FIT_THRESHOLD", "0.1")
    assert config.get_settings().fit_threshold == 0.1
    monkeypatch.setenv("FIT_THRESHOLD", "0.2")
    assert config.get_settings().fit_threshold == 0.2
