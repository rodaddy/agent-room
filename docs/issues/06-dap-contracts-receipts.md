## Goal
Add DAP-flavored contracts and visible receipts for agent-to-agent work.

## Deliverables
- shared schemas for dispatch, started, progress, blocked, and completed events
- a first transport abstraction that can target NATS or Redis Streams later
- UI rendering for receipts in the room timeline
- one demo flow where an agent hands work to another agent

## Acceptance criteria
- receipt payloads are versioned and typed
- room timeline shows agent lifecycle events in order
- handoff flow is visible to the human user
- contracts live in a shared package, not copied strings

## Notes for Codex
This is the piece that makes the app feel like cooperative agents instead of a single chatbot.
