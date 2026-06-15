# Goal Run: Agent Room MVP Pass 1

## Objective

Build Agent Room / Voice Workroom MVP pass 1 from the canonical PRD and Project #7 using a board-first structured goal run.

## Source Of Truth

- Repo: `/Volumes/ThunderBolt/Development/agent-room`
- Canonical GitHub repo: `rodaddy/agent-room`
- Project board: `https://github.com/users/rodaddy/projects/7`
- Planning PR: `https://github.com/rodaddy/agent-room/pull/11`
- PRD: `docs/PRD.md`
- Architecture: `docs/architecture.md`
- Backlog: `docs/issue-backlog.md`

If PR #11 is merged, start from fresh `main` and immediately branch. If it is not merged, use `codex/mvp-prd-plan` as the source-of-truth base and branch from there.

## Hard Branch Rule

Never work on `main`. First implementation action is to get off `main` into a focused branch or WIP branch. Flow is branch, work, commit, push, PR, review/validation, merge, pull fresh `main`, new branch.

## MVP Pass 1 Scope

Implement issues #1-#5 as one vertical slice unless evidence shows a split is safer:

1. Scaffold monorepo and quality gates.
2. Room UI shell and mock event timeline.
3. Room events, provider contracts, and receipts.
4. Orchestrator WebSocket room protocol.
5. Deterministic routing and moderator state.

Keep issues #6-#10 in backlog unless explicitly pulled into scope.

## Product Decisions

- Local-first app for 1-3 humans and 1-3 agents.
- Use Vite/React + Tailwind for the UI.
- Use a separate TypeScript orchestrator service.
- Use mock providers for pass 1, with real adapter boundaries/stubs for LLM, STT, TTS, and voice room.
- Basic local auth/session gate is enough for MVP.
- Keep an Authentik/OIDC upgrade path.
- Room events are the core product model.
- Voice is one transport.
- Do not hardwire OpenAI Realtime as the only voice architecture.
- Use LiveKit Agents/examples as FOSS reference for later voice work, but own the Agent Room product layer.

## Controller And Board Protocol

Main Codex is accountable controller. Board state must be current before dispatching workers. Workers produce evidence only; the controller verifies before moving board state, opening PR readiness, closing issues, or declaring done.

Before implementation, update Project #7 fields for issues #1-#5:

- `Work Status`: In Progress when active.
- `Validation`: Not Started until validation evidence exists.
- `Review Gate`: Not Started until review begins.

Advance fields only from verified evidence.

## Worker Lanes

Use parallel workers only for disjoint useful lanes:

1. Scaffold/contracts worker: Bun workspace, TypeScript config, package structure, room-event schemas.
2. UI worker: Vite/React room shell, mock timeline, roster, composer, context panel, receipts, voice controls.
3. Orchestrator worker: WebSocket room service, participant state, event fanout.
4. Routing worker: parser/state-machine tests for `@agent`, `@all`, names, `both`, `stop`, `hold`, and `pause`.
5. Validation/review worker: input/output tests, smoke checks, docs consistency, board verification.

No overlapping write ownership. If write sets collide, serialize through the controller.

## Review Swarm Protocol

Before PR readiness, run a review gate with at least:

- SME reviewer: architecture, contracts, event model.
- Frontend reviewer: room UX, responsive layout, state clarity.
- Backend reviewer: WebSocket, orchestrator, errors, logging.
- Antagonist/security reviewer: secrets, auth, unsafe assumptions, provider boundaries.
- Test reviewer: input/output quality and meaningful smoke coverage.

Findings are work orders. Fix material issues, rerun focused validation, and perform fix verification. Do not mark `Review Gate` as `Zero Known Issues` until the controller verifies.

## Testing Standard

Do not chase line coverage. Prioritize high-quality input/output tests for:

- routing parser
- moderator state machine
- event schema validation
- provider adapter normalization
- receipt verification states
- auth/session boundary
- WebSocket event fanout

Add one smoke/E2E path if feasible in pass 1.

## Logging And Metrics Standard

Add structured logging that is useful but not chatty by default.

- `info`: lifecycle and useful trace points.
- `warn`: degraded/recoverable states.
- `error`: boundary, provider, persistence, WebSocket, and auth failures.

Debug/test logs must be quiet by default and enabled by env flags. Catch/log at failure boundaries, not every pure helper. Add Prometheus/Grafana-compatible metrics stubs where natural, without overbuilding.

## Resilience And Mocking Standard

Do not stop on missing provider keys, missing paid services, or unavailable live integrations when the behavior can be worked around safely.

- Missing key or provider: create/use mock adapters and fixture inputs/outputs.
- Provider contracts must be real even when implementations are mocked.
- Missing key behavior should produce a mocked or blocked provider event, not crash the room.
- Voice/audio proof can use small public/sample audio fixtures, generated local clips, or tiny local test assets.
- MLX or local model installs are allowed only when lightweight and useful for MVP validation.
- Prefer small, low-quality, fast test models for MVP; keep heavier local inference optional.
- Build degraded paths intentionally and keep moving through non-blocking friction.
- Stop only for destructive actions, credential access, paid API use, live infra mutation, external service changes, or architecture-shaping decisions that need Rico.

## Documentation Standard

Document public contracts, module boundaries, env vars, validation commands, and non-obvious behavior. Keep README/docs aligned with implemented commands.

## Stop Gates

Stop before credential lookup, paid API use, live homelab mutation, destructive actions, or external service changes unless explicitly approved. Do not invent secrets. Do not close issues until implementation and validation evidence exist.

## Completion Target

Open one PR for issues #1-#5 with committed code, updated docs, validation evidence, board fields current, and review-swarm/fix-verification results recorded.
