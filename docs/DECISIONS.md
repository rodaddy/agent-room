# Decisions

## 2026-06-15: MVP pass 1 stack

- Use Vite/React plus Tailwind for the local-first room UI.
- Use a separate TypeScript orchestrator service for room events, routing, WebSocket fanout, auth boundary, logging, and metrics.
- Use mock providers for MVP pass 1 while preserving real adapter contracts for LLM, STT, TTS, and voice-room providers.
- Use basic local auth/session stubs now and keep Authentik/OIDC as the preferred stronger-auth upgrade path.
- Allow no-token orchestrator WebSocket upgrades only for loopback local development. Any exposed/non-loopback URL must use `ORCHESTRATOR_LOCAL_TOKEN` for MVP.
- Test behavior through input/output contracts rather than line coverage targets.

## 2026-06-15: Logging and resilience

- Keep runtime logs useful but not chatty by default.
- Log at failure boundaries and degraded states instead of wrapping every pure helper.
- Missing provider keys must produce mock/degraded provider behavior or room-visible blocked events rather than stopping implementation.

## 2026-06-15: MVP pass 2 local state and personas

- Use SQLite as the MVP local durable store instead of in-memory state.
- Treat `room_events` as the canonical replay log and keep projection tables for messages, dispatches, receipts, context, handoffs, local identities, API key hashes, and provider config refs.
- Store secret values in an external secret manager (for example Vaultwarden); SQLite may store only one-way hashes and non-secret refs such as `secret://agent-room/admin-api-key`.
- Load Bilby, Skippy, and Nagatha metadata from Hermes backup configs when available, then merge in generic fallback agents such as Scribe/Tester so routing remains useful in local demo mode.
- Expose prompt previews/source paths only; do not send full Hermes persona prompts to the browser, logs, issues, or PRs.
- Restrict durable-token query authentication to loopback development; exposed/non-loopback use must send bearer auth.
- Guard HTTP provider calls with `LLM_PROVIDER_TIMEOUT_MS` so hung providers turn into visible error/blocked events instead of stuck dispatches.

## 2026-06-15: MVP pass 3 voice and validation boundary

- Use a mock-first voice session endpoint for the MVP so the room can demonstrate voice lifecycle and final transcript routing without paid provider calls, browser downloads, or homelab mutation.
- Keep OpenAI Realtime and LiveKit/WebRTC as peer `VoiceRoomProvider` slots; both fail closed until a later approved pass implements live token minting and provider calls.
- Treat `message.transcript_final` as a first-class routable room event, not a separate voice-only path.
- Use `bun run test:e2e` for the local smoke gate. The smoke starts the orchestrator in-process, uses SQLite/artifacts under the system temp directory, exercises text/context/voice/transcript export, and avoids Playwright browser binary dependencies.
- Keep browser visual checks as a useful manual/frontend gate when a browser runtime is available, but do not make browser downloads a required local MVP validation step.
