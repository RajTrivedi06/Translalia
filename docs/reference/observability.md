---
title: Observability Reference
tags: [area:reference, audience:ops, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Observability Reference

## Signals by Layer
- Process health: `/api/health`
- Verification subsystem health: `/api/verification/health`
- Debug env/config inspection: `/api/debug/env-check`
- RPC health check: `/api/debug/test-rpc`
- Prompt/audit history: `prompt_audits`, `translation_audits`, `method2_audit`

## Logging Reality
- Logging is mostly structured console output plus debug-flag-gated verbose logs.
- Verification has in-memory metrics and optional Sentry forwarding.
- There is no repo-defined centralized logging stack or dashboard config.

## Best Starting Points During Incidents
- auth/session failures -> `/api/auth`, `/api/auth/whoami`, `/api/auth/debug-cookies`
- translation job failures -> `/api/workshop/translation-status`, Redis flags, worker logs
- JSONB patch failures -> `/api/debug/test-rpc`

## Read Next
- `docs/02-reference/observability.md`
- `docs/guides/operations-runbook.md`
