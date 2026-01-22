# Database Audit Findings (Phase 0)

**Date:** 2026-01-20  
**Auditor:** Raj  
**Scope:** Supabase (schema: `public`) — candidate cleanup tables + `chat_threads.state` JSONB profiling  
**Goal:** Prove safety for Phase 1 soft-deprecation (rename) and identify hard dependencies.

---

## 1) Candidate tables audited (11)

- chat_messages
- compares
- corpora
- corpus_chunks
- corpus_files
- human_evals
- llm_calls
- poems
- prompt_packs
- source_texts
- uploads

---

## 2) Row counts (evidence: all empty)

All candidate tables returned **row_count = 0**:
- chat_messages, compares, corpora, corpus_chunks, corpus_files, human_evals, llm_calls,
  poems, prompt_packs, source_texts, uploads

**Decision impact:** empty tables are eligible for rename/drop **IF** dependencies are handled.

---

## 3) DB-level dependencies (FK audit)

### 3.1 Hard blockers (must be handled before dropping)

| Table | Dependency | Why it matters | Decision |
|------|------------|----------------|----------|
| compares | `journey_items.compare_id → compares.id` | prevents dropping compares until FK/column removed | Handle in Phase 3 |
| source_texts | `versions.source_text_id → source_texts.id` | prevents dropping source_texts until `versions` FK/column handled | KEEP (normalization anchor) |

### 3.2 Internal-only chains (safe if done together)

| Chain | Dependencies | Decision |
|------|--------------|----------|
| corpus_* | chunks/files reference corpora and files | Safe to deprecate as a set (Phase 1) |

### 3.3 Outbound-only FKs (safe to rename/drop)

| Table | Outbound FKs to | Notes | Decision |
|------|------------------|-------|----------|
| chat_messages | chat_threads, projects | no inbound deps | Phase 1 |
| llm_calls | chat_threads, projects, versions | no inbound deps | Phase 1 |
| human_evals | projects, versions | no inbound deps | Phase 1 |

---

## 4) Views + triggers audit

- Views referencing candidates: **none found**
- Triggers referencing candidates: **none found**

**Decision impact:** no hidden dependencies from views/triggers.

---

## 5) Functions/RPC audit

Initial scan matched Supabase Storage internal function due to the substring “uploads”.
Confirmed that no functions/procedures reference `public.<candidate_table>` when using a strict scan.

**Decision impact:** safe from function-level dependencies.

---

## 6) Codebase dependency audit (ripgrep results)

Supabase `.from()` usage found for:
- chat_threads, projects, versions, journey_items, journey_reflections, prompt_audits, translation_jobs, admin_audit_log

Supabase `.rpc()` usage found:
- append_method2_audit, append_method2_audit_v2, exec_sql, set_user_is_admin

**No code references found for these candidate tables as DB tables:**
- chat_messages, compares, corpora, corpus_chunks, corpus_files, human_evals, llm_calls, poems, prompt_packs, source_texts, uploads  
(Any literal word matches like “poems” were within text/prompts, not DB access.)

---

## 7) JSONB profiling (`chat_threads.state`) summary

### 7.1 Key frequency (threads_with_key)
Top keys observed:
- guide_answers: 136
- raw_poem: 131
- poem_stanzas: 131
- translation_job: 131
- variant_recipes_v3: 45
- workshop_lines: 37
- method2_audit: 28
- notebook_notes: 7
- poem_analysis: 1
- workshop_line_notes: 1

### 7.2 State size distribution
- total_threads: 162
- avg_state_bytes: 8753
- p50_state_bytes: 7365
- p90_state_bytes: 19052
- max_state_bytes: 93274

Largest blobs strongly correlate with `workshop_lines`.

### 7.3 method2_audit sizing
- threads_with_audit: 28
- audit_entries_total: 187
- avg_entries_per_thread: 6.68
- max_entries_on_single_thread: 19
- Timestamp format sample: ISO strings (e.g., `2026-01-13T06:00:18.443Z`)

**Decision impact:** extracting `method2_audit` to a table remains justified; timestamps are consistent ISO strings.

---

## 8) Phase 1 plan (based on evidence)

### Phase 1 candidates (safe to soft-deprecate via rename)
- poems
- prompt_packs
- uploads
- chat_messages
- llm_calls
- human_evals
- corpus_chunks
- corpus_files
- corpora

### NOT in Phase 1
- compares (blocked by journey_items FK; handle Phase 3)
- source_texts (referenced by versions; KEEP as normalization anchor)

---

## 9) Phase 0 exit gate

✅ DB FK audit complete  
✅ Views audit complete  
✅ Triggers audit complete  
✅ Functions audit complete (public-only)  
✅ Row counts verified (all 0)  
✅ Codebase audit complete  
✅ JSONB profiling complete  

**Phase 0 status: COMPLETE**
