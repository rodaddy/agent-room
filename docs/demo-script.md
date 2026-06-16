# MVP Demo Script

This script demonstrates the current local MVP without live provider spend or homelab changes.

## One-Command Smoke

```bash
bun run test:e2e
```

Expected result: JSON with `ok: true`, a runtime directory under `/Volumes/ThunderBolt/_tmp`, and checks for health, context, text routing, voice session, voice transcript routing, and transcript export.

## Interactive Demo

1. Start the app:

```bash
bun run dev
```

2. Open the Vite URL shown by the dev server.
3. Confirm the room shows roster, transcript, composer, voice controls, context panel, and receipts.
4. Attach a context snippet.
5. Send `@bilby status with context`.
6. Confirm routing, dispatch, agent reply, and receipt events appear in the transcript.
7. Click voice connect.
8. Send the mock voice transcript from the voice controls.
9. Confirm the transcript final event routes through the same agent path as text.
10. End the voice session.
11. Export the transcript.

## What Is Real

- Room event validation and fanout.
- SQLite-backed replay/projections.
- Deterministic routing.
- Config-driven agents with mock/OpenAI/LiteLLM/local HTTP LLM adapter boundaries.
- Context attachments and transcript export.
- Mock voice session lifecycle and final voice transcript routing.

## What Is Still Mocked Or Approval-Gated

- Live OpenAI Realtime session minting.
- LiveKit token minting and WebRTC room joins.
- Local Whisper/Kokoro/macOS STT/TTS wiring.
- Hermes or Discord live posting.
- Paid provider validation.
