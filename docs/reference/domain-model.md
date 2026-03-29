---
title: Domain Model
tags: [area:reference, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Domain Model

## Core Entities
- Project: top-level workspace container.
- Thread: one translation workspace under a project.
- Guide context: poem text plus translator preferences and mode choices.
- Workshop line: saved translation result for one source line.
- Notebook note: thread-level or line-level reflection/editing note.
- Journey reflection: reflective artifact tied to a thread.
- Journey AI summary: generated summary used by diary/archive views.
- Diary entry: derived view over completed thread data rather than a standalone table.

## Relationships
- One project has many threads.
- One thread owns the working translation state in `chat_threads.state`.
- One thread can accumulate many saved workshop lines, notebook notes, reflections, audits, and journey summary artifacts.

## Persistence Split
- Stable thread metadata uses columns on `chat_threads`.
- Evolving workflow state still lives in `chat_threads.state`.

## Read Next
- `docs/02-reference/database.md`
- `docs/reference/db-mapping.md`
