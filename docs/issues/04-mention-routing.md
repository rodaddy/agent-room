## Goal
Implement explicit routing for `@agent-name` and `@all`.

## Deliverables
- mention parser shared between web and orchestrator
- routing rules for direct target, fanout, and default fallback
- visible room receipts when dispatch happens
- tests for parser edge cases

## Acceptance criteria
- `@all` fans out to every active agent persona
- `@frontend` routes only to the frontend agent
- unknown mentions fail gracefully with a room-visible warning
- routing behavior is covered by unit tests

## Notes for Codex
Treat routing as product behavior, not just string matching.
