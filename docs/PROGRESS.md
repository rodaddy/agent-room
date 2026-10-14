# Progress

## 2026-06-15 MVP Pass 1

- Controller branch: `codex/mvp-pass-1`.
- Issues 01-05 moved to in progress.
- Root Bun/TypeScript workspace scaffold started.
- Implemented Vite/React local-first room UI shell.
- Implemented `room.event.v1` contracts, receipt verification states, and mock provider adapter boundaries.
- Implemented deterministic routing parser/state machine for direct mentions, `@all`, `both`, natural names, unknown targets, queueing, hold, stop/interruption, and warning-only unknown routes.
- Implemented Bun orchestrator with health, metrics, WebSocket fanout, server-stamped room events, room event validation, routing, dispatch/cancel events, structured boundary logging, and sanitized visible warnings.
- Implemented local auth boundary: unauthenticated WebSocket upgrades are allowed only on loopback by default; exposed/non-loopback use requires `ORCHESTRATOR_LOCAL_TOKEN`.
- Addressed review findings for payload validation, mixed unknown routing, moderator queue state, WebSocket cleanup, room spoofing, invalid input visibility, quiet test logging, STT/TTS mocks, provider normalization, responsive UI, and event-backed UI fixtures.
- Final fix verification followed the frontend state reducer update to consume participant, voice, routing, agent lifecycle, receipt, and validated socket events.
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
- Fix verification: contracts and backend lanes found no further issues; frontend follow-up findings were fixed and re-verified.

Browser visual check note: the in-app Browser plugin reported `iab` unavailable in this session, so visual verification used build plus local HTTP response only.

## 2026-06-15 MVP Pass 2

- Controller branch: `codex/mvp-pass-2`.
- Scope: issues 06, 07, and 08 only. Voice adapters (09) and full deployment/E2E docs (10) remain next-pass work.
- Added SQLite persistence with canonical `room_events` replay plus projection tables for messages, dispatches, receipts, context, handoffs, identities, room membership, API key hashes, and provider config references.
- Added config-driven loading of example agent personas (Bilby, Skippy, Nagatha) from Hermes-style persona folders, with generic fallback agents merged into local demo routing.
- Added provider-backed agent runtime that defaults to mock locally, selects OpenAI Responses/LiteLLM/local HTTP LLM providers from env when configured, and emits dispatch lifecycle events, blocked states, and provider receipts with context counts.
- Added context snippet attach, selected context chips, receipt artifact chips, persisted context API, and local transcript export/handoff hooks to the web/orchestrator flow.
- Added local secret boundary: secret values stay in an external secret manager; SQLite stores hashes and `secret://agent-room/...` references.
- Stored the admin API key and orchestrator local token in an external secret manager; seeded a temporary SQLite DB under `$TMPDIR/agent-room-runtime` with only refs and token hashes.
- Runtime smoke validation used `$TMPDIR/agent-room-runtime` for SQLite and transcript artifacts; repo-local `data/` is ignored for user-run local persistence and was not used for Codex validation.
- Review gate findings were fixed:
  - HTTP LLM providers now use `LLM_PROVIDER_TIMEOUT_MS`/AbortController and return `provider_timeout` errors instead of hanging dispatches.
  - Duplicate room event ids no longer re-project different payloads over the canonical event log.
  - Unauthenticated local mode now requires both bind host and request URL to be loopback, preventing Host-header spoof bypass on exposed binds.
  - `sessionToken` query auth is restricted to loopback development; exposed/non-loopback use requires bearer auth.
  - `docs/issue-backlog.md` now splits pass 2 (06-08) from pass 3 (09-10).

Validation evidence:

- `bun test packages/provider-adapters/src/index.test.ts`: 9 tests passed.
- `bun run format`: passed.
- `bun run typecheck`: passed.
- `bun run lint`: passed via typecheck-backed lint placeholder.
- `bun run test`: 42 source tests passed.
- `bun run build`: passed, including Vite production build.
- `git diff --check`: passed.
- `ggshield secret scan repo .`: passed.
- `curl -fsS http://127.0.0.1:4000/health`: returned `{"ok":true,"service":"orchestrator"}` while `bun run dev` was running.
- `curl -fsS http://127.0.0.1:3000`: returned the Vite app shell while `bun run dev` was running.
- `POST /rooms/demo/context`: returned persisted `context.attached` event for `ctx_smoke`.
- `GET /rooms/demo/transcript`: returned `ok: true` and wrote markdown under `$TMPDIR/agent-room-runtime/smoke-artifacts/`.
- Post-review smoke rerun: `curl` health/web/context/transcript passed and wrote markdown under `$TMPDIR/agent-room-runtime/smoke2-artifacts/`.
- Focused fix verification: correctness, security, and docs lanes rechecked the prior review items.
- Browser visual smoke: skipped because Playwright was available but its Chromium binary was not installed; no browser download was performed during this pass.

## 2026-06-15 MVP Pass 3

- Controller branch: `codex/mvp-pass-3`.
- Scope: issues 09 and 10 only.
- Added mock-first voice session lifecycle endpoints:
  - `POST /rooms/:roomId/voice/session`
  - `POST`/`DELETE /rooms/:roomId/voice/session/:sessionId/end`
- Extended `VoiceRoomProvider` to return session config with transport, expiry, optional join URL, optional token, and capabilities.
- Added fail-closed OpenAI Realtime and LiveKit/WebRTC voice-room adapter slots so the architecture remains swappable without pretending live token minting is done.
- Routed `message.transcript_final` through the same moderator, agent dispatch, context, receipt, and persistence path as text messages.
- Wired the web voice controls to start/end mock sessions, send a final mock transcript, toggle spoken replies, simulate failure, and export the transcript.
- Added `scripts/local-smoke.ts` and mapped `bun run test:e2e` to the local smoke flow.
- Added deployment and demo docs for cloud/API, Mac mini local/hybrid, and homelab LiveKit/LiteLLM modes.

Validation evidence:

- `bun test packages/room-events/src/index.test.ts packages/provider-adapters/src/index.test.ts services/orchestrator/src/room-hub.test.ts services/orchestrator/src/server.test.ts`: 29 tests passed.
- `bun run format`: passed.
- `bun run typecheck`: passed.
- `bun run lint`: passed via typecheck-backed lint placeholder.
- `bun run test`: 47 source tests passed.
- `bun run test:e2e`: passed; local smoke validated health, context attach, text routing, mock voice session, voice transcript routing, and transcript export.
- `bun run build`: passed, including Vite production build.
- `git diff --check`: passed.
- `ggshield secret scan repo .`: passed.
- Browser visual smoke: not run in this pass because the local smoke command is the E2E gate and no browser download/live UI action was required. Browser visual checks remain useful when a browser runtime is available.
