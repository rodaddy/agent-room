# Progress

## 2026-06-15 MVP Pass 1

- Controller branch: `codex/mvp-pass-1`.
- Project #7 issues #1-#5 moved to `Work Status: In Progress`.
- Root Bun/TypeScript workspace scaffold started.
- Implemented Vite/React local-first room UI shell.
- Implemented `room.event.v1` contracts, receipt verification states, and mock provider adapter boundaries.
- Implemented deterministic routing parser/state machine for direct mentions, `@all`, `both`, natural names, unknown targets, queueing, hold, stop/interruption, and warning-only unknown routes.
- Implemented Bun orchestrator with health, metrics, WebSocket fanout, server-stamped room events, room event validation, routing, dispatch/cancel events, structured boundary logging, and sanitized visible warnings.
- Implemented local auth boundary: unauthenticated WebSocket upgrades are allowed only on loopback by default; exposed/non-loopback use requires `ORCHESTRATOR_LOCAL_TOKEN`.
- Addressed review findings for payload validation, mixed unknown routing, moderator queue state, WebSocket cleanup, room spoofing, invalid input visibility, quiet test logging, STT/TTS mocks, provider normalization, responsive UI, and event-backed UI fixtures.
- Final fix verification found zero known material issues after the frontend state reducer was updated to consume participant, voice, routing, agent lifecycle, receipt, and validated socket events.
- Worker lanes dispatched:
  - contracts/provider adapters
  - routing parser/state machine
  - room UI shell
  - orchestrator WebSocket service

Validation evidence:

- `bun install`: passed.
- `bun run typecheck`: passed.
- `bun run lint`: passed via typecheck-backed lint placeholder.
- `bun run format`: passed.
- `bun run test`: 31 source tests passed.
- `bun run build`: passed, including Vite production build.
- `curl -fsS http://127.0.0.1:4000/health`: returned `{"ok":true,"service":"orchestrator"}` while `bun run dev` was running.
- `curl -fsS http://127.0.0.1:3000`: returned the Vite app shell while `bun run dev` was running.
- Fix verification job `ac9ffd16-9331-4891-acbc-1e45faeec153`: contracts and backend lanes reported `zero_known_material_issues`; frontend lane reported follow-up findings that were fixed.
- Frontend re-verification job `76f056ee-6883-4a60-8c16-258c1520a090`: reported `zero_known_material_issues`.

Browser visual check note: the in-app Browser plugin reported `iab` unavailable in this session, so visual verification used build plus local HTTP response only.
