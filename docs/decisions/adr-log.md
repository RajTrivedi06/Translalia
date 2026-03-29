---
title: ADR Log
tags: [area:decisions, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# ADR Log

| ADR | Status | Topic | Link |
| --- | --- | --- | --- |
| 0001 | template | new ADR authoring template | `docs/01-architecture/adr/0001-template.md` |
| 0002 | accepted | simplified prompts replace archetype system as the intended operating mode, with rollback retained | `docs/01-architecture/adr/0002-simplified-prompts.md` |
| 0003 | accepted | aggregated Postgres metrics sink for scalability telemetry (no raw per-request writes) | `docs/01-architecture/adr/0003-telemetry-sink.md` |
| 0004 | accepted | decouple status polling from work advancement and add queue admission/retry/DLQ controls | `docs/01-architecture/adr/0004-poll-queue-decoupling.md` |

## Note
ADR 0001 is not an accepted decision; it remains the template file.
