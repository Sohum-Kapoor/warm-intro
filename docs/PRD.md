# PRD: Warm Intro — Michigan DevFest AI Hackathon

Nov 13, 2026 · SK and Jesse

Living copy: https://claude.ai/artifact/4j4uEAKsqUkb6oMQhnvAtN (this file is a snapshot taken at 11:45 AM ET).

## Hackathon brief

The challenge: use AI and open source to build a proof-of-concept that modernizes a Michigan industry and keeps opportunity rooted here. Scoring is out of 25, five points for each of five criteria, averaged across judges.

**Focus areas:** manufacturing, small business, mobility, agriculture, sustainability, education, urban planning. Warm Intro touches small business, manufacturing, mobility and education.

**Judging criteria (5 points each)**

| Criterion | What judges ask |
| --- | --- |
| Completeness and feasibility | Is it feasible, thought through, and complete as a proof-of-concept? How clear is the use of IBM technology? |
| Creativity and innovation | Is the use of AI original? Is the solution different from what's on the market? |
| Design and usability | Is it well designed and easy to use? Could target users adopt it quickly? |
| Effectiveness and efficiency | Does it address a high-priority issue in the theme? Measurable impact? Can it scale to more users or uses? |
| Michigan impact | Does it keep value, jobs and opportunity in Michigan? Real Michigan challenge, clear business value, working proof-of-concept, strong storytelling. |

**Required technology:** IBM Bob (IBM's AI coding assistant) and watsonx Orchestrate (IBM's platform for building AI agents). The video and the tech statement must show how we used both.

**Rules that shape the build**

- **Deadline conflict:** the site says submissions close Nov 15, 2:00 PM ET. The keynote says 6:00 PM today, with judging at 6:30. Ask an organizer; this plan assumes 6:00 PM today.
- **Teams:** up to 5.
- **IBM Cloud account:** one per team, requested on the site. It closes Nov 24.
- **Data:** no client data, no personal information, nothing from social media. Public website data only if its terms allow commercial use, with a list of sites kept.
- **Secrets:** IBM Cloud credentials found in the repo can get the account suspended immediately. IBM's repo template (https://github.com/watsonxhackathon/ibm-hackathon-template) has `.gitignore` and `.bobignore` safeguards.
- **Judges:** not named on the site.

## Who it's for and the problem

Michigan grows talent, startups and companies, and then loses them, because the people and organizations that would give each other a reason to stay never meet. Warm Intro is for everybody in that ecosystem at once.

- **The hook:** a 2023 state report ranked Michigan 49th in population growth. Meanwhile the University of Michigan is in the top 10 of PitchBook's 2026 ranking of schools by undergraduate startup founders (8th in the 2024 edition).
- **What that means:** students and founders leave for the coasts, and the ideas, companies and jobs leave with them.
- **Who it serves:** everyone in Michigan's economy, treated the same way: individuals, startups, small businesses and manufacturers, and corporations. Every one of them gets its own agent.
- **Why they don't connect today:** people meet whoever is in the same sector, the same room and the same city. A student never meets the startup that would hire them, a startup never meets its first customer, and a small manufacturer never meets the founder who could solve its problem.
- **The end goal:** a thriving ecosystem where everyone is a connection or two from the person they need, so staying in Michigan is the obvious choice and new work starts here.
- **Problem statement:** the connections that would keep people and companies in Michigan already exist in potential, and nobody can see them.
- **Pitch line:** LiDAR for connections. It shows you who is already around you that you can't see.

## Solution and MVP scope

Warm Intro gives every member an agent. The agents scout for each other, hold the first meeting themselves, and bring their people in only when both agents decide the introduction is worth making.

**How one connection happens**

1. **Scout:** every member's agent knows what its member needs and offers. It scans every other member for a fit, in both directions. Scoring is fast arithmetic on embeddings (numeric fingerprints of each need and offer), so every possible pair gets scored, and only the few that clear a threshold ever get a meeting.
2. **Agents meet:** the two members' agents hold a short conversation, each arguing from its own member's goals and limits. Any pairing works: manufacturer and startup, startup and individual, corporation and startup.
3. **Both decide:** each agent votes yes or no and gives its reason. Two yes votes make an introduction; anything else ends there, and the reason is kept.
4. **People are told:** each agent messages its own member with the summary of the meeting and a proposed next step.
5. **The network learns:** how the connection turns out feeds back into which meetings agents take next.

