PY ?= .venv/bin/python

.PHONY: setup test data round serve

setup:
	test -d .venv || python3 -m venv .venv
	$(PY) -m pip install -e ".[dev]"

test:
	$(PY) -m pytest -q

data:
	$(PY) scripts/generate_data.py

round:
	$(PY) -m warmintro.round

serve:
	$(PY) -m uvicorn warmintro.api:app --port 8000
