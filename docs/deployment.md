# Deployment Modes

Agent Room is a local-first app. The MVP should run for one to three humans and one to three agents without assuming a distributed SaaS deployment.

## Shared Prerequisites

- Bun runtime.
- SQLite file path through `AGENT_ROOM_DB_PATH`.
- Artifact directory through `AGENT_ROOM_ARTIFACT_DIR`.
- Local orchestrator token through `ORCHESTRATOR_LOCAL_TOKEN` before exposing beyond loopback.
- Secret values stored outside git, preferably a secret manager, with only `secret://agent-room/...` refs in SQLite/docs.

## Cloud/API Mode

Use this when a full OpenAI key is available and paid provider calls are approved.

- LLM: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.
- Voice room: future OpenAI Realtime session minting behind `VOICE_ROOM_PROVIDER=openai-realtime`.
- STT/TTS: OpenAI adapters can be added behind the existing provider interfaces.
- Approval gate: do not run paid/live provider validation without explicit approval.

## Mac Mini Local/Hybrid Mode

Use this as the default MVP operating mode.

- Run orchestrator and web UI on loopback.
- Use SQLite for durable room events and transcripts.
- Use `mock` voice locally until local STT/TTS is wired.
- Use LiteLLM or a local model endpoint through `LITELLM_BASE_URL` or `LOCAL_MODEL_BASE_URL` when available.
- Use browser/native STT, Whisper/local, Edge, Kokoro, or macOS TTS as future adapter implementations.

## Homelab LiveKit/LiteLLM Mode

Use this when LiveKit and local inference services are already available and explicitly approved for integration.

- Voice room: `VOICE_ROOM_PROVIDER=livekit`.
- LiveKit: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- LLM: `LITELLM_BASE_URL`, optional `LITELLM_API_KEY`, `LITELLM_MODEL`.
- STT/TTS: local Whisper/Kokoro/macOS or other homelab services behind adapters.
- Handoff: Hermes/Discord adapters remain server-side and approval-gated for live posting.

## Current MVP Voice State

`mock-voice-room` is the only active voice-room provider. OpenAI Realtime and LiveKit/WebRTC slots intentionally fail closed until live token minting and provider calls are implemented in a later approved pass. `LIVE_VOICE_PROVIDERS_ENABLED=0` is the documented default.

## Validation

```bash
bun install
bun run typecheck
bun run lint
bun run test
bun run test:e2e
bun run build
```

`bun run test:e2e` performs the local demo smoke without browser downloads, paid API calls, or homelab mutations.
