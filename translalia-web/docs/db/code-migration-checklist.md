# Code Migration Checklist

This checklist tracks code changes needed when migrating from JSONB state storage to column-based storage in `chat_threads` table.

---

## Guide Answers Migration

### Objective
Migrate `guide_answers` from `chat_threads.state.guide_answers` (JSONB) to dedicated columns on `chat_threads` table.

### Files to Update:
- [ ] `src/store/guideSlice.ts` - Read from columns instead of JSONB
- [ ] `src/server/guide/updateGuideState.ts` - Write to columns AND JSONB
- [ ] `src/app/api/workshop/translate-line-with-recipes/route.ts` - Read from columns
- [ ] `src/lib/ai/variantRecipes.ts` - Read guide answers from columns

### Pattern: Dual-Read (prefer column, fallback to JSONB)
```typescript
// Before
const model = thread.state?.guide_answers?.translationModel ?? 'gpt-4o';

// After (transitional)
const model = thread.translation_model 
  ?? thread.state?.guide_answers?.translationModel 
  ?? 'gpt-4o';

// After (final, once JSONB keys removed)
const model = thread.translation_model ?? 'gpt-4o';
```

### Fields to Migrate:
- [ ] `translation_model` → `translationModel`
- [ ] `translation_method` → `translationMethod`
- [ ] `viewpoint_range_mode` → `viewpointRangeMode`
- [ ] `translation_intent` → `translationIntent`
- [ ] `translation_zone` → `translationZone`
- [ ] `source_language_variety` → `sourceLanguageVariety`

### Notes:
- Use transitional pattern during migration to support both old and new formats
- Once all reads are updated, remove JSONB fallback
- Update write paths to persist to both during transition, then remove JSONB writes

---

## Audit Trail Migration

### Objective
Migrate `method2_audit` array from `chat_threads.state.method2_audit` (JSONB) to dedicated `translation_audits` table.

### Files to Update:
- [ ] `src/lib/ai/audit.ts` - Insert to table instead of RPC
- [ ] Any analytics/dashboard code reading audits
- [ ] `src/app/api/verification/analytics/route.ts` - Update queries

### Pattern: Direct Table Insert
```typescript
// Before
await supabase.rpc('append_method2_audit', {
  p_thread_id: threadId,
  p_audit: auditRecord,
  p_max_n: 50
});

// After
await supabase
  .from('translation_audits')
  .insert({
    thread_id: threadId,
    line_index: auditRecord.lineIndex,
    stanza_index: auditRecord.stanzaIndex,
    mode: auditRecord.mode,
    model: auditRecord.model,
    recipe_cache_hit: auditRecord.recipe.cacheHit,
    recipe_schema_version: auditRecord.recipe.schemaVersion,
    phase1_pass: auditRecord.phase1?.pass,
    phase1_failed: auditRecord.phase1?.failed,
    gate_pass: auditRecord.gate.pass,
    gate_reason: auditRecord.gate.reason,
    gate_failed_constraints: auditRecord.gate.failedConstraints,
    gate_similarity: auditRecord.gate.similarity,
    regen_performed: auditRecord.regen?.performed,
    regen_worst_index: auditRecord.regen?.worstIndex,
    regen_variant_label: auditRecord.regen?.variantLabel,
    regen_strategy: auditRecord.regen?.strategy,
    regen_sample_count: auditRecord.regen?.sampleCount,
    regen_hard_pass_count: auditRecord.regen?.hardPassCount,
    created_at: new Date(auditRecord.ts)
  });
```

### Table Schema (to be created):
```sql
CREATE TABLE translation_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id),
  line_index integer,
  stanza_index integer,
  mode text NOT NULL,
  model text NOT NULL,
  recipe_cache_hit text,
  recipe_schema_version text,
  recipe_bundle_key text,
  phase1_pass boolean,
  phase1_failed text[],
  gate_pass boolean NOT NULL,
  gate_reason text,
  gate_failed_constraints text[],
  gate_similarity jsonb,
  regen_performed boolean,
  regen_worst_index integer,
  regen_variant_label text,
  regen_reason text,
  regen_strategy text,
  regen_sample_count integer,
  regen_hard_pass_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_translation_audits_thread_id ON translation_audits(thread_id);
CREATE INDEX idx_translation_audits_created_at ON translation_audits(created_at);
```

### Cleanup Steps:
- [ ] Remove `append_method2_audit` RPC function
- [ ] Remove `method2_audit` from `chat_threads.state` JSONB
- [ ] Migrate existing audit data from JSONB to table (if needed)

---

## Journey Items

### Objective
Ensure `journey_items` table usage is properly handled.

### Files to Update:
- [ ] Search for `journey_items` in codebase
- [ ] Update to use `journey_items_archive` if needed for historical access
- [ ] Remove any write paths if table is deprecated

### Current Usage:
- `src/app/api/journey/list/route.ts` - Reads from `journey_items`
- Verify if this table is still actively used or should be archived

### Notes:
- If `journey_items` is being deprecated, ensure read-only access maintained
- Consider archival strategy for historical data

---

## Translation Job State

### Objective
Consider migrating `translation_job` from JSONB to structured tables/columns.

### Files to Review:
- [ ] `src/lib/workshop/jobState.ts` - Currently manages JSONB state
- [ ] `src/lib/workshop/runTranslationTick.ts` - Reads/writes translation_job

### Potential Schema:
```sql
-- Consider separate tables for:
-- - translation_jobs (metadata)
-- - translation_chunks (chunk-level state)
-- - translated_lines (line-level results)
```

### Notes:
- This is a larger refactoring - evaluate complexity vs benefits
- Current JSONB approach works but may have performance/scalability concerns
- Keep as lower priority unless specific issues arise

---

## Migration Strategy

### Phase 1: Add Columns (Non-Breaking)
1. Add new columns to `chat_threads` table
2. Write to both JSONB and columns (dual-write)
3. No code changes yet

### Phase 2: Update Reads (Transitional)
1. Update read paths to prefer columns, fallback to JSONB
2. Test thoroughly
3. Monitor for any JSONB-only reads

### Phase 3: Remove JSONB Writes
1. Remove JSONB write paths
2. Keep JSONB reads as fallback for old data
3. Test migration path for existing data

### Phase 4: Cleanup (Breaking)
1. Remove JSONB fallback reads (breaking change for old data)
2. Remove JSONB keys from state
3. Archive/migrate any remaining JSONB data if needed

---

## Testing Checklist

### Guide Answers:
- [ ] Create new thread, verify columns populated
- [ ] Update guide answers, verify both JSONB and columns updated
- [ ] Read guide answers from old threads (JSONB fallback)
- [ ] Read guide answers from new threads (columns)

### Audit Trail:
- [ ] Verify audits insert to table
- [ ] Test analytics queries against new table
- [ ] Verify no RPC calls still used
- [ ] Test query performance

### Migration Script:
- [ ] Script to backfill columns from JSONB
- [ ] Script to migrate audit array to table
- [ ] Rollback plan if issues arise

---

## Rollback Plan

If issues arise during migration:

1. **Rollback Reads**: Revert to JSONB-only reads
2. **Keep Dual-Writes**: Continue writing to both during transition
3. **Data Integrity**: Verify no data loss during migration
4. **Performance**: Monitor query performance before/after

---

## Related Documentation

- Database schema changes: See migration files
- JSONB audit analysis: `docs/db/audit/findings.md`
- Code references: `docs/db/audit/code-references.clean.txt`

---

**Last Updated**: January 2026
