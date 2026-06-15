# Agent Room Quick Brief

Use this after loading `AGENTS.md`.

## One-Line Product

A browser room where Rico can type or speak with multiple named AI agents, route
work explicitly, watch progress/receipts, preserve transcripts, and hand off
summaries or action items to Hermes/Discord/local artifacts.

## Canonical Repo

This repo, `/Volumes/ThunderBolt/Development/agent-room`, is the canonical build
base.

Idea sources:

- `/Volumes/collab/rtech_ideas/voice-roundtable-mvp-v1-spec.md`
- `/Volumes/collab/rtech_ideas/consulting/voice-roundtable/voice-roundtable-v1-spec.md`
- `Skippy-the-Magnificent-one/voice-agent-workroom`

Use those for ideas, but reconcile them into this repo's PRD/issues before
implementation.

## Key Product Rules

- The room event model is the core.
- Voice is an input/output transport, not a separate app.
- Agents are config-driven participants.
- Routing is deterministic: `@agent`, `@all`, explicit names, interrupts.
- Receipts and verification are separate from natural-language claims.
- Provider adapters must be swappable.

## Required Modular Lanes

- LLM: OpenAI, LiteLLM, local model.
- STT: OpenAI, Whisper/local, browser/native where useful.
- TTS: OpenAI, Edge, Kokoro, macOS/local where useful.
- Voice room: OpenAI Realtime and/or LiveKit/WebRTC.
- Handoff: Hermes/Discord/local transcript artifact.

## Preferred First PRD Sections

- Goals and non-goals.
- Personas and room participants.
- Core UX.
- Event model and routing rules.
- Provider adapter interfaces.
- Voice architecture options.
- Local Mac mini M4 mode.
- Cloud/OpenAI-key mode.
- Homelab/LiveKit/LiteLLM mode.
- Security and secrets.
- Implementation phases and issue map.
- Acceptance tests.

## Working Defaults

- Use Bun/TypeScript unless the PRD changes it.
- Build vertical slices.
- Keep docs/issues synchronized with architecture changes.
- Run relevant checks before handoff.
- Use `/Volumes/ThunderBolt/_tmp` for temp work.
