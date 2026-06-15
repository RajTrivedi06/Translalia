# Cache Coherence Audit

## Cache Layers

This project has 5 caching layers. This audit classifies each as safely TTL-only or needing active/event-driven invalidation.

---

## Layer 1: Redis / In-Memory Server Cache

All keys prefixed with `cache:` in Upstash Redis. Falls back to in-memory Map in dev.

| Key pattern | TTL | Safely TTL-only? | Risk | Notes |
|-------------|-----|-------------------|------|-------|
| `recipes:{threadId}:{mode}:{contextHash}` | 1h | Yes | Low — context-hash invalidation handles content changes. If thread context changes, hash changes, new cache entry. | Reference pattern for content-addressed invalidation. |
| `workshop:translate-line:{threadId}:line:{lineIndex}:model:{model}` | 1h | Acceptable | Low — translation results are idempotent for same input. Stale entry just means user sees cached translation until TTL. | |
| `suggestions:line:{threadId}:{lineIndex}:{targetLang}:{hash}` | 1h | Yes | Low — hash-keyed, content-addressed. | |
| `suggestions:token:{threadId}:{lineIndex}:{targetLang}:{hash}` | 1h | Yes | Low — hash-keyed, content-addressed. | |
| `notebook-suggestions:{threadId}:{step}:{hash}` | 30m | Yes | Low — hash-keyed. | |
| `rhyme-workshop:{threadId}:{lineIndex}:{hash}` | 30m | Yes | Low — hash-keyed. | |
| `ai-assist:{threadId}:{cellId}:{wordsKey}:{instruction}` | 1h | Acceptable | Medium — if a user edits content then asks for the same instruction, they get stale assist. Key includes wordsKey so most edits create a new key. | |
| `ai-assist-step-c:{threadId}` | 1h | Needs review | Medium — keyed only by threadId with no content hash. If thread content changes within 1h, user gets stale contextual suggestions. | Consider adding a content hash to the key, or reducing TTL. |
| `context:{threadId}:{lineIndex}:{tokenIndex}` | 1h | Acceptable | Low — context notes are informational and don't affect translation quality. Stale notes are tolerable. | |

### Verdict

Most Redis caches are safely TTL-only because they use content-hash-addressed keys. The `ai-assist-step-c` key is the weakest — consider adding a context hash.

No event-driven invalidation is needed at current scale. `cacheDelete` exists but is unused.

---

## Layer 2: React Query (Client)

| Query key | staleTime | refetchInterval | Risk | Classification |
|-----------|-----------|-----------------|------|----------------|
| `translation-job` | 0 | 1500ms | Low — always fresh, but high polling load. | TTL-only (fine, but interval needs tuning — see Phase 2). |
| `guide-state` | 5 min | none | Medium — if guide state changes server-side (e.g., via another tab), this tab serves stale data for up to 5 min. | Acceptable at current scale. Could add refetchOnWindowFocus. |
| `context-notes` | 1h | none | Medium — if context notes are regenerated, user sees stale notes for up to 1h. | Acceptable — notes are informational. |
| `workshop-state` | 30s | none | Low — 30s is short enough. Mutations likely trigger manual refetch. | Safely TTL-only. |
| `notebook-notes` | 30s | none | Low — 30s is short. | Safely TTL-only. |
| `verification-analytics` | 1 min | 5 min | Low — analytics data is inherently lagged. | Safely TTL-only. |
| `grade-detail` | Infinity | none | Low — grades are immutable once created. | Safely TTL-only (immutable data). |
| `verification-health` | default | 30s | Low — health is read-only status. | Safely TTL-only. |

### Verdict

No event-driven invalidation needed at current scale. Key concern: `translation-job` polls too frequently (1.5s fixed) — addressed in Phase 2 adaptive backoff.

---

## Layer 3: localStorage / threadStorage

| Store | Data | Risk | Classification |
|-------|------|------|----------------|
| `workshop-storage:{threadId}` | Draft lines, selected variants, line index | Low — local UI state, thread-scoped. | Client-only, no coherence risk with server. |
| `guide-storage:{threadId}` | Guide answers | Low — local persistence of answers. | Client-only. |
| `notebook-storage:{threadId}` | Font size, line numbers, UI prefs | None — pure UI state. | Client-only. |
| `last-thread-id` | Last active thread ID | None — navigation convenience. | Client-only. |

### Verdict

No coherence risks. These are client-side UI state stores with no server-side counterpart that could diverge.

---

## Layer 4: Next.js Fetch Cache

| Usage | TTL | Risk | Classification |
|-------|-----|------|----------------|
| Datamuse rhyme API (perfect + near) | 1h | None — external dictionary data is static. | Safely TTL-only. |
| Thread list, auth, translation-status | `no-store` / `revalidate=0` | None — correctly bypasses cache. | No caching (correct). |

### Verdict

No coherence risks. External API data is static; dynamic routes correctly disable caching.

---

## Summary

| Layer | Needs active invalidation? | Action required |
|-------|---------------------------|-----------------|
| Redis server cache | No (at current scale) | Review `ai-assist-step-c` key — consider adding content hash. |
| React Query | No | Tune `translation-job` polling interval (Phase 2). |
| localStorage | No | None. |
| Next.js fetch | No | None. |

### Reference pattern

The recipe cache (`variantRecipes.ts`) uses context-hash-addressed keys. This is the best pattern in the codebase — content changes automatically create new cache entries without explicit invalidation. Other caches should adopt this pattern where feasible.
