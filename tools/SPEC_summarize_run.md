# Spec: `tools/summarize_run.py`

Task J3 [BOB]. This file and `tools/tests/test_summarize_run.py` are the spec. The implementation is built by a person in IBM Bob (see `tools/BOB_PROMPT.md`). Run log shape: `docs/CONTRACTS.md`, example: `web/fixtures/sample_run.json`.

Python 3.11+, standard library only (`json`, `argparse`, `sys`, `pathlib`). No network.

## Interface

```
python tools/summarize_run.py <run.json> [-o out.md]
```

- Reads the run log at `<run.json>`, prints the Markdown summary to stdout. With `-o out.md`, writes it to that file instead and prints nothing on stdout.
- Exit code 0 on success. Exit code 1 on any input error (see Errors). Errors go to stderr as one line starting `error: `; no traceback.

```python
def summarize(run: dict) -> str: ...
def main(argv: list[str] | None = None) -> int: ...   # returns the exit code; `if __name__ == "__main__": sys.exit(main())`
```

`summarize` is pure: no I/O. It raises `ValueError` (with a clear message) when `run` is not a dict or when `run["meetings"]` exists and is not a list. `main` catches that and the file errors and returns 1.

## Output format

Lines are separated by `\n`; the text ends with a single trailing newline. `<...>` is a value.

```
# Run summary: <run_id>

_Synthetic data · AI-generated_

## Stats

- Mode: <mode>
- Members: <n>
- Pairs scored: <n>
- Passed filter: <n>
- Meetings: <n>
- Introductions: <n>
- Declines: <n>
- Blocked by permissions: <n>
- Introduction rate: <pct>
- Decline rate: <pct>

## Meetings

### <meeting id>: <name a> x <name b> (<result>)

- <name a> (<id a>): <vote> - <reason>
- <name b> (<id b>): <vote> - <reason>
```

Rules:

1. **Title** is `# Run summary: ` plus `run_id`, or `unknown` if absent.
2. **Label line** is exactly `_Synthetic data · AI-generated_` (middle dot U+00B7) and is the third line, always, even for an empty run. If the run has `"synthetic": false`, still print the label; the tool never removes it.
3. **Stats** are computed from `meetings`, not copied from `run["stats"]` (that block can disagree with the meetings):
   - `Members` is `len(members)` (0 if missing). `Mode` is `mode`, or `unknown`.
   - `Pairs scored` and `Passed filter` come from `stats.pairs_scored` and `stats.passed_filter`; print `n/a` if missing.
   - `Meetings` is `len(meetings)`.
   - `Introductions` counts meetings whose `result` is `introduced`. `Declines` counts `declined`. `Blocked by permissions` counts `blocked_by_permissions`. Any other or missing result counts toward `Meetings` only.
   - `Introduction rate` is `round(100 * introductions / meetings)` followed by `%`, for example `50%`. `Decline rate` likewise. With zero meetings both are `n/a`.
4. **Meetings** are listed in the order given. Each has an H3 line `### <id>: <A> x <B> (<result>)` where `A` and `B` are the member names looked up by `meeting["a"]` and `meeting["b"]` in `members`; if the id is not in `members`, use the id itself. A missing meeting `id` prints `?`; a missing `result` prints `unknown`.
5. Under each H3 there is a blank line, then two bullets, `a` first, then `b`: `- <name> (<member id>): <vote> - <reason>`. `<vote>` is `yes` or `no` as given. Reasons are printed as given, whitespace collapsed to single spaces so each bullet stays on one line.
6. A blank line separates meetings. No trailing blank lines beyond the single final newline.
7. Transcripts and introduction messages are not included. This is a summary.

### Edge cases

| Case | Behavior |
| --- | --- |
| `meetings` is `[]` or missing | Stats show zeros, both rates `n/a`, and under `## Meetings` the single line `_No meetings in this run._` |
| A vote has no `reason`, or an empty one | `- <name> (<id>): <vote> - (no reason given)` |
| A member has no entry in `votes` | `- <name> (<id>): (no vote recorded)` |
| `votes` missing entirely | both bullets say `(no vote recorded)` |
| Member id not in `members` | the id is used as the name |
| `stats` missing | the two stat lines print `n/a`; the rest is computed |
| Reason contains newlines or Markdown | newlines collapsed to spaces; Markdown left as is |

## Errors (exit code 1, message on stderr, nothing on stdout)

| Condition | Message |
| --- | --- |
| File does not exist or is not readable | `error: cannot read <path>: <reason>` |
| Not valid JSON | `error: <path> is not valid JSON: <parser message>` |
| JSON is not an object (for example a list) | `error: <path> is not a run log (expected a JSON object)` |
| `meetings` present but not a list | `error: <path> is not a run log ("meetings" must be a list)` |
| Cannot write the `-o` file | `error: cannot write <out>: <reason>` |

Missing arguments: argparse's usage message and its exit code 2 are fine.

## Done when

`python3 -m pytest tools/tests -q` passes, and `python3 tools/summarize_run.py web/fixtures/sample_run.json` prints the summary for the sample run. Screenshots of building it in IBM Bob are saved in `bob-screenshots/jesse/`.
