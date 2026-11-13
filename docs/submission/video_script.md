# Video script (3:00 maximum)

Narrate throughout. Record from the cached run so nothing is slow on screen. Product on screen: 0:25 to 2:35, which is 130 seconds (the rule is at least 90). Bracketed lines are screen directions. Lines marked **TODO** depend on what the humans confirm in `tech_statement.md`; do not film a claim that is not true.

| Time | On screen | Narration |
| --- | --- | --- |
| 0:00-0:25 | Title card "Warm Intro", then a slide with the two statistics and their sources in small print (see `SOURCES.md`). | "Michigan ranked 49th in population growth in a 2023 state council report, and the University of Michigan is near the top of the rankings for producing startup founders. We grow the talent, and then it leaves, because the people and companies that would give it a reason to stay never find each other. We built Warm Intro: LiDAR for connections. Every member gets an agent that scouts, takes the first meeting, and only tells its person if both sides agree. Everything you will see is synthetic data and AI-generated." |
| 0:25-0:45 | Scan view, full screen: three hubs (Detroit, Grand Rapids, Ann Arbor), members as dots styled by type, the "Synthetic data, AI-generated" label visible. | "This is the scan view. Three Michigan hubs, and every dot is a member: individuals, startups, small businesses and corporations. These are invented. Nobody here is real." |
| 0:45-1:00 | Click "Run a round". The status shows the round starting; hands off the keyboard. | "I click Run a round and take my hands off the keyboard. The scout scores every possible pair on how well one side's needs match the other's offers. Only the few that clear the threshold get a meeting." |
| 1:00-1:30 | Lines appear between dots one at a time, colored by result. Step to the Kestrel Stamping and Lumen Sight meeting (mt001) and open the side panel: transcript, then both votes. | "Meetings light up as the agents hold them. Here a Grand Rapids stamping shop's agent meets a Detroit machine-vision startup's agent. Each speaks only from its own member's profile. The shop can't take an unpaid trial, so they settle on a paid one-line pilot. Both vote yes, each with a reason." |
| 1:30-1:50 | Outbox panel: the two introduction messages for mt001. | "Two yes votes make an introduction, and each agent writes to its own member: who, why, what was discussed, and a next step. Nothing reaches a member without two yes votes." |
| 1:50-2:15 | Step to the Tern Aerial and Priya N. meeting (mt002), a red declined line. Transcript, then the two votes with the "no" reason highlighted. | "Agents that always say yes would be useless. In this meeting the drone startup can only offer equity, and the student's agent holds her deal-breaker of unpaid work. It votes no, and the reason is kept. The agent protected her time." |
| 2:15-2:35 | Use play, pause and step; show the legend and a run stats line (members, meetings, introductions, declines). | "You can pause, step through any meeting, and replay the round. This run: two meetings, one introduction, one decline." |
| 2:35-2:50 | **TODO (confirm first):** Orchestrate chat or agent page, showing the network agent calling scout, meeting and feedback in a trace or tool-call view. Then a quick cut to the Bob chat and `bob-screenshots/jesse/`, and the passing `pytest tools/tests` run. | "A network agent in watsonx Orchestrate runs this loop by calling the scout, meeting and feedback tools. **TODO: edit to match what shipped.** Each member's agent is one agent design run inside the meeting tool, not a separate Orchestrate agent. I built the run-summary tool with IBM Bob, against a spec and tests we wrote first." |
| 2:50-3:00 | End card: repo link, "All data synthetic. Real members must opt in." | "Next: a pilot with one university and one business community. Today everything is synthetic, and real members would opt in. Warm Intro." |

## Notes for the recording

- If Orchestrate is not working by freeze, replace the 2:35-2:50 row with the honest fallback: show `orchestrate/NOTES.md` and say exactly what was and wasn't connected. Do not show a trace that did not happen.
- Both Bob and Orchestrate must be visible on screen, not only mentioned (a site rule).
- Stay under 3:00; judges stop watching at 3:00. Upload so the link is public.
- Check that no key, `.env` content or personal email is visible in any shot.
- The meeting names and numbers above come from `web/fixtures/sample_run.json`. If the film uses a live or cached run from the backend, re-read the real names, votes and counts and edit the narration to match.