**Two ways in**

- **Proactive:** agents scout and meet on their own, without being asked.
- **On request:** a member tells its agent what it wants ("find me someone who can do machine vision for inspection") and the agent goes looking the same way.

**How it scores a possible connection**

- **Fit:** how well one side's needs match the other's offers. This is most of the score.
- **Novelty:** a bonus when the two profiles are far apart, so a manufacturer meets a drone startup, not another manufacturer.
- **Learned weights:** kinds of connection that worked before score higher.
- **Cross-hub:** a small bonus when the two members are in different hubs (Detroit, Grand Rapids, Ann Arbor). It is capped low on purpose, so it can break a tie but never outrank a strong connection inside one community.

**What agents are allowed to do**

- Each member sets its agent's permissions once: what it may share, and whether it may propose meetings.
- An agent contacts only its own member, and only after both agents vote yes.
- There is no manager and no approval step per introduction.

**Goals**

- One full connection runs on its own, end to end, through watsonx Orchestrate by 4:30 PM: scout, agent meeting, two votes, messages to both members.
- The demo shows one meeting that ends in yes and one that ends in no, with reasons.
- An outcome visibly changes what the agents do next.

**Non-goals**

- Contacting real people. Every member today is synthetic, and messages land in a demo outbox.
- Real company or person names in the data.
- Claiming the learning is proven. The history is synthetic; the mechanism is real.
- Accounts, logins, calendars or email integration.

## Requirements

P0 is what the demo must show. P1 gets built only if P0 works end to end by 4:30 PM. Build the core with whatever is fastest; each teammate builds at least one real piece with IBM Bob and screenshots it. In P0, "each member's agent" is one agent design run with that member's profile, goals and permissions.

| ID | Priority | Requirement |
| --- | --- | --- |
| R1 | P0 | **Profiles:** one JSON file of about 60 synthetic members: an even mix of individuals (students and professionals), startups, small businesses and manufacturers, and corporations. Each has a type, hub (Detroit, Grand Rapids or Ann Arbor), sector, description, needs, offers, deal-breakers, an introduction budget, and its agent's permissions. |
| R2 | P0 | **Scout tool:** embed every need and offer with a Granite model on watsonx.ai. Score each possible pair on fit, plus a novelty bonus, plus learned weights, plus a cross-hub bonus capped at about 5% of the score. This is the pre-filter: only pairs above a fit threshold qualify, and each member gets at most three meetings per round, so the great majority of possible pairs never meet. |
| R3 | P0 | **Ask mode:** the scout also takes a request in plain words, treats it as a one-off need, and ranks the same way. |
| R4 | P0 | **Meeting tool:** runs the first meeting between two members' agents. Each agent speaks only from its own member's profile and goals, for up to three turns each, then votes yes or no with a one-sentence reason. Each agent's instruction is to protect its member's time, not to make a deal: it holds the member's deal-breakers and a small budget of introductions it may accept per round, so every yes costs something. Returns the transcript and both votes. |
| R5 | P0 | **Introduction:** on two yes votes, each agent writes a message to its own member: who, why, what was discussed, a proposed next step. Messages go to a demo outbox. An agent whose member's permissions don't allow it says so and stops. |
| R6 | P0 | **Learning loop:** a seeded history of about 40 synthetic past connections with outcomes, kept as a small table of weights per kind of connection. New outcomes and the reasons behind no votes update it, and the next scout run reflects that. |
| R7 | P0 | **Orchestrate agent:** a network agent in watsonx Orchestrate runs the loop: calls the scout, convenes meetings, sends introductions, records outcomes. It runs a round without being asked and also answers requests. |
| R8 | P0 | **Watchable:** the meeting transcript and both votes are shown as they happen. The demo is people watching agents talk. |
| R9 | P0 | **Bob evidence:** each teammate's IBM Bob screenshots in the repo, captured as the hackathon guide describes. |
| R10 | P0 | **Honesty:** everything is marked AI-generated, and the members and history are marked synthetic wherever they appear. |
| R11 | P1 | **Scan view:** a web page that draws the three hubs as a network, with meetings lighting up between members as agents hold them. This is the LiDAR picture and the best use of spare time. |
| R12 | P1 | **Real separate agents:** member agents built as their own Orchestrate agents (one per member type) that the network agent hands off to, instead of one tool playing both sides. |
| R13 | P1 | **Contrast matches:** a label for members working on the same problem with opposite approaches. |
| R14 | P1 | **Pushed updates:** a daily digest from each agent to its member. |

