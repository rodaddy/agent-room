## Goal

Create the initial Bun/TypeScript monorepo scaffold and quality gates for Agent Room.

## Deliverables

- Bun workspace config.
- `apps/web`, `services/orchestrator`, and shared package directories.
- TypeScript base config and package-level configs.
- Placeholder lint, typecheck, test, and dev scripts.
- `.env.example` with variable names only.
- Basic CI workflow that installs and typechecks placeholder packages.
- Repo-local docs links to `docs/PRD.md` and `docs/architecture.md`.

## Acceptance Criteria

- `bun install` succeeds.
- `bun run typecheck`, `bun run lint`, and `bun run test` have documented placeholder behavior and pass.
- `bun run dev` has a documented placeholder behavior.
- CI workflow runs on pull requests.
- README setup section matches actual commands.

## Validation

```bash
bun install
bun run typecheck
bun run lint
bun run test
```

## Notes For Codex

Keep the scaffold boring and stable. Do not build feature code here beyond placeholders needed to prove the workspace.
