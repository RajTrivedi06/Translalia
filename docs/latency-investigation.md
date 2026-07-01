# Production Latency Investigation — post-DeepSeek

**Status:** Phase A complete (investigate + measure). No fix applied. Awaiting direction.
**Date:** 2026-06-23
**Symptom:** Latency much higher in prod (Vercel) than local; parallel translation feels slow / sequential in prod; "even slower today" than right after deploy. Suspected DeepSeek integration.

---

## TL;DR

- **The DeepSeek change is exonerated as the code cause.** For any non-`deepseek*` model it is a **runtime no-op**: `getClientForModel(model)` returns the *same* OpenAI singleton, and `deepSeekRequestExtras(model)` returns `{}`, so OpenAI request bodies are byte-for-byte unchanged. The commit touched **none** of the tick / dispatch / route / lock code.
- **The dominant cause is a serverless/architecture mismatch that predates DeepSeek by months:** the `translation-status` route does the real translation work in a **bare floating promise after the HTTP response returns** (no `waitUntil`/`after`, no worker, no cron). Locally (long-lived `npm run dev`) that background work keeps running between polls → fast. On Vercel the function **freezes the instant it responds** → the parallel fan-out never completes, and it sits on the tick lock while frozen, so subsequent polls are no-ops → slow / sequential-feeling.
- **Classification: primarily (d) Vercel/serverless limitation, with (b) deployment/env contributing.** Not (a) a DeepSeek code regression. (c) provider latency is a plausible secondary (esp. "even slower today") and is the one thing needing a runtime signal.
- **Two runtime signals are needed to finalize** (I cannot read them from code): (1) prod `TRANSLATOR_MODEL` and the `baseURL` actually serving calls; (2) whether the background tick ever completes in prod. Instrumentation for both is added behind `DEBUG_LATENCY=1`.

---

## 1. DeepSeek diff — blast radius

Commit `bf8e897` ("…and DeepSeek routing", 2026-06-23). LLM-relevant changes only:

| File | Change | Latency-relevant? |
|---|---|---|
| `src/lib/ai/openai.ts` | +`getDeepSeekClient()` (lazy, memoized), `getClientForModel()`, `deepSeekRequestExtras()` | No — see below |
| `src/lib/translation/method2/translateLineWithRecipesInternal.ts` | main-gen calls `openai`→`getClientForModel(model)` + spread `deepSeekRequestExtras(model)` (~:283/:334/:371) | No-op for OpenAI models |
| `src/lib/ai/regen.ts` | wrapper calls `openai`→`getClientForModel(modelToUse)` + extras (:644/:783); `:518` batch path left on singleton (intentional) | No-op for OpenAI models |
| `src/lib/ai/variantRecipes.ts` | recipe calls `openai`→`getClientForModel(modelToUse)` (:845/:853); no-op while `USE_SIMPLIFIED_PROMPTS=1` | No-op for OpenAI models |
| `src/lib/ai/suggestions/*`, `notebookSuggestionsPrompts.ts` | suggestion gate/prompt tweaks (notebook path, not the parallel translate path) | No |

**Not touched by the commit** (verified against `git show --stat bf8e897`): `runTranslationTick.ts`, `processStanza.ts`, `app/api/workshop/translation-status/route.ts`, `lib/ai/cache.ts`, `jobState.ts`, `buildSamplingParams.ts`, `chatCompletionsWithRetry.ts`. **The entire parallel-dispatch / tick / lock surface is untouched.**

