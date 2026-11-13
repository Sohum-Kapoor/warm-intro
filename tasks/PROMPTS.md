# Kickoff prompts

Paste one of these into Claude Code, started in the repo folder. Accept the prompt to trust the folder, and turn on auto-accept for edits so it doesn't pause on every file.

Email addresses are left out of this file on purpose, because the repo becomes public. Fill in the placeholders when you paste.

## SK — first machine

```
You are building Warm Intro for a hackathon. Submissions close at 6:00 PM ET today. OWNER=sk.

Step 0, once: this folder (~/Developer/warm-intro) has a scaffold but no git history.
- git init -b main
- mkdir -p .claude && cp setup/claude-settings.json .claude/settings.json
  (shared permissions for both of us; if you are blocked from writing your own settings,
  tell me to run that line myself and continue)
- claude mcp add --scope project --transport http linear-server https://mcp.linear.app/mcp
  (this writes .mcp.json so Jesse's Claude Code gets the Linear connection from the repo;
  if the command differs in this version, check `claude mcp add --help` and Linear's docs
  at https://linear.app/docs/mcp)
- add everything, commit "Scaffold".
- gh repo create warm-intro --private --source=. --remote=origin --push
- Invite Jesse (<JESSE'S EMAIL>) with push access. Look up his GitHub username with
  gh api "search/users?q=<JESSE'S EMAIL>+in:email". If you find it, add him as a
  collaborator. If you can't, print the repo's Settings > Collaborators URL and tell me to
  add him by email, then keep going. Do not write his email into any file.
- If gh is not signed in, tell me the one command to run and wait for me.

Then read CLAUDE.md, docs/WORKING_STYLE.md, docs/PRD.md, docs/CONTRACTS.md and
tasks/SK.md, and follow them exactly. Check that Linear is connected by listing the issues
in the project "Warm Intro (DevFest)". Work through tasks/SK.md from S1, top to bottom,
without stopping to ask me anything. If something blocks you, write it in BLOCKED.md and
on the Linear issue and move to the next task. Commit and push after every task. Check the
Linear Coordination issue at every task boundary.
```

## SK — any additional machine

```
OWNER=sk. Clone the warm-intro repo from my GitHub into ~/Developer if it isn't here, then
read CLAUDE.md, docs/WORKING_STYLE.md, docs/CONTRACTS.md and tasks/SK.md. Another
agent of mine is already working. In Linear, project "Warm Intro (DevFest)", find the first
[SK] issue that is not In Progress or Done, claim it by setting it In Progress with a
"start <agent-id>" comment, and do it. Repeat. Never start a task that is already
In Progress.
```

## Jesse

```
I'm Jesse, working with SK on a hackathon project called Warm Intro. Submissions close at
6:00 PM ET today. OWNER=jesse. Set me up, then start building.

1. GitHub: SK invited me to his private repo warm-intro. Help me accept the invite
   (my email or github.com/notifications), then clone it and work inside it. When Claude
   Code asks whether to trust the folder and to use the project's Linear server, say yes.
2. Linear: SK is inviting me to his Linear workspace "Sohum". Once I've accepted, run /mcp
   and have me sign in to the linear-server connection that came with the repo. If it
   isn't listed, add it with the command in docs/TOOLS.md. Confirm it works by listing the
   issues in the project "Warm Intro (DevFest)" and reading the Coordination issue.
3. Read CLAUDE.md, docs/WORKING_STYLE.md, docs/TOOLS.md, docs/PRD.md,
   docs/CONTRACTS.md and tasks/JESSE.md, and follow them exactly. The working-style file is
   how SK's agents work; work the same way.
4. Post "@all jesse-<hostname> online" on the Coordination issue.
5. Work through tasks/JESSE.md from J1, top to bottom, without stopping to ask me anything.
   Build against web/fixtures/sample_run.json; don't wait for SK's backend. If something
   blocks you, write it in BLOCKED.md and on the Linear issue and move on. Commit and push
   after every task (git pull --rebase first). Check the Coordination issue at every task
   boundary and act on anything addressed to @jesse or @all.

If Linear can't be connected in five minutes, skip it and use COORDINATION.md in the repo
as CLAUDE.md describes.
```
