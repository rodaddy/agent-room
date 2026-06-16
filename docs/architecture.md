# Architecture

Agent Room is organized around typed room events. UI, voice, agents, receipts, persistence, and handoff all consume or emit the same event envelope.

## System View

```text
Browser Room UI
  -> WebSocket room event stream
  -> optional voice transport adapter
  -> context/workspace panel

Orchestrator
  -> room event validation and fanout
  -> deterministic routing and moderator state
  -> agent lifecycle
  -> provider adapters
  -> receipt and persistence write path

Provider adapters
  -> LLM: OpenAI, LiteLLM, local model
  -> STT: OpenAI, Whisper/local, browser/native
  -> TTS: OpenAI, Edge, Kokoro, macOS/local
  -> voice room: OpenAI Realtime, LiveKit/WebRTC

Persistence and handoff
  -> SQLite local store
  -> transcript artifacts
  -> Hermes/Discord payloads
```

## Bounded Packages

### `apps/web`

Owns the browser room:

- roster rail
- transcript timeline
- composer and routing preview
- voice controls
- context/workspace panel
- receipt rendering

### `services/orchestrator`

Owns room behavior:

- WebSocket room sessions
- event ingestion, validation, and fanout
- participant presence and lifecycle state
- deterministic mention/name routing
- moderator queue, hold, stop, and cancellation behavior
- provider brokering
- persistence and handoff writes

### `packages/room-events`

Owns versioned schemas for:

- room event envelope
- participant state
- messages and transcripts
- routing decisions
- dispatch and lifecycle events
- receipts and verification states
- context/workspace references
- handoff payloads

### `packages/provider-adapters`

Owns stable interfaces and provider implementations:

- `LlmProvider`
- `SttProvider`
- `TtsProvider`
- `VoiceRoomProvider`
- provider config validation
- normalized error and timeout behavior through `LLM_PROVIDER_TIMEOUT_MS`

### `packages/agents-sdk`

Owns:

- config-driven persona loading from Hermes backup metadata and local fallbacks
- agent turn execution
- prompt/context assembly
- lifecycle event emission
- provider response normalization

### `packages/voice`

Owns:

- voice session state
- transcript partial/final normalization
- interruption and playback cancellation contracts
- OpenAI Realtime and LiveKit/WebRTC adapter glue

### `packages/workspace`

Owns:

- context item metadata
- file/snippet references
- receipt-linked artifact descriptors
- verification state helpers

### `packages/persistence`

Owns:

- SQLite schema/migrations for the local MVP
- room, participant, message, event, receipt, context, voice session, and handoff storage
- local API key hash storage and Vaultwarden secret references
- transcript artifact export

## Room Event Flow

1. Human sends text or final voice transcript.
2. Web app emits `message.created`.
3. Orchestrator validates the event.
4. Moderator resolves routing and emits `routing.resolved` or `routing.warning`.
5. Orchestrator emits `agent.dispatch` for each target.
6. Agent adapter emits `agent.started`, `agent.progress`, `receipt.created`, `agent.completed`, `agent.blocked`, or `agent.cancelled`.
7. Persistence stores canonical events.
8. UI renders the event stream in order.

## Voice Flow

OpenAI Realtime and LiveKit are peer adapter options.

Current MVP path:

1. Browser requests `POST /rooms/:roomId/voice/session`.
2. Orchestrator uses `VoiceRoomProvider` to create a short-lived session config.
3. The default `mock-voice-room` provider emits `voice.session_started` with transport `mock`.
4. Final browser transcript events use `message.transcript_final`.
5. Orchestrator routes final transcripts through the same moderator, agent dispatch, context, receipt, and persistence path as text messages.
6. Browser ends the session with `POST` or `DELETE /rooms/:roomId/voice/session/:sessionId/end`.
7. Orchestrator emits `voice.session_ended`.

OpenAI Realtime path:

1. Browser requests a voice session from orchestrator.
2. Orchestrator mints provider-specific session config server-side.
3. Browser streams audio through the Realtime provider.
4. Transcript and response events are normalized into room events.

LiveKit/WebRTC path:

1. Browser joins a LiveKit room with a short-lived token.
2. STT service consumes audio tracks and emits transcript events.
3. Moderator routes final transcripts to configured agents.
4. LLM adapter returns text.
5. TTS adapter publishes audio back to the LiveKit room.
6. Transcript and receipts remain canonical room events.

## Routing State Machine

Routing must be pure enough for unit tests.

- explicit mention wins
- multiple explicit mentions preserve order
- `@all` expands to active agents
- natural exact names route when unambiguous
- `both` expands to configured pair/order
- unknown target emits warning
- interrupts cancel cancellable queue/playback
- ambiguous routing uses configured policy

## Persistence Model

Minimum durable entities:

- rooms
- participants
- room_events
- messages
- agent_dispatches
- receipts
- context_items
- voice_sessions
- handoffs
- identities
- room_members
- api_keys
- provider_configs

The event log is the replay source. Tables optimized for views can be derived from the event log when useful.

For the MVP, SQLite is the local source of replayable state. Secret material is never stored in SQLite; rows may store one-way API key hashes and non-secret Vaultwarden refs such as `vaultwarden://agent-room/orchestrator-local-token`.

## Security Boundaries

- Provider secrets stay server-side.
- Vaultwarden stores local API keys/provider secrets; SQLite stores hashes and references only.
- Durable local tokens are accepted through bearer auth for exposed use; query-string tokens are loopback-development only.
- Browser receives short-lived room/voice tokens only.
- Adapter errors are sanitized before becoming room events.
- Receipts must not include secret values.
- Live integrations such as Hermes/Discord are invoked only through approved server-side adapters.

## MVP Validation Surface

- schema tests for events and receipts
- route parser/state machine tests
- WebSocket two-client smoke
- mocked provider room demo
- provider failure-to-blocked-event tests
- local smoke flow through `bun run test:e2e`
- browser visual/manual checks when a browser runtime is available
- handoff payload fixture test

Live voice, provider spend, browser downloads, and homelab service mutation are approval-gated validation steps.
