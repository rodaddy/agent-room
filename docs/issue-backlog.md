# Agent Room MVP Issue Backlog

This backlog is derived from [PRD.md](PRD.md). The issues are sized so Codex can build the MVP in one or two serious implementation passes.

## Recommended Order

1. Monorepo scaffold and quality gates.
2. Room UI shell and mock event timeline.
3. Room event contracts and provider adapter interfaces.
4. Orchestrator WebSocket room protocol.
5. Deterministic routing and moderator state machine.
6. Config-driven text agents through provider adapters.
7. Context/workspace panel, receipts, and verification states.
8. Transcript persistence and local/Hermes/Discord handoff payloads.
9. Voice transport adapter slice.
10. E2E validation, deployment mode docs, and MVP demo script.

## First Serious Implementation Pass

Issues 1-5:

- establish the Bun/TypeScript monorepo
- create typed room event contracts
- render the target workroom layout with mock data
- wire real WebSocket room fanout
- implement deterministic routing and moderator queue behavior

Definition of done: local demo can open the room, show roster/timeline/context/receipts, send a message through WebSocket, resolve routing for `@all`, direct mentions, names, `both`, and interrupts, and emit lifecycle events with mock agents.

## Second Serious Implementation Pass

Issues 6-8:

- add config-driven agent participants
- connect LLM adapters for OpenAI/LiteLLM/local boundary
- add context/workspace receipts and verification states
- persist transcript/event history
- generate handoff payloads

Definition of done: MVP can run an end-to-end text workroom flow with real or mocked providers, preserve a transcript, generate local handoff output, and show context-linked receipts.

## Third Serious Implementation Pass

Issues 9-10:

- implement first voice transport adapter path with mock local sessions and fail-closed OpenAI Realtime/LiveKit slots
- add one-command local smoke validation, deployment docs, and demo script

Definition of done: MVP can demonstrate voice transcript events through the same room routing path as text, start/end a local mock voice session, keep OpenAI Realtime and LiveKit behind swappable adapter slots, and run one local command that validates the demo path without live provider spend or homelab mutation.

## GitHub Project Field Plan

Project: `https://github.com/users/rodaddy/projects/7`

Project number: `7`

Owner: `rodaddy`

Configured project fields:

- Work Status: Backlog, Todo, In Progress, In Review, Blocked, Done
- Phase: P0 Scaffold, P1 UI, P2 Orchestrator, P3 Agents, P4 Context/Persistence, P5 Voice, P6 Validation
- Priority: P0, P1, P2
- Component: Docs/Planning, UI, Orchestrator, Room Events, Routing, Agents, Providers, Voice, Persistence, Workspace, Handoff, Validation
- Validation: Not Started, Local Passed, E2E Passed, Live Check Pending, Live Check Passed, Blocked, Skipped With Reason
- Review Gate: Not Started, Initial Review Pending, Findings Posted, Fixes In Progress, Zero Known Issues, Deferred By Rico

GitHub's default `Status` field exists on the project with Todo, In Progress, and Done. Agents should use `Work Status` for the full board state and keep default `Status` compatible where useful.

## Board Hygiene

- Move issues to Todo before dispatching an implementation pass.
- Move issues to In Progress before worker execution starts.
- Keep Validation and Review Gate current from evidence, not intent.
- Do not close issues until acceptance criteria and validation commands have passed or Rico explicitly accepts a deferral.
