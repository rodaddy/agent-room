# Agent Room / Voice Workroom PRD

Status: MVP planning source of truth
Canonical repo: `rodaddy/agent-room`
Idea sources: `Skippy-the-Magnificent-one/voice-agent-workroom` and the local Voice Roundtable specs

## 1. Summary

Agent Room is a browser-based workroom where Rico can type or speak with multiple named AI participants, route work explicitly, watch progress and receipts, preserve transcripts, and hand off session outcomes to Hermes, Discord, or local artifacts.

The core product is the room event stream. Text, voice, agents, tools, receipts, files, persistence, and handoff all read from and write to typed room events. Voice is an input/output transport attached to the room, not a separate architecture.

## 2. Goals

- Provide a dense, usable multi-agent room with roster, transcript, composer, voice controls, context/workspace panel, and receipts.
- Make routing deterministic for `@agent`, `@all`, multiple explicit names, natural explicit names such as "Bilby", and interrupt commands such as `stop`, `hold`, and `pause`.
- Keep agent progress observable through dispatch, started, progress, blocked, completed, receipt, transcript, and handoff events.
- Support provider-swappable adapters for LLM, STT, TTS, and voice-room transports.
- Work in three deployment modes: cloud/API, Mac mini M4 local/hybrid, and homelab LiveKit/LiteLLM.
- Preserve transcript history and make session handoff possible through Hermes, Discord, or local artifacts.
- Keep secrets server-side and make verification status distinct from natural-language agent claims.
- Produce an issue set and GitHub Project board that Codex can use to build MVP in one or two serious implementation passes.

## 3. Non-Goals

- No enterprise multi-org admin, billing, or role hierarchy in MVP.
- No assumption that OpenAI Realtime is the only voice architecture.
- No requirement that local-only inference, TN01 NPU acceleration, or local LLM fast lane be complete before MVP demo.
- No arbitrary tool execution without explicit receipt contracts and server-side controls.
- No hidden live infra mutation, credential lookup, or paid-provider usage without approval.
- No Codex conversation backend for normal room agent responses unless Rico explicitly chooses it later.

## 4. Personas And Participants

- Rico: human controller, can type, speak, route, interrupt, attach context, and request handoff.
- Moderator: non-speaking control plane that parses routing, arbitrates turns, holds/cancels queues, and emits room events.
- Bilby and Skippy: configurable named agent participants with prompts, model preferences, voice profiles, and display metadata.
- Generic build roles: builder, scribe, scout, tester, reviewer, or similar roles configured from data rather than hard-coded logic.
- Future agents: any participant loaded from persona config with `id`, `displayName`, `role`, `modelRoute`, `voice`, `tools`, and prompt references.

## 5. Core UX

The first screen is the room experience, not a landing page.

- Roster rail: participant list, role badges, connection state, speaking/thinking/blocked state, mute/voice status, and configured route names.
- Transcript timeline: human messages, agent replies, voice transcripts, moderator notices, dispatch events, receipts, errors, and handoff summaries.
- Composer: text input with mention detection, `@all`, multiple target chips, attached context indicator, send/hold controls, and visible routing preview.
- Voice controls: connect/disconnect, push-to-talk or hold-to-talk, transcript mode, spoken response toggle, interruption controls, and provider status.
- Context/workspace panel: attached snippets/files, workspace file list, selected preview, context references used by messages, and receipt-linked artifacts.
- Receipts: compact visible proof rows for reads, writes, tool actions, file changes, provider calls, errors, and verification status.

The provided sample interface is directionally correct: dark dense workroom, roster left, transcript center, workspace/context right, receipts inline, and agent state visible. MVP should keep the layout practical and stable rather than decorative.

## 6. Routing And Turn Arbitration

Routing is deterministic and test-covered.

