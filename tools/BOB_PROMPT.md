# Prompt for IBM Bob (task J3)

Paste everything in the block below into IBM Bob, in this repo's root folder.

```
Build tools/summarize_run.py for this repo.

Read these first:
- tools/SPEC_summarize_run.md (the spec: CLI, output format, edge cases, errors)
- tools/tests/test_summarize_run.py (the tests it must pass)
- web/fixtures/sample_run.json (an example run log) and docs/CONTRACTS.md (the run log shape)

Rules:
- Python 3.11+, standard library only. No network.
- Define summarize(run: dict) -> str and main(argv=None) -> int, with a CLI: python tools/summarize_run.py <run.json> [-o out.md].
- Do not edit the spec or the tests. If you think they are wrong, tell me instead.
- Touch only tools/summarize_run.py.
- Do not open or print any .env file.

Work test-first: run `python3 -m pytest tools/tests -q`, then write the code until every test passes. Then run `python3 tools/summarize_run.py web/fixtures/sample_run.json` and show me the output.
```

## Before you start

- [ ] Start a Bob session in the repo and keep the chat visible.
- [ ] Screenshot the prompt going in, Bob's plan or code, the first failing test run, and the final passing run.
- [ ] Save screenshots to `bob-screenshots/jesse/` (for example `01-prompt.png`, `02-code.png`, `03-tests-pass.png`).
- [ ] Check that no API key or `.env` content is visible in any image.

## After Bob finishes

```
python3 -m pytest tools/tests -q
python3 tools/summarize_run.py web/fixtures/sample_run.json
```

Commit `tools/summarize_run.py` and `bob-screenshots/jesse/`, then mark SOH-423 Done.
