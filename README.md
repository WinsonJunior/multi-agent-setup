# Wolf

A multi-agent development workflow system built on top of [Claude Code](https://claude.ai/code).

Wolf adds two things to Claude Code: a **hook system** that learns from your codebase and enforces patterns automatically, and a **13-agent pipeline** that handles the full development lifecycle — from planning to QC — either manually or fully autonomously.

---

## How it works

### Manual mode (default)

You drive. Agents are invoked in sequence as needed:

```
task-planner → database (if needed) → backend → frontend
    → lint-static → test-runner → [security-auditor + code-reviewer]
```

### Autonomous mode (`/autopilot`)

You set a goal in `AUTOPILOT.md` and walk away. The orchestrator runs a loop until the goal is complete or it hits a blocker:

```
orchestrator → researcher → task-planner → plan-reviewer
    → [database → backend → frontend → lint-static → test-runner
       → security-auditor + code-reviewer] → qc-gate → orchestrator (loop)
```

Supports two modes, auto-detected from `AUTOPILOT.md`:
- **coding** — implements features, fixes bugs, refactors code. Validated by tests + QC gate.
- **trading** — improves a trading strategy. Validated by before/after backtests.

---

## Agents

| Agent | Role | Model |
|-------|------|-------|
| `task-planner` | Brainstorms and plans features with you. Never starts implementing without your approval. | Opus |
| `backend` | Laravel, Django, Express, FastAPI, Go — API routes, business logic, auth, integrations | Sonnet |
| `frontend` | React, Vue, Nuxt — components, state, styling, client-side logic | Sonnet |
| `database` | Schema design, migrations, queries, indexes | Sonnet |
| `mobile` | React Native / Expo — screens, navigation, native APIs | Sonnet |
| `lint-static` | Runs lint and type checks. Reports and fixes errors. | Sonnet |
| `test-runner` | Runs the full test suite. Fixes broken tests without changing business logic. | Sonnet |
| `security-auditor` | OWASP Top 10 scan. Read-only — reports issues with severity ratings. | Sonnet |
| `code-reviewer` | Code quality, logic, architecture review. Read-only — does not make changes. | Sonnet |
| `orchestrator` | Autonomous loop controller. Manages the improve → verify → decide cycle. | Opus |
| `researcher` | Reads the codebase and returns ranked findings. Never implements. | Sonnet |
| `plan-reviewer` | Autonomous plan critic. Approves or rejects plans with a score and feedback. | Sonnet |
| `qc-gate` | Final checkpoint. Verifies implementation matches the plan, runs tests, gives APPROVED / FAILED verdict. | Sonnet |

---

## Hooks

Wolf hooks run automatically at Claude Code lifecycle events. Every project gets a `.wolf/` directory for per-project state.

### `wolf-session-start.js` — SessionStart
Initializes fresh session state on every Claude Code startup:
- Creates `.wolf/session.json` with read/write counters
- Ensures `.wolf/cerebrum.md`, `buglog.json`, `anatomy.md` exist with sane defaults
- Warns if `cerebrum.md` hasn't been updated in 3+ days
- Reports current buglog size

### `wolf-pre-write.js` — PreToolUse (Write/Edit)
Runs before every file write. Enforces Do-Not-Repeat patterns:
- Reads `.wolf/cerebrum.md` for your custom "never do this" rules
- Regex-matches incoming code against the rules — warns if violated
- Checks `.wolf/buglog.json` for past bugs in the same file — reminds Claude before it repeats a mistake
- Warns only, never blocks

### `wolf-post-write.js` — PostToolUse (Write/Edit)
Runs after every file write. Detects and logs bug-fix patterns:
- Pattern-matches edits against 12 bug categories: `error-handling`, `null-safety`, `guard-clause`, `wrong-value`, `missing-import`, `async-fix`, `type-fix`, `logic-fix`, `operator-fix`, `return-value`, `style-fix`, `refactor`
- Auto-logs detected bugs to `.wolf/buglog.json` with file, tags, snippet, timestamp
- Updates `.wolf/anatomy.md` with line count and token estimate for every edited file
- Appends action to `.wolf/memory.md` (chronological session log)
- Warns if a file has been edited 3+ times this session (churn indicator)

### Per-project state (`.wolf/`)

```
.wolf/
├── session.json    — fresh each session (read/write counters)
├── cerebrum.md     — your Do-Not-Repeat rules and learned patterns
├── buglog.json     — detected bug-fix events (file, tags, timestamp)
├── anatomy.md      — file registry with line/token counts
└── memory.md       — chronological log of all Claude actions
```

---

## Autonomous mode setup

Create `AUTOPILOT.md` in your project root:

```markdown
# Autopilot Goal
Mode: coding
Goal: Add input validation to all API controllers and write tests for each.
```

Then run `/autopilot` in Claude Code. The orchestrator loops until the goal is complete, all research priorities are exhausted, or 3 consecutive cycles fail.

All cycles are logged to `AUTOPILOT-LOG.md` for you to review.

---

## Installation

1. Clone this repo:
```bash
git clone https://github.com/WinsonJunior/multi-agent-setup.git
```

2. Copy agents and hooks to Claude Code:
```bash
cp -r agents/ ~/.claude/agents/
cp -r hooks/ ~/.claude/hooks/
```

3. Add the hooks to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "command": "node ~/.claude/hooks/wolf-session-start.js" }],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "command": "node ~/.claude/hooks/wolf-pre-write.js" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "command": "node ~/.claude/hooks/wolf-post-write.js" }]
      }
    ]
  }
}
```

4. Add your project conventions to `.wolf/cerebrum.md` (auto-created on first session):

```markdown
## Do-Not-Repeat
- Never use `moment.js`, prefer `date-fns`
- Never use `any` type in TypeScript
- Never leave empty catch blocks
```

**Requirements:** Node.js 18+, Claude Code

---

## Customizing agent skills

Each agent's skills are declared in its frontmatter. Skills give agents domain knowledge — swap them out for your own or any skill you have installed by editing the agent file directly.

The skill name must match the folder name in `~/.claude/skills/`. Claude Code loads them automatically — no other config needed.

### What each agent expects

| Agent | Skill type needed |
|-------|------------------|
| `backend` | API design, secrets management, any domain-specific knowledge for your stack |
| `frontend` | UI/UX design patterns, component best practices |
| `database` | Database best practices for your specific DB (Postgres, MySQL, etc.) |
| `security-auditor` | Security vulnerability patterns (OWASP, etc.) |
| `code-reviewer` | Code review standards for your language/framework |
| `researcher` | Domain knowledge relevant to your project (trading, AI, etc.) |
| `orchestrator` | Same as researcher — used in autonomous mode |
| `task-planner` | Brainstorming and planning methodologies |

### Example — swapping the database skill

If you use MySQL instead of Postgres, replace the skill in `database.md`:

```yaml
---
name: database
skills:
  - mysql-best-practices   # your own skill or any installed one
---
```

### Adding your own skill

Create a folder in `~/.claude/skills/your-skill-name/` with a `SKILL.md` file — Claude Code picks it up automatically. Then reference it by folder name in any agent's frontmatter.

---

## Hard rules (baked into all agents)

- No `git add`, `git commit`, `git push` — ever
- No deployment commands (Vercel, Railway, Docker)
- No CI/CD or Dockerfile modifications
- Never start implementing without explicit user approval (manual mode)
- Autonomous mode self-governs — stops after 3 consecutive failures or if a blocker needs human judgment