- `@agent-name`: routes only to the matching active agent.
- `@all`: fans out to every active agent except the human and moderator.
- Multiple mentions: queues mentioned agents in message order unless a command says otherwise.
- Natural explicit names: "Bilby, ..." or "Skippy ..." routes to that agent when unambiguous.
- `both`: routes to the default pair in configured order, initially Bilby then Skippy, unless Rico gives another order.
- Ambiguous input: uses configured default policy. For the Bilby/Skippy voice roundtable, alternate by last-spoke rotation. For generic workroom text mode, default to moderator clarification or configured default recipients.
- Unknown mention: emits a room-visible warning and does not silently dispatch.
- Interrupts: `stop`, `hold`, `pause`, `shut up`, or UI stop cancels queued agent speech/work that is cancellable and emits cancellation events.
- Human priority: Rico can interrupt speech playback and pending agent queues.

## 7. Room Event Model

All subsystems communicate through versioned typed events. Event payloads must be schema-validated at service boundaries.

Core event envelope:

```json
{
  "id": "evt_01",
  "schemaVersion": "room.event.v1",
  "roomId": "room_abc",
  "threadId": "thread_123",
  "kind": "agent.dispatch",
  "from": "human:rico",
  "to": ["agent:bilby"],
  "replyTo": "evt_00",
  "createdAt": "2026-06-15T12:00:00Z",
  "payload": {}
}
```

MVP event kinds:

- `room.created`
- `participant.joined`
- `participant.left`
- `participant.state_changed`
- `message.created`
- `message.transcript_partial`
- `message.transcript_final`
- `routing.resolved`
- `routing.warning`
- `agent.dispatch`
- `agent.started`
- `agent.progress`
- `agent.completed`
- `agent.blocked`
- `agent.cancelled`
- `receipt.created`
- `context.attached`
- `workspace.file_observed`
- `workspace.file_changed`
- `voice.session_started`
- `voice.session_ended`
- `handoff.created`

Receipts are structured data, not prose claims. A claim can be `verified`, `unverified`, or `failed_verification`.

## 8. Provider Adapter Model

Provider choices are runtime configuration behind stable interfaces.

LLM adapters:

- OpenAI Responses API for cloud/API mode.
- LiteLLM proxy for homelab and provider routing.
- Local model adapter for llama.cpp, Ollama, vLLM, or equivalent local lane once benchmarked.

STT adapters:

- OpenAI STT for cloud/API mode.
- Whisper/local for Mac mini M4 and homelab mode.
- Browser/native speech APIs where useful for low-friction prototypes, marked as limited reliability.

TTS adapters:

- OpenAI TTS for cloud/API mode.
- Edge TTS for fast hybrid fallback.
- Kokoro for local/homelab target.
- macOS/local speech for Mac mini M4 low-dependency path where acceptable.

Voice room adapters:

- OpenAI Realtime for fast cloud/API demos.
- LiveKit/WebRTC for homelab, multi-participant audio routing, and local STT/TTS pipelines.

The orchestrator must not depend on provider-specific event shapes outside adapter packages.

## 9. Deployment Modes

### Cloud/API Mode

Use a full OpenAI key to run text agents, STT/TTS, and optionally OpenAI Realtime. This is the fastest hosted demo path, but it still writes canonical room events and can be swapped later.

### Mac Mini M4 Local/Hybrid Mode

Run the web app and orchestrator locally. Prefer local Whisper or native/browser STT, Edge/macOS/Kokoro TTS, and either LiteLLM or a local model adapter for LLM turns. This mode should work without requiring homelab LiveKit for text and basic voice experiments.

### Homelab LiveKit/LiteLLM Mode

Use self-hosted LiveKit/WebRTC for audio, LiteLLM for primary reasoning, local Whisper for STT, Edge/Kokoro for TTS, and local transcript/handoff services. TN01 and the referenced LiteLLM proxy are idea-source targets, not hard-coded defaults in repo docs. Live host, IP, and credential work requires separate approval and verification.

## 10. Transcript, Handoff, And Persistence

MVP persistence stores rooms, participants, messages, events, context items, receipts, voice sessions, and handoffs.

Handoff targets:

- Local artifact: markdown/json transcript and summary.
- Hermes: structured handoff payload for session summary and actions.
- Discord: concise summary or artifact pointer at session end, not live channel spam by default.

Transcript records include participant, timestamp, source transport, final/partial status, route resolution, linked receipts, and context references.