## Architecture and sponsor tools

Each member has an agent. A network agent in watsonx Orchestrate runs the loop: it calls the scout to pick who should meet, the meeting tool to let the two members' agents talk and vote, and the feedback tool to record how it went.

Diagram, in words: members' agents (one per member) talk to the network agent (watsonx Orchestrate). The network agent calls three tools: scout (fit, novelty, small hub bonus), meeting (two agents talk, both vote), feedback (outcomes change weights). The tools read and update the profiles and history files and call Granite models on watsonx.ai for embeddings and writing. Members are told only after two yes votes.

| Tool | Required? | Job in the project |
| --- | --- | --- |
| watsonx Orchestrate | Yes | Hosts the network agent that runs scouting, meetings and introductions; with R12, hosts the member agents too |
| IBM Bob | Yes | Each teammate builds at least one real piece with it; screenshots go in the repo |
| Granite on watsonx.ai | No, but it's IBM technology | Embeddings for scoring; text generation for what each member's agent says, its vote, and its message to its member |
| Code Engine | No | Hosts the tools if Orchestrate needs them at a public URL |
| Any web framework, or Lovable | No | Only for the scan view |

In the tech statement, describe the agent layer as it is actually built. In P0, the member agents are one agent design run once per member inside the meeting tool, each with only its own member's profile; they are separate Orchestrate agents only if R12 ships. Not yet verified: how Orchestrate connects to custom tools and hands off between agents. Confirm that in the official docs and the hackathon guide before writing the integration.

## Data plan and data rules

All data is synthetic and says so. The site bars client data and personal information, and the repo is public at submission.

- **Profiles (about 60):** an even mix of individuals, startups, small businesses and manufacturers, and corporations, spread across Detroit, Grand Rapids and Ann Arbor.
- **Connection history (about 40):** invented past connections between those profiles, each with an outcome such as pilot started, hired, or no follow-up. This seeds the learning loop.
- **No real names.** Invented companies and people only, such as "a 60-person stamping supplier in Grand Rapids."
- **Plant the demo.** Hand-write the profiles the demo touches: three pairs of different kinds whose meetings should end in yes, and one pair that should end in no.
- **Secrets:** keys go in a git-ignored `.env` file; an exposed IBM Cloud credential can suspend the team's account.
- **Sources file:** `SOURCES.md` lists every AI tool used, states that all profiles and history are synthetic, and links the sources for the pitch's statistics.

## How this scores

This direction is strongest on Michigan impact and creativity. The risk sits in completeness: an autonomous agent loop is harder to finish and to make reliable than a single assistant.

| Criterion (5 points each) | Our case | Watch out for |
| --- | --- | --- |
| Completeness and feasibility | IBM technology is the whole stack: Orchestrate runs the loop, Granite powers every agent, Bob helped build it | One connection running end to end beats a bigger half-working network. Show Orchestrate calling each tool. |
| Creativity and innovation | Agents that take the first meeting for you, and vote, are not how people connect today | Agents that always say yes look fake. Show a no, with its reason. |
| Design and usability | Members do nothing until there is something worth their time | A text transcript is the minimum; the scan view (R11) is what makes it look like LiDAR |
| Effectiveness and efficiency | Every member gets a scout it could never staff, whether a student, a startup, a small manufacturer or a corporation | Have an answer for "why would a busy person trust this?": permissions, and nothing reaches them without two yes votes |
| Michigan impact | Aims at why people and companies leave: a connected ecosystem gives talent, startups and businesses reasons to stay and grow here | Lead with the 49th-in-growth figure and name its source and year |

## Build plan

This plan assumes the 6:00 PM deadline from the keynote. See `tasks/SK.md` and `tasks/JESSE.md` for the actual split; the checkpoints are:

