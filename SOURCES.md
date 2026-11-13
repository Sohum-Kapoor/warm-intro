# Sources and disclosures

## Data

Every member profile, past connection, transcript and message in this repository is synthetic and was generated for this hackathon. No client data, personal information or social media data is used, and no real person is named. The one exception is the resources layer (`data/resources.json`): 17 real, public Michigan organisations, each cited from its own public page (listed below). They are resources, not members; they never speak, vote or receive messages. Only the matching of resources to members is AI-generated.

## AI tools used

Keep this list current.

- Claude (Anthropic): planning, the PRD, the repository scaffold.
- Claude Code (Anthropic), with Claude Opus and Claude Sonnet subagents: most of the implementation, including the scan view in `web/` and the docs in `docs/submission/`.
- Claude Desktop computer use (Anthropic): drove IBM Bob for the S10 build and for the J3 approvals. Jesse supervised; Bob wrote the code.
- Gemini (Google): one cross-family code review, run through a command-line tool.
- IBM Bob: `scripts/validate_data.py` (SK, S10) and `tools/summarize_run.py` (Jesse, J3). Screenshots are in `bob-screenshots/`.
- IBM watsonx.ai Granite: `ibm/granite-4-h-small` (chat: agent turns, votes and messages) and `ibm/granite-embedding-278m-multilingual` (embeddings for scoring). `runs/demo.json` is a real Granite run (temperature 0, 2 turns per agent). The mock provider remains the default for tests.
- IBM watsonx Orchestrate: the network agent spec (`orchestrate/warm_intro_network_agent.yaml`) and OpenAPI tool definitions are in `orchestrate/`. Whether the agent was imported and run in Orchestrate is recorded in `docs/submission/tech_statement.md`.

## Statistics in the pitch

Each was checked against its source on Nov 13, 2026.

| Statistic | Source | Status |
| --- | --- | --- |
| Michigan ranks 49th (of 50 states) in population growth | Growing Michigan Together Council final report, Dec 14, 2023. State release: https://www.michigan.gov/leo/news/2023/12/14/growing-michigan-together-council-submits-population-growth-strategy-recommendations . Coverage: https://www.fox17online.com/news/local-news/michigan/council-finds-michigan-is-49th-in-population-growth-submits-strategy-to-lawmakers (council chair quoted: "We're 49th in terms of population growth") | Verified. Cite as "2023 state council report". Do not say "dead last". |
| University of Michigan is 8th in PitchBook's ranking of universities by undergraduate startup founders (2024 edition) | https://poetsandquantsforundergrads.com/news/pitchbooks-2024-top-universities-ranked-by-undergrad-founders/4/ (8th, 860 founders) | Verified for 2024. |
| University of Michigan is 8th in PitchBook's 2026 edition | https://ingeniusprep.com/blog/best-colleges-for-entrepreneurs-2025-rankings-of-top-founder-universities/ (table "Undergraduate founders (PitchBook 2026)", 8th) | Verified only through this secondary page; not checked against PitchBook itself. Safe wording: "top 10 in PitchBook's ranking by undergraduate founders". |
| University of Michigan is "top 10 in the world" for producing startup founders (wording in `docs/PRD.md` pitch table) | None found. Both pages above rank universities in a PitchBook list; neither was checked for whether the list is worldwide or US-only. | UNVERIFIED — do not use in pitch. Drop "in the world". |

## Websites used for real organisation data (`data/resources.json`)

The same names and URLs are in `data/resources.json` (fields `url` and `source_page`).

Date checked: 2026-11-13. Organisation-level public facts only, paraphrased; no individuals; terms of use checked where a terms page was found (TechTown and The Right Place permit home-page links only, so only home pages are linked).

| Organisation | URL | Source page |
| --- | --- | --- |
| TechTown Detroit | https://techtowndetroit.org/ | https://techtowndetroit.org/about/ |
| Detroit Economic Growth Corporation | https://degc.org/ | https://www.degc.org/about |
| Newlab Detroit | https://www.newlab.com/locations/detroit | https://www.newlab.com/locations/detroit |
| Michigan Central | https://michigancentral.com/ | https://michigancentral.com/about/ |
| Detroit at Work | https://detroitatwork.com/ | https://detroitatwork.com/ |
| Automation Alley | https://automationalley.com/ | https://automationalley.com/about/ |
| Wayne State University Division of Research & Innovation | https://research.wayne.edu/ | https://research.wayne.edu/industry-relations |
| The Right Place | https://www.rightplace.org/ | https://www.rightplace.org/ |
| Start Garden | https://startgarden.com/ | https://startgarden.com/programs/ |
| Hello West Michigan | https://www.hellowestmichigan.com/ | https://www.hellowestmichigan.com/ |
| Ann Arbor SPARK | https://www.annarborusa.org/ | https://www.annarborusa.org/ |
| Michigan Economic Development Corporation | https://www.michiganbusiness.org/ | https://www.michiganbusiness.org/ |
| Michigan Small Business Development Center | https://michigansbdc.org/ | https://michigansbdc.org/ |
| The Center (Michigan Manufacturing Technology Center) | https://www.the-center.org/ | https://www.the-center.org/ |
| Michigan Works! Association | https://www.michiganworks.org/ | https://www.michiganworks.org/our-system/ |
| MSU Innovation Center | https://innovationcenter.msu.edu/ | https://innovationcenter.msu.edu/ |
| Michigan Women Forward | https://www.miwf.org/ | https://www.miwf.org/ |
