---
title: Auth and RBAC
tags: [area:reference, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Auth and RBAC

## Auth Pattern
- Primary auth provider: Supabase.
- Session handling uses SSR cookie sync through `/api/auth`.
- API guards support:
  - cookie-bound session auth
  - `Authorization: Bearer <token>` fallback

## Effective Authorization Model
- There is no rich role matrix encoded in this repo.
- The dominant authorization rule is resource ownership:
  - `projects.owner_id`
  - `chat_threads.created_by`
- Debug routes are protected mostly by environment gating, not a dedicated admin role.

## Practical RBAC Conclusion
- This app is currently owner-scoped rather than role-heavy.
- If you add a role-based feature, document the exact table/claim/check path because no canonical role system exists yet.

## Read Next
- `docs/02-reference/api.md`
- `docs/02-reference/database.md`