| By | Checkpoint |
| --- | --- |
| 1:00 PM | Data generated; scout returns ranked candidates locally; meeting prompt works; scan view renders the sample run |
| 3:00 PM | Scout, meeting and feedback tools wired together; Orchestrate agent calls them |
| 4:30 PM | A full round runs with nobody typing; one outcome changes the next run; a planted pair ends in no |
| 5:00 PM | Feature freeze. Bob screenshots and `SOURCES.md` in the repo |
| 5:30 PM | Video uploaded; statements written |
| 5:45 PM | Repo made public after a secrets check; team lead submits |

**Cut order if behind:** P1 items first. Then ask mode. Then the seeded history (keep one live outcome changing the next run). Then the novelty and hub bonuses (keep fit). Never cut the Orchestrate network agent, the Bob screenshots, or the agent meeting with its two votes.

## Pitch and demo

The live pitch is three minutes at 6:30 PM.

| Time | Part | What we say or show |
| --- | --- | --- |
| 0:20 | Problem | "A 2023 state report ranked Michigan 49th in population growth. The University of Michigan is top 10 in the world for producing startup founders. We grow the talent, and then it leaves, because the people and companies that would give it a reason to stay never find each other." |
| 0:20 | Why us | "We're Michigan students deciding where to build our careers." Then the idea: LiDAR for connections, an agent for every member. (Rewrite in your own words.) |
| 1:30 | Live demo | Start a round and take hands off the keyboard. Agents across the state start meeting: a student's with a startup's, a supplier's with a vision startup's, a corporation's with a founder's. Watch one meeting in full: both vote yes, and each writes to its member. Another ends in no, with the reason. Record an outcome and run again: the agents choose differently. |
| 0:30 | How it works | watsonx Orchestrate runs the network agent; Granite on watsonx.ai is every agent's voice and the scoring; IBM Bob helped build the tools. Fit first, with small bonuses for surprise and for crossing hubs. |
| 0:20 | What's next | A pilot with one university and one business community; a student's agent that builds a reason to stay before they sign elsewhere. What we didn't solve: today's members and history are synthetic, and real members must opt in. |

**Submitted video (site rules)**

- Three minutes maximum; judges stop watching at 3:00. The link must be publicly accessible.
- Introduce the problem briefly, then spend at least 90 seconds showing the solution working on screen.
- Clearly show how we used IBM Bob and watsonx Orchestrate.
- Narrate throughout.

## Submission checklist

- [ ] Video demonstration URL, public, 3 minutes max, showing IBM Bob and watsonx Orchestrate in use
- [ ] Written problem and solution statement, 500 words max
- [ ] Written technology statement: how we used IBM Bob and watsonx Orchestrate
- [ ] Public code repository URL, containing all code and each teammate's IBM Bob screenshots
- [ ] No credentials in the repo; list of any websites used
- [ ] watsonx.ai and Orchestrate work exported before the account closes on Nov 24, 11:00 AM ET

## Risks

| Risk | Mitigation |
| --- | --- |
| Agent meetings ramble, or always end in yes | Three turns each, then a forced vote with one reason. Each agent sees only its own member's profile, holds deal-breakers and a budget. Plant one pair that should end in no. |
| Meetings are slow on stage | Cache the demo round; run the video from the cached run. |
| Too much to finish | The cut order. One connection end to end comes before anything else. |
| "Agents contacting people" sounds like spam | Members set permissions once; an agent messages only its own member; nothing is sent without two yes votes. |
| "A network of agents" is oversold | Say what was built. |
| A statistic in the pitch is challenged | Name source and year. Don't say Michigan is "dead last." |
| Orchestrate tool wiring takes too long | Fallback: an agent built with Orchestrate's built-in features and the profiles loaded as knowledge. |
| Credential leak suspends the account | `.env` git-ignored; repo stays private until the final secrets check. |

## Sources

- Challenge site: https://compete.112601.watsonx-challenge.ibm.com/competitions/midevfest (sign-in required)
- Keynote deck: https://ibm.biz/midevfest26-keynote
- 49th in population growth: Growing Michigan Together Council, 2023, as reported by https://www.fox17online.com/news/local-news/michigan/council-finds-michigan-is-49th-in-population-growth-submits-strategy-to-lawmakers
- University of Michigan in PitchBook's founder rankings: https://poetsandquantsforundergrads.com/news/pitchbooks-2024-top-universities-ranked-by-undergrad-founders/4/ and https://ingeniusprep.com/blog/best-colleges-for-entrepreneurs-2025-rankings-of-top-founder-universities/
