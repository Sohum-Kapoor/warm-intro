# Sources and disclosures

## Data

Every member profile, past connection, transcript and message in this repository is synthetic and was generated for this hackathon. No client data, personal information, social media data or real company or person names are used.

## AI tools used

Keep this list current.

- Claude (Anthropic): planning, the PRD, the repository scaffold.
- Claude Code (Anthropic), running Claude Opus 5.5 with Claude Sonnet subagents: most of the implementation, including the scan view in `web/` and the docs in `docs/submission/`.
- IBM Bob: the pieces listed in `bob-screenshots/` (fill in what each person built). Planned: `scripts/validate_data.py` (SK) and `tools/summarize_run.py` (Jesse). A spec, tests and a Bob prompt exist for the second; the Bob-built implementation and screenshots are not in the repo yet.
- IBM Granite models on watsonx.ai: embeddings and agent text at run time (fill in model ids). Planned: the repo runs on a mock provider by default and does not yet show a shipped watsonx provider.
- watsonx Orchestrate: the network agent. Planned: no Orchestrate agent or export is in the repo yet.

## Statistics in the pitch

Each was checked against its source on Nov 13, 2026.

| Statistic | Source | Status |
| --- | --- | --- |
| Michigan ranks 49th (of 50 states) in population growth | Growing Michigan Together Council final report, Dec 14, 2023. State release: https://www.michigan.gov/leo/news/2023/12/14/growing-michigan-together-council-submits-population-growth-strategy-recommendations . Coverage: https://www.fox17online.com/news/local-news/michigan/council-finds-michigan-is-49th-in-population-growth-submits-strategy-to-lawmakers (council chair quoted: "We're 49th in terms of population growth") | Verified. Cite as "2023 state council report". Do not say "dead last". |
| University of Michigan is 8th in PitchBook's ranking of universities by undergraduate startup founders (2024 edition) | https://poetsandquantsforundergrads.com/news/pitchbooks-2024-top-universities-ranked-by-undergrad-founders/4/ (8th, 860 founders) | Verified for 2024. |
| University of Michigan is 8th in PitchBook's 2026 edition | https://ingeniusprep.com/blog/best-colleges-for-entrepreneurs-2025-rankings-of-top-founder-universities/ (table "Undergraduate founders (PitchBook 2026)", 8th) | Verified only through this secondary page; not checked against PitchBook itself. Safe wording: "top 10 in PitchBook's ranking by undergraduate founders". |
| University of Michigan is "top 10 in the world" for producing startup founders (wording in `docs/PRD.md` pitch table) | None found. Both pages above rank universities in a PitchBook list; neither was checked for whether the list is worldwide or US-only. | UNVERIFIED — do not use in pitch. Drop "in the world". |

## Websites used for data

None.
