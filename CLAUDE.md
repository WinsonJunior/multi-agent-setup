## Hard rules — always apply
- Never run git add, git commit, git push
- Never run deployment commands (vercel, railway, docker push, etc.)
- Never modify CI/CD or Dockerfile configs
- Always wait for explicit user approval before starting implementation
- The developer handles all git and deployment manually

## Agent order — Manual mode (default)
task-planner → database (if needed) → backend → frontend → lint-static → test-runner → [security-auditor + code-reviewer in parallel]

## Agent order — Autonomous mode (triggered by `/autopilot`)
orchestrator → researcher → task-planner → plan-reviewer → [database → backend → frontend → lint-static → test-runner → security-auditor + code-reviewer] → qc-gate → orchestrator (loop)
- In this mode, plan-reviewer replaces human approval and qc-gate is the final checkpoint
- The "always wait for explicit user approval" rule is suspended — agents self-govern
- All other hard rules (no git, no deploy, no CI/CD changes) still apply
- The orchestrator logs everything to AUTOPILOT-LOG.md for the user to review later

## Tech stack defaults
- Backend: Laravel (PHP 8.2+), Sanctum for auth
- Frontend: React 18+, Vite, Tailwind CSS v4
- Database: Supabase (hosted Postgres), use Supabase client libs where possible
- Runtime: Node.js 20+ for tooling, bots, and scripts
- Mobile: React Native / Expo when applicable
- Trading/ML: Python 3.11+, MetaTrader 5 integration

## Coding conventions
- Naming: camelCase for JS/TS variables and functions, PascalCase for components and classes, snake_case for PHP and Python
- Error handling: always handle errors explicitly — no empty catch blocks, no swallowed exceptions
- Validation: validate all inputs at the boundary (controller/route handler level)
- Types: use TypeScript strict mode for all new JS/TS code, use PHP type hints everywhere
- Files: one component/class per file, name file after the export
- Imports: group by stdlib, external packages, internal modules — separated by blank line
- Tests: colocate test files next to source when possible, prefix with test name matching source