## 11. Workspace, Files, Receipts, And Verification

The room can show workspace files and context items, but MVP does not need browser-based repo editing.

- File/context observations emit receipts.
- File writes or tool actions require server-side authorization and explicit receipt payloads.
- Agent statements like "I changed X" are not trusted unless backed by `workspace.file_changed` or equivalent receipts.
- Verification commands and manual checks should be recorded as receipt events when available.
- UI must distinguish `filesystem-verified`, `provider-reported`, `manual`, `unverified`, and `failed`.

## 12. Security And Secrets

- Secrets stay server-side and are never exposed to browser code, logs, docs, issues, screenshots, fixtures, or PR bodies.
- `.env.example` lists variable names only.
- Provider keys and LiveKit secrets come from env or secret store.
- Room access starts with local/dev auth and evolves to lightweight user auth before persistent shared deployment.
- WebSocket and voice tokens must be short-lived.
- Handoff integrations must avoid posting raw secrets or sensitive transcript contents to public channels.

## 13. MVP Implementation Phases

Phase 0: scaffold and contracts

- Bun monorepo, TypeScript, lint/typecheck/test placeholders.
- Shared room event schemas and provider interfaces.
- Local mock provider mode.

Phase 1: room UI vertical slice

- Roster, transcript, composer, voice controls shell, context panel, receipts.
- Mock transport proves the target UX.

Phase 2: orchestrator and realtime room

- WebSocket event gateway, participant presence, message fanout, routing resolution.
- Deterministic route tests.

Phase 3: text agents and receipts

- Config-driven agents.
- OpenAI and LiteLLM adapters.
- Agent lifecycle events and visible blocked/error states.

Phase 4: context, workspace, persistence, and handoff

- Context panel, attachments/snippets, transcript storage, local handoff payload.
- Hermes/Discord payload shape without requiring live posting in local tests.

Phase 5: voice adapter slice

- Voice controls connected to adapter abstraction.
- OpenAI Realtime or LiveKit path implemented behind provider boundary.
- Transcript events mirrored into the room.

Phase 6: validation and deploy docs

- E2E smoke tests, health checks, deployment mode docs, env checklist, demo script.

## 14. Acceptance Tests And Validation Commands

Planned commands:

```bash
bun install
bun run typecheck
bun run lint
bun run test
bun run test:e2e
bun run dev
```

Acceptance tests:

- Room UI renders roster, transcript, composer, voice controls, context panel, and receipts without backend.
- Two browser clients see the same realtime room messages and participant state.
- Routing parser handles `@all`, direct mentions, multiple mentions, natural names, unknown mentions, `both`, and interrupts.
- Addressed text agents respond through configured provider adapters, and provider failures create blocked receipts.
- Room timeline displays verified and unverified receipts distinctly.
- Context attachments are passed as structured metadata and linked to messages.
- Voice transcript final events appear in the same timeline as typed messages.
- Persistence survives refresh for room history.
- Handoff generation creates a local structured summary with participants, actions, blockers, and artifact path.
- E2E smoke covers join, message send, route dispatch, agent reply, receipt rendering, and transcript/handoff path.

## 15. Issue Map

The MVP is tracked as ten issues in `docs/issues/` and on the GitHub Project board:

1. Monorepo scaffold and quality gates.
2. Room UI shell and mock event timeline.
3. Room event contracts and provider adapter interfaces.
4. Orchestrator WebSocket room protocol.
5. Deterministic routing and moderator state machine.
6. Config-driven text agents through OpenAI/LiteLLM/local adapter boundary.
7. Context/workspace panel, receipts, and verification states.
8. Transcript persistence and local/Hermes/Discord handoff payloads.
9. Voice transport adapter slice for OpenAI Realtime and LiveKit/WebRTC.
10. E2E validation, deployment mode docs, and MVP demo script.

Recommended first serious implementation pass: issues 1-5 plus enough mock UI/provider support to demo deterministic event flow.

Recommended second serious implementation pass: issues 6-10 to add real providers, persistence, voice, handoff, and deploy validation.
