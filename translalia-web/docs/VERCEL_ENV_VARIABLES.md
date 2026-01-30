# Vercel Environment Variables Reference

Configure these in **Vercel Dashboard → Project → Settings → Environment Variables**.

---

## Required (App will fail without these)

| Variable                        | Description                     | Example                                   |
| ------------------------------- | ------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL            | `https://xxxxx.supabase.co`               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `OPENAI_API_KEY`                | OpenAI API key for LLM calls    | `sk-...`                                  |

---

## Required for Production (Locks & Caching)

Without these, the app falls back to in-memory caching/locking, which **does not work** across Vercel serverless instances.

| Variable                   | Description                                 | Example                    |
| -------------------------- | ------------------------------------------- | -------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis REST API URL                  | `https://xxxxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token                | `AXxxxx...`                |
| `USE_REDIS_LOCK`           | Force Redis for locks (recommended: `true`) | `true`                     |

---

## Optional – Supabase

| Variable                    | Description                                  | Default |
| --------------------------- | -------------------------------------------- | ------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin operations) | `""`    |

---

## Optional – App URL & Features

| Variable                                    | Description                   | Default                 |
| ------------------------------------------- | ----------------------------- | ----------------------- |
| `NEXT_PUBLIC_APP_URL`                       | Base URL for redirects/links  | `http://localhost:3000` |
| `NEXT_PUBLIC_ENABLE_PASSWORD_AUTH`          | Enable password auth          | `false`                 |
| `NEXT_PUBLIC_FEATURE_VERIFICATION_INTERNAL` | Internal verification feature | `true`                  |
| `NEXT_PUBLIC_FEATURE_VERIFICATION_CONTEXT`  | Context notes feature         | `true`                  |
| `NEXT_PUBLIC_UI_LANG_DEFAULT`               | Default UI language           | `en`                    |

---

## Optional – Models

| Variable             | Description                | Default                  |
| -------------------- | -------------------------- | ------------------------ |
| `TRANSLATOR_MODEL`   | Main translation model     | `gpt-4o`                 |
| `VERIFICATION_MODEL` | Verification grading model | `gpt-5`                  |
| `CONTEXT_MODEL`      | Context notes model        | `gpt-5-mini`             |
| `EMBEDDINGS_MODEL`   | Embeddings model           | -                        |
| `MODERATION_MODEL`   | Moderation model           | `omni-moderation-latest` |

---

## Optional – Rate Limits

| Variable                  | Description                           | Default |
| ------------------------- | ------------------------------------- | ------- |
| `SUGGESTIONS_RATE_LIMIT`  | Daily limit for word/line suggestions | `200`   |
| `VERIFICATION_RATE_LIMIT` | Verification grading limit            | `50`    |
| `CONTEXT_RATE_LIMIT`      | Context notes limit                   | `200`   |

---

## Optional – Translation Pipeline

| Variable                        | Description                          | Default |
| ------------------------------- | ------------------------------------ | ------- |
| `ENABLE_PARALLEL_STANZAS`       | Process multiple stanzas in parallel | `1`     |
| `MAX_STANZAS_PER_TICK`          | Max stanzas per tick                 | `1`–`5` |
| `CHUNK_CONCURRENCY`             | Concurrent stanza limit              | `1`–`3` |
| `MAIN_GEN_PARALLEL_LINES`       | Parallel line translation            | `1`     |
| `MAIN_GEN_LINE_CONCURRENCY`     | Lines per stanza in parallel         | `3`     |
| `ENABLE_TICK_TIME_SLICING`      | Time-budgeted ticks                  | `1`     |
| `TICK_TIME_BUDGET_MS`           | Time budget per tick (ms)            | `2500`  |
| `TRANSLATION_STATUS_TIMEOUT_MS` | Poll timeout (ms)                    | `200`   |

---

## Optional – Diagnostics (for debugging)

| Variable             | Description                    | Default                         |
| -------------------- | ------------------------------ | ------------------------------- |
| `ENABLE_DIAGNOSTICS` | Enable performance diagnostics | `true` (set `false` to disable) |
| `DEBUG_SUGGESTIONS`  | Verbose suggestion logs        | `0`                             |
| `DEBUG_LOCK`         | Lock acquisition/release logs  | `0`                             |
| `DEBUG_VARIANTS`     | Variant/recipe debug logs      | `0`                             |

---

## Optional – Advanced / Tuning

| Variable                           | Description                   | Default            |
| ---------------------------------- | ----------------------------- | ------------------ |
| `MAIN_GEN_MAX_OUTPUT_TOKENS`       | Max tokens per line           | `4000`             |
| `REGEN_MAX_OUTPUT_TOKENS`          | Max tokens for regen          | `1500`             |
| `MAX_REGEN_TIME_MS`                | Max regen time (ms)           | `75000`            |
| `MAX_REGEN_ROUNDS`                 | Max regen rounds              | `1`                |
| `ENABLE_STRICT_JSON_SCHEMA`        | Strict JSON for models        | `1`                |
| `STRICT_JSON_SCHEMA_MODELS`        | Models for strict schema      | `gpt-5,gpt-5-mini` |
| `ENABLE_COMPRESSED_RECIPES`        | Compress recipe prompts       | `1`                |
| `ENABLE_LOCAL_ANCHOR_REALIZATIONS` | Local anchor computation      | `1`                |
| `OMIT_SUBJECT_FORM_FROM_PROMPT`    | Omit subject form from prompt | `1`                |
| `ENABLE_STOP_SEQUENCES`            | Use stop sequences            | `0`                |
| `ENABLE_GPT5_SAMPLING_TUNING`      | GPT-5 sampling tuning         | `0`                |

---

## Quick Copy for Vercel

**Minimum required set:**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
USE_REDIS_LOCK=true
```

**Where to get values:**

- **Supabase:** Project Settings → API
- **OpenAI:** https://platform.openai.com/api-keys
- **Upstash:** https://console.upstash.com/ → Create Redis database
