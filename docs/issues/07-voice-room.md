## Goal
Add first-class voice support using the OpenAI Realtime API.

## Deliverables
- voice connect controls in the room UI
- backend endpoint to mint or broker realtime session config
- live transcript rows in the room timeline
- optional spoken agent response toggle
- voice error handling and session cleanup

## Acceptance criteria
- user can start a voice session from the room
- transcript messages appear inline with text chat
- voice uses the same room context as text turns
- failures are visible and recoverable without reloading the whole app

## Notes for Codex
Do not treat voice as a separate app. It should feel native to the same room.
