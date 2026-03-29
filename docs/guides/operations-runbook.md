---
title: Operations Runbook
tags: [area:guides, audience:ops, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Operations Runbook

## First Checks
- `/api/health`
- `/api/verification/health`
- `/api/debug/env-check` in non-production
- `/api/debug/test-rpc` when atomic state patching looks broken

## Common Incidents

| Incident | First move |
| --- | --- |
| translation jobs stop advancing | inspect `translation-status` behavior and Redis config |
| notebook or guide state writes fail | verify `exec_sql` / `patch_thread_state_field` RPCs |
| verification silently missing | confirm Track A / Track B flags |
| auth regressions | confirm `/api/auth` cookie sync and `/api/auth/whoami` |

## Worker Notes
- `npm run worker:translations` runs the background worker.
- In production-like operation, missing Redis is not a minor warning for queue-backed flows.

## Read Next
- `docs/02-reference/observability.md`
- `docs/03-guides/troubleshooting.md`
