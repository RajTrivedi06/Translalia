---
title: Roadmap
tags: [area:overview, audience:all, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Roadmap

## What this file is for
Repository-visible engineering themes only. This is not a full product roadmap.

## Scope Note
The repo does not contain an authoritative release plan with dates. Only themes that are directly visible in code, ADRs, scripts, and docs belong here.

## Active Themes Visible in Repo State
- Simplified prompt system remains the default translation path, with legacy rollback still preserved.
- Translation job orchestration is still an active concern: queue reconciliation, retry behavior, and Redis-backed worker flows have dedicated code and tests.
- Verification is being expanded as a two-track system with grading, context notes, analytics, and health routes.
- Diary/archive retrieval and journey summary generation are supported by dedicated API routes and SQL RPCs.
- Documentation and machine-readable contract coverage are being rebuilt to reduce agent confusion and stale guidance.

## Out of Scope
- Product dates
- staffing plans
- feature promises not represented in the repo

## Read Next
- `docs/project-brief.md`
- `docs/01-architecture/adr/0002-simplified-prompts.md`
