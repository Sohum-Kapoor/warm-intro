# Warm Intro: problem and solution

*Proof-of-concept. All members, history, transcripts and messages are synthetic. All agent text is AI-generated.*

## The problem

Michigan grows talent, startups and companies, then loses them. A 2023 state council report ranked Michigan 49th in population growth, while the University of Michigan ranks among the top schools for undergraduate startup founders (PitchBook). Talent leaves, and ideas, companies and jobs follow.

The people who would give each other a reason to stay never meet. People meet whoever is in their sector, room and city. A student never meets the startup that would hire them, a startup never meets its first customer, and a small manufacturer never meets the founder who could solve its problem.

## Who it is for

Everyone in Michigan's economy, treated the same way: individuals, startups, small businesses and manufacturers, and corporations, across Detroit, Grand Rapids and Ann Arbor.

## How people use it

Warm Intro is LiDAR for connections: it shows who is already around you that you can't see.

1. A member sets its agent's permissions once.
2. Agents scout on their own, or a member asks in plain words ("find me someone who can do machine vision for inspection").
3. A scout scores every pair on how well one side's needs match the other's offers. Only pairs above a threshold meet, at most three meetings per member per round.
4. The two members' agents hold a short first meeting, each speaking only from its own member's profile and deal-breakers, then each votes yes or no with a one-sentence reason.
5. Two yes votes make an introduction, and each agent writes to its own member with a proposed next step. Anything else ends there, and the reason is kept. Nothing reaches a member without two yes votes.
6. Recorded outcomes update weights, so the next round favors connections that worked.

A scan view draws the three hubs with members as dots and meetings as colored lines. Users open any meeting to read the transcript and both votes, and check the outbox of introductions.

## Why it is creative

Agents take the first meeting for you, and they can say no. A declined meeting, with its reason, is part of the product. Scoring puts fit first, adds a small bonus for novelty (so a manufacturer meets a drone startup, not another manufacturer) and a capped bonus for crossing hubs, and learns from outcomes.

## How it uses AI

Embeddings of every need and offer drive scoring. Language models give each member's agent its voice, vote and message. watsonx Orchestrate hosts the network agent that runs the loop. IBM Bob helped build part of the tooling. Each member's agent is one agent design run once per member inside the meeting tool, not a separate Orchestrate agent.

## Limits

Everything is synthetic and messages land in a demo outbox. Real members would opt in. The learning history is invented, so we claim no measured results.
