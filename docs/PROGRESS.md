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

## 2026-06-15 MVP Pass 2

- Controller branch: `codex/mvp-pass-2`.
- Scope: issues #6, #7, and #8 only. Voice adapters (#9) and full deployment/E2E docs (#10) remain next-pass work.
- Added SQLite persistence with canonical `room_events` replay plus projection tables for messages, dispatches, receipts, context, handoffs, identities, room membership, API key hashes, and provider config references.
- Added config-driven agent loading from Hermes backup metadata for Bilby, Skippy, and Nagatha, with generic fallback agents merged into local demo routing.
- Added provider-backed agent runtime that defaults to mock locally, selects OpenAI Responses/LiteLLM/local HTTP LLM providers from env when configured, and emits dispatch lifecycle events, blocked states, and provider receipts with context counts.
- Added context snippet attach, selected context chips, receipt artifact chips, persisted context API, and local transcript export/handoff hooks to the web/orchestrator flow.
- Added local secret boundary: secret values stay in Vaultwarden; SQLite stores hashes and `vaultwarden://agent-room/...` references.
- Created Vaultwarden secure notes for `Agent Room - Admin API Key` and `Agent Room - Orchestrator Local Token`; seeded a temporary SQLite DB under `/Volumes/ThunderBolt/_tmp/agent-room-runtime` with only refs and token hashes.
- Runtime smoke validation used `/Volumes/ThunderBolt/_tmp/agent-room-runtime` for SQLite and transcript artifacts; repo-local `data/` is ignored for user-run local persistence and was not used for Codex validation.
- Review gate findings were fixed:
  - HTTP LLM providers now use `LLM_PROVIDER_TIMEOUT_MS`/AbortController and return `provider_timeout` errors instead of hanging dispatches.
  - Duplicate room event ids no longer re-project different payloads over the canonical event log.
  - Unauthenticated local mode now requires both bind host and request URL to be loopback, preventing Host-header spoof bypass on exposed binds.
  - `sessionToken` query auth is restricted to loopback development; exposed/non-loopback use requires bearer auth.
  - `docs/issue-backlog.md` now splits pass 2 (#6-#8) from pass 3 (#9-#10).

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
- `GET /rooms/demo/transcript`: returned `ok: true` and wrote markdown under `/Volumes/ThunderBolt/_tmp/agent-room-runtime/smoke-artifacts/`.
- Post-review smoke rerun: `curl` health/web/context/transcript passed and wrote markdown under `/Volumes/ThunderBolt/_tmp/agent-room-runtime/smoke2-artifacts/`.
- Focused fix verification job `5339dfda-2597-4592-ace6-adc64ab440a5`: correctness, security, and docs lanes all reported `pass` with zero remaining findings for the prior review items.
- Browser visual smoke: skipped because Playwright was available but its Chromium binary was not installed; no browser download was performed during this pass.

## 2026-06-15 MVP Pass 3

- Controller branch: `codex/mvp-pass-3`.
- Scope: issues #9 and #10 only.
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
