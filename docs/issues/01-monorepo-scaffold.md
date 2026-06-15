## Goal
Create the initial Bun monorepo scaffold for Agent Room.

## Deliverables
- Bun workspace config
- `apps/web`, `services/orchestrator`, and shared package directories
- TypeScript base config
- lint/format/test placeholders
- `.env.example`
- basic CI workflow that installs and typechecks placeholder packages

## Acceptance criteria
- `bun install` succeeds
- `bun run dev` has a documented placeholder behavior
- CI workflow runs on pull requests
- README setup section matches actual commands

## Notes for Codex
Keep the scaffold boring and stable. Do not overbuild feature code here.
