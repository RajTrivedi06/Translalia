# Database Context Pack

## What this file is for
Dense context for core data model and persistence patterns.

## When to read/use this
- Use for Supabase/Postgres schema changes, migration planning, and state persistence behavior.

## Data Stack Snapshot
- Primary store: Supabase PostgreSQL.
- Core auth/user identity attached to profile and project ownership.
- Thread-level workflow data persisted in chat/workspace-oriented tables.

## High-Value Entity Groups
- User/account entities: profile and ownership metadata.
- Project/thread entities: project records, chat threads, thread state.
- Translation workflow entities: source text, variants, notes, and completion state.
- Diary/archive entities: completed poem views and related metadata.

## Persistence Patterns to Preserve
- Thread-scoped state and recipe caches should remain stable across sessions.
- Mode-specific recipe cache entries should be scoped and version-aware.
- Keep schema-driven fields compatible with API response contracts.

## Migration and Safety Patterns
- Prefer additive, reversible migrations with explicit rollout notes.
- Validate query and API compatibility before removing or renaming fields.
- Document schema-impacting changes in `docs/02-reference/database.md`.
