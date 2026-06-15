## Goal
Finish the MVP with end-to-end coverage and deployment docs.

## Deliverables
- Playwright smoke flow for room join, message send, agent reply, and receipt rendering
- basic service health checks
- deployment guide for web + orchestrator + Postgres + Redis
- production env var checklist
- architecture diagram or deployment sketch in docs

## Acceptance criteria
- one command runs the smoke suite locally
- deploy doc is sufficient for a fresh operator to stand the stack up
- health checks expose obvious failures
- README links to final docs

## Notes for Codex
Keep deployment assumptions explicit. No hidden platform magic.
