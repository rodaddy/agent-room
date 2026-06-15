## Goal

Implement deterministic routing and moderator state behavior.

## Deliverables

- Shared routing parser for mentions, explicit names, `@all`, `both`, and interrupts.
- Moderator state machine for dispatch queue, hold, stop, cancellation, and blocked routing.
- Config-driven participant route names and aliases.
- Room-visible `routing.resolved` and `routing.warning` events.
- Unit tests for parser and state-machine edge cases.

## Acceptance Criteria

- `@all` fans out to every active agent persona.
- `@bilby` or `Bilby, ...` routes only to Bilby when configured.
- Multiple mentions preserve explicit order.
- `both` expands to the configured default pair/order.
- Unknown mentions emit a visible warning and do not silently dispatch.
- `stop`, `hold`, and `pause` cancel or hold queued work/speech where cancellable.
- Routing behavior is covered by unit tests.

## Validation

```bash
bun run test
bun run typecheck
```

## Notes For Codex

Treat routing as product behavior, not just string matching. Keep it pure enough that tests can pin the rules.