Key code facts:
- [openai.ts:3-5](../translalia-web/src/lib/ai/openai.ts#L3-L5) — `export const openai = new OpenAI(...)` is a true module singleton.
- [openai.ts:35-37](../translalia-web/src/lib/ai/openai.ts#L35-L37) — `getClientForModel(model)` returns `getDeepSeekClient()` for `deepseek*`, **else the same `openai` singleton**.
- [openai.ts:18-27](../translalia-web/src/lib/ai/openai.ts#L18-L27) — DeepSeek client is lazy + memoized (`if (!deepseekClient) deepseekClient = new OpenAI(...)`).
- [openai.ts:46-50](../translalia-web/src/lib/ai/openai.ts#L46-L50) — `deepSeekRequestExtras(model)` returns `{ thinking: { type: "disabled" } }` only for `deepseek*`, else `{}`.
- [models.ts:2](../translalia-web/src/lib/models.ts#L2) — `TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o"`. Code never defaults to a deepseek model; the only `deepseek` strings in `src/` are inside `openai.ts` itself.
- [.env.local:34](../translalia-web/.env.local#L34) — local `TRANSLATOR_MODEL=gpt-4o`. So **locally the DeepSeek path is never exercised** — yet local is fast. That alone shows the slowness isn't the DeepSeek code.

---

## 2. The parallel flow, end-to-end

1. Client polls `GET /api/workshop/translation-status?threadId=…&advance=true` every **1.5s** (first 5 polls) then **4s** (`useTranslationJob.ts` `FAST_POLL_MS=1500`/`SLOW_POLL_MS=4000`), stopping when `job.status` is `completed`/`failed`.
2. The route ([translation-status/route.ts:99-152](../translalia-web/src/app/api/workshop/translation-status/route.ts#L99-L152)) starts `runTranslationTick(threadId, { maxProcessingTimeMs: 60000, … })` and **races it against a 500ms HTTP timeout**, then returns.
3. `runTranslationTick` ([runTranslationTick.ts:462](../translalia-web/src/lib/workshop/runTranslationTick.ts#L462)) acquires a per-thread Redis lock `tick:${threadId}` (TTL 600s, [:472-476](../translalia-web/src/lib/workshop/runTranslationTick.ts#L472-L476)), starts a heartbeat ([:499-503](../translalia-web/src/lib/workshop/runTranslationTick.ts#L499-L503)), reconciles state, and dispatches chunks.
4. Chunk-level fan-out: `ConcurrencyLimiter(chunkConcurrency)` + `Promise.allSettled` (default `CHUNK_CONCURRENCY`=3 in code; 4 in `.env.local`).
5. Line-level fan-out per chunk: `processStanza` ([processStanza.ts:198-235](../translalia-web/src/lib/workshop/processStanza.ts#L198-L235)) — `ConcurrencyLimiter(lineConcurrency)` (default 6) + `Promise.allSettled`.
6. Per line: recipe-gen (`variantRecipes.ts`, no-op while `USE_SIMPLIFIED_PROMPTS=1`) → main-gen (`translateLineWithRecipesInternal.ts`) → optional regen (`regen.ts`), each via `chatCompletionsWithRetry`.
7. On a 600s lock + 60s tick budget, a tick is *meant* to translate many lines in parallel in the background while the client polls a read-only status. **That background execution is exactly what serverless kills.**

---

## 3. Hypothesis verdicts (evidence)

### H1 — Client reuse / keep-alive regression → **REFUTED**
`getClientForModel` returns the existing `openai` singleton for non-deepseek ([openai.ts:36](../translalia-web/src/lib/ai/openai.ts#L36)); the resolver runs per request but only returns a reference — no `new OpenAI()` per call. DeepSeek client is lazy + memoized ([:18-27](../translalia-web/src/lib/ai/openai.ts#L18-L27)). No connection-pool/keep-alive regression.

### H2 — Env-var concurrency collapse → **REFUTED as a code bug** (one config check remains)
This codebase's defaults are **safe**, unlike the prior "defaults to 1" pattern:
- Line concurrency: `Math.min(Math.max(1, raw ? parseInt(raw,10) : 6), 8)` → **default 6** ([processStanza.ts:200-203](../translalia-web/src/lib/workshop/processStanza.ts#L200-L203)).
- Chunk concurrency default **3**; max-stanzas default **4** ([runTranslationTick.ts:575-580](../translalia-web/src/lib/workshop/runTranslationTick.ts#L575-L580)), capped 5.
- Parallel toggles use `!== "0"` → **enabled when unset** (`ENABLE_PARALLEL_STANZAS`, `MAIN_GEN_PARALLEL_LINES`, `ENABLE_TICK_TIME_SLICING`).
- Numeric parsing is robust (`parseInt`/`Number` with `||`/`Math.max` fallbacks; tolerates the trailing spaces in `.env.local`).

So a **missing** var in prod still yields parallelism (just 3 chunks vs 4). **Residual risk (config, not code):** a kill-switch explicitly set to `"0"` (or a numeric set to a bad value) in Vercel. → *Action: list the prod values; see §6.* Not the cause of the local↔prod gap.

### H3 — Parallel dispatch integrity → **REFUTED** (dispatch is genuinely parallel)
Both levels use real `Promise.allSettled` fan-out (chunk: `runTranslationTick.ts` ~:1002; line: [processStanza.ts:235](../translalia-web/src/lib/workshop/processStanza.ts#L235)). Focused-mode `K=1` only reduces regen **candidate count** ([regen.ts:401-412](../translalia-web/src/lib/ai/regen.ts#L401-L412)); it does **not** serialize chunk/line dispatch. Zombie-chunk reconciliation + watchdog run every tick ([runTranslationTick.ts:556-563](../translalia-web/src/lib/workshop/runTranslationTick.ts#L556-L563)). **The parallelism is correct in code — the problem is it never runs to completion in prod (H6).**

### H4 — DeepSeek thinking-leak / wrong-model routing → **CAN'T-TELL-WITHOUT-RUNTIME** (code is correct)
`deepSeekRequestExtras` is spread at every deepseek-routed main-gen/regen site; OpenAI bodies are unchanged. Code never selects a deepseek model on its own. **Risk only if Vercel sets `TRANSLATOR_MODEL=deepseek-*`:** then every call hits `api.deepseek.com` (separate provider/region; historically slower, esp. reasoning) — a real latency multiplier and a candidate for "even slower today" if DeepSeek is degraded/throttling. The `:518` n>1 batch path stays on the OpenAI singleton, so a deepseek model there would be **mis-routed to OpenAI** (correctness, not latency). → *Action: confirm prod `TRANSLATOR_MODEL` + observed `baseURL`; see §6.*

### H5 — Retry/timeout amplification → **REFUTED**
The unsupported-param retry only runs inside the error `catch` ([chatCompletionsWithRetry.ts:378-380](../translalia-web/src/lib/ai/chatCompletionsWithRetry.ts#L378-L380)) — not per request. The stop-sequence retry only arms when stop sequences are built (gated; `ENABLE_STOP_SEQUENCES=0` locally) and a parse fails. DeepSeek added no retry/timeout changes.

### H6 — Serverless / Vercel runtime → **CONFIRMED (dominant cause)**
- **Floating promise after response, no background primitive.** [translation-status/route.ts:135-152](../translalia-web/src/app/api/workshop/translation-status/route.ts#L135-L152): when the 500ms timeout wins (always, for real LLM work), the response is sent and `tickPromise` is left running with only a `.catch`. The code itself says: *"In serverless, this may be cut off, but that's okay"* (line 136). Repo-wide grep for `waitUntil`/`after(` → **none**.
- **No worker, no cron.** No `vercel.json` anywhere; `ENABLE_STATUS_READ_ADVANCE_SPLIT` (the "worker is the primary advancement owner" mode, [route.ts:45-47](../translalia-web/src/app/api/workshop/translation-status/route.ts#L45-L47)) has **no consumer** — no worker route, no scheduled job. The intended production mode was never deployed; prod relies entirely on the floating-promise path.
- **No `maxDuration`/`runtime` on the status route** → it inherits the platform default (short), shrinking the window further.
- **Lock held while frozen.** The frozen instance never releases `tick:${threadId}` (release is at tick end) and its heartbeat is frozen too, so for up to the 600s TTL subsequent polls hit "lock held" → no-op ([route.ts:121-127](../translalia-web/src/app/api/workshop/translation-status/route.ts#L121-L127)).

**Why local ≠ prod:** local `npm run dev` is a long-lived process — the floating tick keeps fanning out lines (concurrency 6) for the full 60s between polls, so a poem finishes in a few background ticks. Vercel freezes the instance on response, so the fan-out barely starts before suspension; progress trickles only when a later poll happens to thaw the same instance. Same code, opposite behavior. This is the local↔prod asymmetry and the "feels sequential" symptom.

**Git timeline (rules out DeepSeek as the source):** the floating-promise/race code was last authored in `261fddb` (2026-03-15); `runTranslationTick.ts` in `21cd2cb` (2026-02-01). DeepSeek is `bf8e897` (today). This was likely the **first real production exposure** of a pre-existing serverless-incompatible pattern.

### H7 — Provider-side latency → **CAN'T-TELL-WITHOUT-RUNTIME** (best explanation for "even slower today")
The code is unchanged since deploy, so a *same-day* worsening points to provider drift / rate-limit throttling (OpenAI or, if routed, DeepSeek), or accumulating serverless lock/cold-start debris under more traffic — not code. The `DEBUG_LATENCY` raw-API timing + `baseURL` log (added) plus rate-limit response headers will separate provider time from orchestration.

| # | Hypothesis | Verdict |
|---|---|---|
| H1 | Client reuse / keep-alive | **Refuted** |
| H2 | Env concurrency collapse | **Refuted** (defaults safe; one prod-config check) |
| H3 | Parallel dispatch integrity | **Refuted** (parallel is correct) |
| H4 | DeepSeek thinking-leak / routing | Can't-tell-without-runtime (code correct) |
| H5 | Retry/timeout amplification | **Refuted** |
| H6 | Serverless floating promise | **Confirmed — dominant** |
| H7 | Provider latency ("even slower today") | Can't-tell-without-runtime |

---

## 4. Instrumentation added (flag-gated `DEBUG_LATENCY=1`, default off, strippable)

All three are no-ops unless `DEBUG_LATENCY=1`; none change request/response behavior. No secrets or prompt bodies logged.

1. **Raw provider round-trip + client attribution** — [chatCompletionsWithRetry.ts](../translalia-web/src/lib/ai/chatCompletionsWithRetry.ts) (around the primary `create()`). Logs:
   `[DEBUG_LATENCY] raw_api kind=mainGen model=gpt-4o baseURL=https://api.openai.com/v1 ms=842 tokens=512/1300`
   → isolates provider time and reveals **which client (OpenAI vs DeepSeek) actually served the call** (answers H4/H7 directly).
2. **Cold-start probe** — [translation-status/route.ts](../translalia-web/src/app/api/workshop/translation-status/route.ts) handler start:
   `[DEBUG_LATENCY] req_… coldStart=true`
3. **Background-tick completion probe** — [translation-status/route.ts](../translalia-web/src/app/api/workshop/translation-status/route.ts) on the floating promise:
   `[DEBUG_LATENCY] req_… bg_tick_resolved ms=18230 completed=2 hasWorkRemaining=true`
   → **This is the decisive prod test.** Each "tick scheduled (timeout…)" should be followed by a `bg_tick_resolved`. **In prod those resolutions will be largely MISSING** if the instance freezes; locally they should appear.

Existing signals to read alongside these (no change needed): `📊 TICK SUMMARY: duration=…ms … completed=… skipped=… interrupted=…` ([runTranslationTick.ts:1354](../translalia-web/src/lib/workshop/runTranslationTick.ts#L1354)); `tick scheduled / tick skipped (lock held)` ([route.ts:121-133](../translalia-web/src/app/api/workshop/translation-status/route.ts#L121-L133)); per-call durations in the `instrumentation.openaiDurations` arrays; `method2_audit` rows when `PERSIST_METHOD2_AUDIT=1`.

---

## 5. Local-vs-prod timing — what to capture and the expected signature

> I cannot read prod (Vercel env, logs, regions) or live timings from code. The instrumentation above is the apples-to-apples harness; the table is the predicted signature my diagnosis stands or falls on. Please capture both sides (or tell me to drive a local run).

**Capture:**
- Local: `DEBUG_LATENCY=1 npm run dev`, translate a multi-stanza poem, grep server logs for `DEBUG_LATENCY` + `TICK SUMMARY`.
- Prod: set `DEBUG_LATENCY=1` in Vercel (Preview/Prod), redeploy, run the same poem, read Vercel function logs for the same lines.

| Signal | Local (expected) | Prod (expected if H6) |
|---|---|---|
| `bg_tick_resolved` after `tick scheduled` | present, ms ≈ tick work | **mostly absent** (frozen) |
| `TICK SUMMARY … completed=N` frequency | frequent, N grows | rare / tiny N |
| `tick skipped (lock held)` | rare | **frequent** (frozen lock) |
| `coldStart=true` frequency | once | repeated |
| `raw_api … baseURL=` | `api.openai.com` | reveals if `api.deepseek.com` |
| `raw_api ms` | provider baseline | high → also provider drift (H7) |

The split between "low `raw_api ms` but no `bg_tick_resolved`" (→ orchestration/serverless, H6) and "high `raw_api ms`" (→ provider, H4/H7) is exactly what tells us where the time goes.

---

## 6. Proposed smallest safe fix + decision needed

**Do not implement yet.** The right fix depends on two runtime signals; please grab them first (5 min):

1. **Prod `TRANSLATOR_MODEL`** (Vercel → Project → Settings → Environment Variables) and the observed `baseURL` from the `DEBUG_LATENCY raw_api` log.
2. **Whether `bg_tick_resolved` appears in prod logs** for a real translation.

Then the fork:

- **If freeze confirmed + prod on OpenAI (most likely): Option A — smallest code fix.** Stop relying on a bare floating promise: register the background tick with Next.js `after()` (or Vercel `waitUntil`) and add `export const maxDuration = 60` to the status route so the tick can finish within the invocation. ~5-10 lines in `translation-status/route.ts`, OpenAI behavior byte-for-byte unchanged, existing lock already prevents overlap. **Recommended.**
- **Option B — "correct" but bigger (infra/env, not a small fix):** deploy the intended worker + a Vercel Cron and set `ENABLE_STATUS_READ_ADVANCE_SPLIT=1`, making polling read-only and the worker the advancer. This is net-new infrastructure (no worker route/cron exists today), so it's outside "smallest safe fix" — flagging as the durable option.
- **If prod is routed to DeepSeek (H4): Option C — pure env fix.** Set `TRANSLATOR_MODEL=gpt-4o` in Vercel (no code change) and separately decide whether DeepSeek is intended; if it is, the `:518` batch path needs the resolver too.
- **Env hygiene (independent):** confirm none of the parallel kill-switches are `"0"` in Vercel, and (optional) set the concurrency vars to match local throughput. Defaults are safe but lower than `.env.local`.

**Decision I need from you:** confirm the fix direction (A recommended vs B vs C), after — or together with — the prod `TRANSLATOR_MODEL` value. I'll implement only the smallest change for the confirmed direction and leave the `DEBUG_LATENCY` instrumentation in place to verify.
</content>
</invoke>
