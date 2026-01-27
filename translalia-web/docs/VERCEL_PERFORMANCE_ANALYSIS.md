# Translalia Web: Vercel Performance Analysis Report

**Date:** January 27, 2026  
**Application:** Translalia Web (Poetry Translation Workshop)  
**Framework:** Next.js 15.4.8  
**Deployment:** Vercel (Serverless)

---

## Executive Summary

This report analyzes why the Translalia application runs slower on Vercel compared to localhost. The investigation identified **7 primary factors** contributing to latency, ranging from serverless cold starts to external API dependencies. The application's architecture—featuring 39 API routes, multiple LLM calls, and distributed state management—is particularly susceptible to serverless deployment overhead.

---

## Table of Contents

1. [Primary Performance Factors](#1-primary-performance-factors)
2. [Application-Specific Analysis](#2-application-specific-analysis)
3. [API Route Deep Dive](#3-api-route-deep-dive)
4. [External Service Dependencies](#4-external-service-dependencies)
5. [In-Memory Cache Problem](#5-in-memory-cache-problem)
6. [Cold Start Analysis](#6-cold-start-analysis)
7. [Recommendations Summary](#7-recommendations-summary)
8. [Viewing Logs on Vercel](#8-viewing-logs-on-vercel)

---

## 1. Primary Performance Factors

| Factor | Impact | Localhost | Vercel |
|--------|--------|-----------|--------|
| Cold Starts | **High** | None | 500ms - 3s per function |
| In-Memory Cache | **Critical** | Persistent | Lost on each invocation |
| Network Latency | **Medium** | 0ms | 50-200ms per external call |
| Database Connections | **Medium** | Pooled/reused | New connection each time |
| Redis Connections | **Medium** | Singleton | New per invocation |
| OpenAI API Distance | **Low-Medium** | Same latency | Same (but compounds with above) |
| Bundle Size | **Low** | No impact | Affects cold start duration |

---

## 2. Application-Specific Analysis

### 2.1 Architecture Overview

Translalia has a complex architecture optimized for localhost development:

```
┌─────────────────────────────────────────────────────────────┐
│                     Translalia Web                          │
├─────────────────────────────────────────────────────────────┤
│  39 API Routes (Serverless Functions on Vercel)             │
│  ├── /api/workshop/* (13 routes) - Translation operations   │
│  ├── /api/notebook/* (4 routes)  - AI assist, prismatic     │
│  ├── /api/verification/* (5 routes) - Grading, feedback     │
│  ├── /api/journey/* (4 routes)   - Reflections              │
│  └── /api/auth/*, /api/threads/*, etc.                      │
├─────────────────────────────────────────────────────────────┤
│  External Dependencies (per request):                       │
│  ├── OpenAI API (GPT-4o, GPT-5, GPT-5-mini)                │
│  ├── Supabase (PostgreSQL via REST API)                     │
│  └── Upstash Redis (Rate limiting & distributed locks)      │
├─────────────────────────────────────────────────────────────┤
│  In-Memory State (PROBLEM AREA):                            │
│  ├── cache.ts - Map-based cache (volatile on serverless)    │
│  ├── redis.ts - Memory store fallback                       │
│  └── Lock heartbeat timers (don't persist)                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Critical Path Analysis: Token Suggestions Request

A typical `/api/workshop/token-suggestions` request involves:

```
[Request arrives at Vercel Edge]
    │
    ├── 1. Cold Start (if function cold)           ~500-2000ms
    │       - Load Node.js runtime
    │       - Parse/compile JavaScript bundles
    │       - Initialize OpenAI, Supabase clients
    │
    ├── 2. requireUser() - Auth check              ~100-300ms
    │       - cookies() async call
    │       - Supabase getUser() → HTTP to Supabase
    │
    ├── 3. checkRateLimit() - Redis call           ~50-150ms
    │       - Dynamic import of @upstash/redis
    │       - INCR + EXPIRE + TTL commands
    │
    ├── 4. supabaseServer() query                  ~100-300ms
    │       - Fetch thread data from PostgreSQL
    │       - Network round-trip to Supabase region
    │
    ├── 5. cacheGet() - Check local cache          ~0ms (ALWAYS MISS)
    │       - In-memory Map is empty on cold start
    │       - CRITICAL: Cache never persists
    │
    ├── 6. generateTokenSuggestions()              ~1000-5000ms
    │       - OpenAI API call (GPT-4o/GPT-5)
    │       - Prompt construction + JSON parsing
    │
    └── 7. cacheSet() - Store result               ~0ms (USELESS)
            - Sets in-memory Map
            - Lost when function terminates

Total Localhost: ~1000-5000ms (mostly OpenAI)
Total Vercel (Cold): ~2500-8000ms (OpenAI + overhead)
Total Vercel (Warm): ~1500-6000ms (still cache misses)
```

---

## 3. API Route Deep Dive

### 3.1 High-Impact Routes (LLM-Heavy)

| Route | Operations | Est. Latency (Vercel) |
|-------|------------|----------------------|
| `/api/workshop/translate-line` | Auth + DB + OpenAI + Audit | 2-6s |
| `/api/workshop/token-suggestions` | Auth + DB + Redis + OpenAI + Cache | 2-5s |
| `/api/notebook/ai-assist` | Auth + DB + Redis + OpenAI + Cache | 2-5s |
| `/api/workshop/translate-line-with-recipes` | Auth + DB + Multiple OpenAI calls | 3-8s |
| `/api/verification/grade-line` | Auth + DB + OpenAI (GPT-5) | 2-6s |
| `/api/journey/generate-reflection` | Auth + DB + OpenAI | 2-5s |

### 3.2 Observed Pattern in All Routes

Every API route follows this pattern:

```typescript
// 1. Auth check (HTTP to Supabase)
const { user, response } = await requireUser();

// 2. Rate limit check (HTTP to Upstash Redis)
const rateCheck = await checkDailyLimit(...);

// 3. Database query (HTTP to Supabase)
const { data: thread } = await supabase.from("chat_threads").select(...);

// 4. Cache check (IN-MEMORY - always misses on Vercel)
const cached = await cacheGet<T>(cacheKey);

// 5. OpenAI call (HTTP to OpenAI)
const completion = await openai.chat.completions.create(...);

// 6. Cache set (IN-MEMORY - immediately lost)
await cacheSet(cacheKey, result, 3600);
```

**Problem:** Steps 1-3 add 300-700ms of overhead that doesn't exist on localhost because connections are reused.

---

## 4. External Service Dependencies

### 4.1 OpenAI API

**Configuration (from `.env.example`):**
```
TRANSLATOR_MODEL=gpt-4o
VERIFICATION_MODEL=gpt-5
CONTEXT_MODEL=gpt-5-mini
```

**Impact:**
- OpenAI API latency is consistent (~1-4s depending on model)
- This is the same on localhost and Vercel
- However, cold starts add to perceived latency

**Observation:** The application uses GPT-5 models which may have different latency characteristics than GPT-4o.

### 4.2 Supabase (PostgreSQL)

**Configuration:**
```typescript
// src/lib/supabaseServer.ts
return createServerClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { cookies: { ... } }
);
```

**Impact:**
- Every request creates a new Supabase client
- No connection pooling (Supabase handles this server-side, but HTTP overhead remains)
- If Supabase is in a different region than Vercel, add 50-150ms per query

**Unknown:** The Supabase project region is not visible in the code. If it's in a different region than Vercel's default (`iad1` - Washington D.C.), this adds latency.

### 4.3 Upstash Redis

**Configuration:**
```typescript
// src/lib/ratelimit/redis.ts
const { Redis } = await import("@upstash/redis");  // Dynamic import!
const client = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

**Impact:**
- Dynamic import adds ~20-50ms on each cold start
- Each rate limit check = 2-3 Redis commands (INCR, EXPIRE, TTL)
- Upstash uses HTTP-based Redis, so each command is an HTTP request

---

## 5. In-Memory Cache Problem

### 5.1 Current Implementation

```typescript
// src/lib/ai/cache.ts
const mem = new Map<string, { expires: number; value: unknown }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const item = mem.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    mem.delete(key);
    return null;
  }
  return item.value as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSec = 3600): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
```

### 5.2 Why This Fails on Vercel

| Scenario | Localhost | Vercel Serverless |
|----------|-----------|-------------------|
| First request | Cache miss | Cache miss |
| Second request (same function) | **Cache hit** | Cache miss (new instance) |
| Request after 5 min idle | **Cache hit** | Cache miss (cold start) |
| Concurrent requests | **Cache hit** (shared memory) | Cache miss (different instances) |

**Critical Issue:** The cache TTL is 3600 seconds (1 hour), but Vercel functions typically terminate after 10-30 seconds of inactivity. The cache is effectively useless.

### 5.3 Affected Operations

Routes that rely on in-memory caching (ALL will miss on Vercel):

1. `/api/workshop/token-suggestions` - `cacheKey: suggestions:token:...`
2. `/api/notebook/ai-assist` - `cacheKey: ai-assist:...`
3. `/api/workshop/translate-line` (via `translateLineInternal`) - `cacheKey: workshop:translate-line:...`
4. Rate limit memory fallback - `memoryStore` Map
5. Lock helper memory fallback - Used in development

---

## 6. Cold Start Analysis

### 6.1 Bundle Size Contributors

Based on `package.json` dependencies:

| Package | Estimated Size | Cold Start Impact |
|---------|---------------|-------------------|
| `openai` (^4.104.0) | ~500KB | High |
| `@supabase/supabase-js` | ~200KB | Medium |
| `zod` (^3.25.76) | ~50KB | Low |
| `next-intl` (^4.5.5) | ~100KB | Low |
| `framer-motion` (^11.11.17) | ~150KB | Medium (if SSR) |
| `reactflow` (^11.11.4) | ~300KB | Medium (if SSR) |

**Total estimated serverless bundle:** ~1.5-2MB

### 6.2 Cold Start Triggers

Cold starts occur when:

1. **First request** after deployment
2. **Inactivity timeout** (~10-30 seconds with no requests)
3. **Scaling up** (multiple concurrent requests spawn new instances)
4. **Function updates** (redeployment)

### 6.3 Estimated Cold Start Duration

Based on bundle size and complexity:

| Scenario | Estimated Duration |
|----------|-------------------|
| Minimal cold start | 500-800ms |
| Typical cold start | 1000-1500ms |
| Worst case (first deploy) | 2000-3000ms |

---

## 7. Recommendations Summary

### 7.1 Quick Wins (No Code Changes)

| Action | Impact | Effort |
|--------|--------|--------|
| Add `vercel.json` with region near Supabase | Medium | Low |
| Increase Vercel function timeout | Low | Low |
| Enable Vercel Analytics to measure | Low | Low |

### 7.2 Medium-Term Fixes

| Action | Impact | Effort |
|--------|--------|--------|
| Replace in-memory cache with Upstash Redis | **High** | Medium |
| Add connection keep-alive headers | Medium | Low |
| Reduce bundle size (tree-shaking, lazy imports) | Medium | Medium |

### 7.3 Long-Term Optimizations

| Action | Impact | Effort |
|--------|--------|--------|
| Move to Edge Functions for non-DB routes | High | High |
| Implement streaming responses for LLM calls | Medium | Medium |
| Add Vercel KV for distributed caching | High | Medium |

---

## 8. Viewing Logs on Vercel

### 8.1 Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) → Select "translalia-web" project
2. Click **"Logs"** tab in top navigation
3. Filter options:
   - **Level:** Error, Warning, Info
   - **Source:** Build, Functions, Edge
   - **Time range:** Last hour, 24h, 7d, custom

### 8.2 Function-Specific Logs

1. Go to **Deployments** → Click latest deployment
2. Click **"Functions"** tab
3. See all 39 API routes with:
   - Invocation count
   - Average duration
   - Error rate
4. Click any function to see individual invocation logs

### 8.3 Vercel CLI (Terminal Experience)

```bash
# Install CLI
npm i -g vercel

# Link project (one-time)
cd translalia-web
vercel link

# Stream logs in real-time (like tail -f)
vercel logs --follow

# Filter by function
vercel logs --filter function=api/workshop/token-suggestions

# View specific deployment logs
vercel logs https://translalia-xxx.vercel.app
```

### 8.4 What You'll See in Logs

Your existing `console.log` and `console.error` statements will appear:

```
[token-suggestions] Debug request: { threadId: "...", lineIndex: 0, ... }
[translate-line] Translator Personality: { domain: "...", priority: "..." }
[ai-assist] Error: ...
[lockHeartbeat] ❤️ Extended lock:thread:xxx TTL to 600s (beat #1)
```

### 8.5 Adding Custom Logging (Optional)

For better observability, consider adding timing logs:

```typescript
// Example: Add to API routes
const start = Date.now();
// ... operation ...
console.log(`[token-suggestions] Completed in ${Date.now() - start}ms`);
```

---

## Appendix A: Environment Variables Affecting Performance

From `.env.example`:

```bash
# Rate limiting (affects Redis calls)
RATE_LIMIT_ENFORCE=0  # If 0, may skip Redis in some paths
SUGGESTIONS_RATE_LIMIT=200

# Caching behavior
USE_REDIS_LOCK=true  # Forces Redis for locks (good for Vercel)

# Debug flags (disable in production for performance)
DEBUG_PROMPTS=0
DEBUG_VARIANTS=1
DEBUG_GATE=1
DEBUG_PHASE1=1
# ... these console.logs add ~1-5ms each
```

---

## Appendix B: Key Files Analyzed

| File | Purpose | Performance Impact |
|------|---------|-------------------|
| `src/lib/ai/cache.ts` | In-memory caching | **Critical** - ineffective on Vercel |
| `src/lib/ratelimit/redis.ts` | Rate limiting | Medium - Redis overhead |
| `src/lib/supabaseServer.ts` | Database client | Medium - no pooling |
| `src/lib/ai/openai.ts` | OpenAI client | Low - standard setup |
| `src/lib/workshop/translateLineInternal.ts` | Core translation | High - multiple operations |
| `src/app/api/workshop/token-suggestions/route.ts` | Token suggestions | High - complex pipeline |
| `src/app/api/notebook/ai-assist/route.ts` | AI assist | High - complex pipeline |

---

**Report prepared for:** Translalia Development Team  
**Analysis scope:** Performance comparison between localhost and Vercel deployment
