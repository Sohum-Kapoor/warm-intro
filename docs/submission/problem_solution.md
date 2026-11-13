# Warm Intro: problem and solution

*Proof-of-concept. All members, history, transcripts and messages are synthetic. All agent text is AI-generated.*

## The problem

We want to reimagine Michigan's innovation ecosystem so talent and companies stay. People leave Michigan and the Midwest for the coasts because they never meet the people and companies that would give them a reason to stay. Michigan ranks 49th of 50 states in population growth (Growing Michigan Together Council, 2023), and the University of Michigan is top 10 in PitchBook's ranking of universities by undergraduate startup founders (8th in 2024). A student never meets the startup that would hire them; a small manufacturer never meets the founder who could solve its problem.

## The first step: an agent layer

Every student, professional, startup, manufacturer and company gets an AI agent that finds the local connection worth making and takes the first meeting for them. We lead with Michigan (Detroit, Grand Rapids, Ann Arbor); the Midwest is the scale story. We have not shown that connections raise retention. The pilot measures it.

## How people use it

The product surface is a minimal pop-up or browser-extension card: "Your agent found 1 introduction, both agents said yes."

1. A member sets its agent's permissions once.
2. Agents scout on their own, or a member asks in plain words.
3. A scout scores every pair on how well needs match offers. Only pairs above a threshold meet (on a full Granite round, 117 of 1,711 pairs, 6.8%), at most three meetings per member per round.
4. The two agents hold a short first meeting, each speaking only from its own member's profile and deal-breakers, then each votes yes or no with a one-sentence reason.
5. Two yes votes make an introduction, and each agent writes to its own member with a next step. Otherwise it ends there and the reason is kept.
6. Recorded outcomes update weights for the next round.

Judge site: https://sohum-kapoor.github.io/warm-intro/ (detail at `/site/full.html`). The scan view (`web/`, `?run=demo`) is the under-the-hood view, with every transcript and vote.

## Why it is creative

Agents take the first meeting for you, and they can say no. A declined meeting, with its reason, is part of the product. Scoring puts fit first, adds small bonuses for novelty and for crossing hubs, and learns from outcomes.

## How it uses AI

Embeddings of every need and offer drive scoring. Language models give each agent its voice, vote and message, and match members to 17 real public Michigan resources; only the matching is AI-generated. IBM Granite on watsonx.ai runs the live demo. A watsonx Orchestrate agent calls the `runRound` tool to run the loop. IBM Bob built two small tools: a run summarizer and a data validator. Each member's agent is one agent design run once per member inside the meeting tool, not a separate Orchestrate agent.

## Limits

Members and history are synthetic; messages land in a demo outbox. The learning history is invented: no measured results.
