---
title: API Contracts
tags: [area:reference, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# API Contracts

## Contract Rules
- `specs/openapi.yaml` is the machine-readable contract.
- `docs/02-reference/api.md` is the human-readable route catalog.
- Internal and debug routes stay discoverable, but they should not be treated as stable public APIs.

## Common Patterns
- Auth: cookie session first, bearer token fallback.
- Validation: route-local or shared `zod` schemas.
- Ownership: explicit project/thread ownership checks are normal even after auth succeeds.
- Errors: routes commonly return `{ error: ... }` with HTTP status carrying most of the contract weight.

## Versioning
- No explicit API versioning scheme is implemented in route paths.
- Changes should be treated as in-place contract changes and must be reflected in docs/specs together.

## High-Value Stable Shapes
- project create/delete
- thread create/delete/list
- method-1 and method-2 line translation
- translation job init/status
- notebook notes
- notebook suggestions
- diary completed-poem retrieval

## Read Next
- `docs/02-reference/api.md`
- `specs/openapi.yaml`
