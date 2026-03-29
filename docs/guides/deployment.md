---
title: Deployment Guide
tags: [area:guides, audience:ops, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Deployment Guide

## Scope Note
The repo does not encode one authoritative deployment platform. This guide only documents what can be verified from code and the build sanity report.

## Verified Facts
- The app builds with `npm run build`.
- `next.config.ts` includes Next.js and `next-intl` configuration.
- `VERCEL_ENV` and `VERCEL_REGION` are referenced, so Vercel-like environments are part of the expected runtime model.
- Redis becomes important for production queue/lock behavior.

## Minimum Deployment Checklist
- set `OPENAI_API_KEY`
- set `NEXT_PUBLIC_SUPABASE_URL`
- set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- set Redis credentials if production queue/lock features should work
- do **not** set `DEBUG_API_ENABLED` in production (leave unset/`0` unless explicitly needed for incident debugging)
- run `npm run typecheck`
- run `npm run build`

## Known Unknowns
- No infra-as-code or platform-specific deployment manifest is present in this repo.
- Operational scaling, background worker hosting, and alert routing are not fully specified here.

## Read Next
- `docs/02-reference/config-and-env.md`
- `docs/guides/operations-runbook.md`
