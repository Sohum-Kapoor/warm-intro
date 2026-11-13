# Warm Intro API for IBM Cloud Code Engine. Ephemeral storage only: runs/ and data/weights.json reset on each restart.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Editable install keeps warmintro.config.ROOT = /app, so data/ and runs/ resolve under /app.
COPY pyproject.toml ./
COPY warmintro/ warmintro/
RUN pip install -e ".[watsonx]"

COPY data/ data/
COPY scripts/ scripts/
# runs/demo.json is the cached demo round the app falls back to.
COPY runs/demo.json runs/demo.json

# Non-root user (Code Engine's Dockerfile guide recommends non-root); it must be able to write runs/ and data/.
RUN useradd --uid 1100 --no-create-home app && chown -R app /app
USER 1100

EXPOSE 8080
# Code Engine sets $PORT (default 8080). Shell form so $PORT expands.
CMD uvicorn warmintro.api:app --host 0.0.0.0 --port ${PORT:-8080}
