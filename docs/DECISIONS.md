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
