---
title: Project Brief
tags: [area:overview, audience:all, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Project Brief

## What this file is for
Short, code-backed description of what this repo is building and where the active work lives.

## Product Summary
Translalia is an AI-assisted poetry translation workspace. The product centers on helping a user move from source poem to line-level variants, notebook refinement, reflective feedback, and diary/archive views.

## Primary User Activities
- Define translation intent and constraints in the guide rail.
- Generate and compare multiple line-level translation variants.
- Save or manually edit chosen lines into a working translation.
- Refine full-poem output and annotate notes in the notebook flow.
- Generate reflection, feedback, and verification artifacts.
- Browse completed poems in the diary archive.

## Repo Scope
- `translalia-web/` contains the runnable Next.js application.
- Root `docs/` contains the canonical agent-facing documentation system.
- `specs/` contains machine-readable contract/config artifacts.

## Current Engineering Priorities Visible In Repo State
- Method-2 translation pipeline with simplified prompts as the default path.
- Background translation job orchestration with queue/lock hardening.
- Verification and context-note tracks behind feature flags.
- Diary/archive and journey summary retrieval from persisted thread state.

## Read Next
- `docs/01-architecture/system-overview.md`
- `docs/05-llm/DOC_MAP.md`
