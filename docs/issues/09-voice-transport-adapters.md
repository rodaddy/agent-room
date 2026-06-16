## Goal

Add first-class voice support through swappable voice transport, STT, and TTS adapters.

## Deliverables

- Voice controls connected to room state.
- `VoiceRoomProvider` interface with OpenAI Realtime and LiveKit/WebRTC implementation slots.
- `SttProvider` interface with OpenAI, Whisper/local, and browser/native slots.
- `TtsProvider` interface with OpenAI, Edge, Kokoro, and macOS/local slots.
- Backend endpoint for short-lived voice/session config.
- Live transcript events mirrored into the room timeline.
- Optional spoken agent response toggle.
- Voice error handling, hold/stop cancellation, and session cleanup.

## Acceptance Criteria

- User can start and end a voice session from the room.
- Transcript final events appear inline with text chat.
- Voice uses the same room context, routing, and receipts as text turns.
- OpenAI Realtime is not the only possible voice architecture.
- LiveKit/WebRTC path is represented by an adapter boundary even if the first live implementation uses another provider.
- Failures are visible and recoverable without reloading the whole app.

## Validation

```bash
bun run test
bun run test:e2e
bun run typecheck
```

Manual/live voice validation requires explicit approval for provider usage or homelab service changes.

## Notes For Codex

Do not treat voice as a separate app. It should feel native to the same room event stream.

## Implementation Notes

- The MVP uses `POST /rooms/:roomId/voice/session` and `POST`/`DELETE /rooms/:roomId/voice/session/:sessionId/end` for voice session lifecycle.
- `mock-voice-room` is the default local transport and emits `voice.session_started`/`voice.session_ended` room events.
- OpenAI Realtime and LiveKit/WebRTC are represented as provider slots that fail closed until a later approved live integration adds token minting and provider calls.
- `message.transcript_final` events are routed through the same moderator, agent dispatch, context, receipt, persistence, and transcript export path as text messages.
