---
title: Database Mapping
tags: [area:reference, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Database Mapping

## Product Concept to Storage

| Concept | Storage |
| --- | --- |
| workspace/project | `projects` |
| translation thread | `chat_threads` |
| translator settings | `chat_threads` columns plus legacy `state.guide_answers` |
| source poem text | `chat_threads.raw_poem` and some JSONB fallback reads |
| translation job | `chat_threads.state.translation_job` |
| saved workshop output | `chat_threads.state.workshop_lines` |
| notebook notes | `chat_threads.state.notebook_notes` |
| recipe cache | `chat_threads.state.variant_recipes_v3` (legacy reads: `variant_recipes_v2`, `variant_recipes_v1`) |
| prompt/verification audit rows | `prompt_audits`, `translation_audits` |
| reflection text | `journey_reflections` |
| generated journey summary | `journey_ai_summaries` |
| completed diary feed | `diary_completed_poems` RPC over thread + summary data |

## Update Strategy Notes
- Columns are preferred for core guide settings.
- JSONB remains the workflow state container.
- Atomic JSONB patching is required for single-path updates.

## Read Next
- `docs/02-reference/database.md`
- `docs/03-guides/add-migration.md`
