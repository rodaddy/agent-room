## Goal
Persist rooms and add lightweight authentication.

## Deliverables
- Postgres schema and migrations
- room/message persistence
- auth integration using Clerk or NextAuth
- room list / resume UX
- basic ownership rules for room access

## Acceptance criteria
- refreshing the page preserves room history
- authenticated user identity is shown in the room
- unauthorized room access is blocked
- migrations and local dev DB setup are documented

## Notes for Codex
Prefer the least magical auth path that works cleanly with the chosen Next.js app structure.
