# Agent Room Agent Instructions

Instructions for coding agents (and humans) working in this repo.

## Repo Purpose

This is the canonical implementation repo for Agent Room / Voice Workroom: a
browser-based room where a person can type or speak with multiple named AI agents,
route work explicitly, see agent states and receipts, keep transcripts, and
handoff summaries/actions to Hermes, Discord, or local artifacts.

Use this repo as the build base. Treat other planning material as source input,
not as the canonical implementation repo.

Important source inputs:

- `README.md`
- `docs/architecture.md`
- `docs/issue-backlog.md`
- `docs/issues/`

The idea was inspired by an earlier voice-agent prototype.

## Product Direction

The app should be modular and provider-swappable. Do not hardwire the product to
one vendor, one model provider, or one host.

Primary modes to support over time:

- Cloud/API mode: full OpenAI key available; fast demo path using hosted text,
  STT, TTS, or realtime APIs where they make sense.
- Local/hybrid mode: usable on a Mac mini M4 or local box with local STT/TTS/LLM
  lanes, optionally routed through LiteLLM.
- Homelab mode: LiveKit/local services on a self-hosted box, with
  LiteLLM-first reasoning and Hermes/Discord handoff.

Core design principle: voice, text, routing, agents, tools, and persistence are
separate modules connected by typed room events. Voice is one transport, not the
core product model.

## MVP Shape

The first useful product is a room, not a generic chatbot:

- Human messages stay in the room timeline.
- Agent dispatch, progress, receipts, errors, and final replies are visible.
- `@agent`, `@all`, and named routing are deterministic.
- The moderator/orchestrator owns turn arbitration and interrupt behavior.
- Agent claims about tools/files must be backed by receipts or marked as
  unverified.
- Transcript capture is first-class.
- Voice input/output should attach to the same room state as text input/output.

Initial persona examples may include Rico, Bilby, Skippy, Moderator, and/or
generic roles such as builder, scribe, scout, tester. Prefer config-driven
personas over hard-coded role logic.

## Architecture Rules

- Prefer a Bun monorepo unless a later PRD explicitly changes this.
- Keep bounded packages clean:
  - `apps/web` for room UI.
  - `services/orchestrator` for routing, turn state, agent lifecycle, and room
    event fanout.
  - shared packages for event schemas, DAP/receipt contracts, agents, voice,
    providers, persistence, and workspace logic.
- Use typed event contracts. Do not pass raw string blobs between major
  subsystems.
- Keep provider adapters behind interfaces:
  - LLM providers: OpenAI, LiteLLM, local model lanes.
  - STT providers: OpenAI, Whisper/local, browser/native options.
  - TTS providers: OpenAI, Edge, Kokoro, macOS/local options.
  - Voice room providers: OpenAI Realtime, LiveKit/local WebRTC path.
- Do not make OpenAI Realtime the only possible voice architecture.
- Do not make local-only inference a v1 blocker.
- Keep secrets server-side and out of logs, fixtures, screenshots, issues, PRs,
  docs, and committed config.

## PRD And Issue Workflow

- A full PRD should be written before broad implementation.
- The PRD should reconcile this repo's OpenAI-oriented plan with a
  LiveKit/LiteLLM/local-capable voice path.
- Issues should be sized so Codex can build the MVP in one or two serious
  passes, with clear acceptance criteria and validation commands.
- If changing architecture direction, update `README.md`, `docs/architecture.md`,
  `docs/issue-backlog.md`, and `docs/issues/` together so workers do not build
  against stale instructions.
- For one/two-shot build prompts, prefer vertical slices over layer-only work:
  UI shell, typed events, realtime room, routing, agents, voice, receipts,
  persistence, and demo validation.

## Frontend Guidance

- Build the actual room experience first, not a marketing page.
- Target a dense, work-focused interface: roster/presence, transcript, composer,
  voice controls, context/workspace panel, receipts, and agent status.
- Use stable dimensions for room rails, transcript rows, controls, and cards so
  streaming/status text does not shift the layout.
- Use icons for tool controls where practical.
- Verify frontend work with a running dev server and browser screenshot/manual
  checks before calling it done.

## Git And Local Work

- Do not commit directly to protected branches.
- Keep scratch files, review checkouts, and test artifacts outside the repo;
  the tests and smoke script use the system temp directory.
- Treat unrelated worktree changes as user-owned.
