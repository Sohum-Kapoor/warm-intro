# Build request: `scripts/validate_data.py` (task S10)

Paste this whole file into IBM Bob as the build request. Build to `docs/CONTRACTS.md` (the data shapes are fixed there). Save screenshots of the Bob session to `bob-screenshots/sk/`.

## Goal

A standard-library-only checker that reads the synthetic data files and reports every contract violation and every real-looking name. Tests that hold the implementation to this spec: `tests/test_validate_data.py`.

## Interface

- CLI: `python scripts/validate_data.py [--data-dir DIR]`. Default `DIR` is `data/` (relative to the repo root).
- Importable: `validate(data_dir: Path) -> list[Problem]`.
- `Problem` is a dataclass with fields `level` (`"error"` or `"warn"`), `file` (basename, e.g. `profiles.json`) and `message` (str).
- CLI output: one line per problem, `ERROR <file>: <message>` or `WARN <file>: <message>`, then a summary line `N errors, M warnings`.
- CLI exit code: `0` when there are no errors (warnings allowed), `1` when there is any error.
- No third-party dependencies. Standard library only.

## Errors

**Files**
1. `profiles.json`, `history.json`, `weights.json` each exist and parse as JSON. A missing or unparseable file is one error. Skip the checks that need that file.
2. `profiles.json` and `history.json` have top-level `"synthetic": true` (boolean true).
3. `profiles.json` has a `members` list; `history.json` has a `connections` list; `weights.json` is a JSON object.

**Members (`profiles.json`)**
4. Every member has all contract keys: `id, type, name, hub, sector, description, needs, offers, deal_breakers, intro_budget, permissions`.
5. `type` is one of `individual, startup, small_business, corporation`. `hub` is one of `detroit, grand_rapids, ann_arbor`.
6. `id`, `name`, `sector`, `description` are non-empty strings.
7. `needs` and `offers` are non-empty lists of strings. `deal_breakers` is a list of strings (may be empty).
8. `intro_budget` is an int (not bool) and ≥ 0.
9. `permissions` is an object with boolean `share_profile`, `propose_meetings`, `contact_member`.
10. Member `id` values are unique.

**Connections (`history.json`)**
11. Every connection has all contract keys: `id, a, b, kind, label, cross_hub, outcome, date`. Connection `id` values are unique.
12. `a` and `b` are existing member ids (checked only when `profiles.json` parsed) and `a != b`.
13. `kind` equals the two members' types sorted alphabetically and joined with `-`.
14. `label` is one of `complementary, unexpected`. `outcome` is one of `pilot, hire, partnership, no_follow_up`.
15. `cross_hub` is a boolean and equals `hub(a) != hub(b)`.
16. `date` matches `YYYY-MM-DD` and is a real calendar date.

**Weights (`weights.json`)**
17. Each key is `kind|label`. `label` is `complementary` or `unexpected`. `kind` is two member types joined by `-` in alphabetical order.
18. Each value is a number (not bool) in the closed range 0.5 to 1.5.

**Demo (optional)**
19. If `data/demo.json` exists (the file name is `demo.json` in `--data-dir`) it must parse. Walk it recursively. Any string under a key named `a`, `b` or `member_id`, and any string inside a list under `member_ids`, must be an existing member id. Other content is not checked.

## Warnings (real-looking names)

20. Any string value in `profiles.json`, `history.json` or `demo.json` contains an email address (`local@domain.tld`) or a phone-like number. Phone-like means a 10-digit US number with optional separators, such as `313-555-0142` or `(313) 555 0142`, or an international number starting with `+` and at least 8 digits.
21. A member with `type` `individual` has a name that is not "First L." style: one capitalised first name, a space, and one capital letter followed by a period (`Maya R.`). Hyphens and apostrophes are allowed in the first name.
22. A member with a non-individual type (`startup, small_business, corporation`) has a name containing a denylist phrase. Match case-insensitively on whole words or phrases. The denylist is exactly these 15 well-known Michigan companies and institutions:
    `Ford`, `General Motors`, `Chrysler`, `Dow`, `Herman Miller`, `Steelcase`, `Meijer`, `Whirlpool`, `Kellogg`, `Little Caesars`, `Gordon Food`, `Amway`, `Michigan Medicine`, `University of Michigan`, `Michigan State`.
    The list is data for the checker. It is not a data file.

Warnings never change the exit code.

## Acceptance

- `.venv/bin/python -m pytest -q tests/test_validate_data.py` passes once the implementation exists.
- The repo's own `data/` (once generated) passes with exit 0 and no warnings. If it does not, fix the data, not the rules, and note it in Linear.
- Run with a missing `--data-dir` gives three missing-file errors and exit 1. It does not crash.
