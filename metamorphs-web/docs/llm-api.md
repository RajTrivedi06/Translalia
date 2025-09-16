Purpose: How we call LLMs (methods, params) and where each surface uses them.
Updated: 2025-09-16

### [Last Updated: 2025-09-13]

# LLM API (2025-09-16)

We use OpenAI `responses.create` across server surfaces. We do not use legacy `chat.completions.create`.

Evidence of responses.create usage (examples):

```196:199:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const respUnknown: unknown = await openai.responses.create(
  reqPayload as unknown as Parameters<typeof openai.responses.create>[0]
);
```

```43:49:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
const r1 = await openai.responses.create({
  ...base,
  messages: [
    { role: "system", content: ENHANCER_SYSTEM },
    { role: "user", content: user },
  ] as const,
});
```

## Call Patterns (by surface)

- Translator: `model = TRANSLATOR_MODEL`, `temperature ≈ 0.6`.

```98:104:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
```

- Enhancer (planner): `model = ENHANCER_MODEL`, `temperature ≈ 0.2`, `response_format: json_object`, with one JSON-fix retry (`temperature 0.1`).

```38:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
const base = {
  model: ENHANCER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" } as const,
};

const r1 = await openai.responses.create({
  ...base,
```

```58:66:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
const r2 = await openai.responses.create({
  ...base,
  temperature: 0.1,
  messages: [
    {
      role: "system",
      content: ENHANCER_SYSTEM +
```

- Router / Clarifier: `model = ROUTER_MODEL`, `temperature ≈ 0.2`, `response_format: json_object`.

```26:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/flow/intentLLM.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

```23:27:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/interview/next/route.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

- Verifier / Back-translate: JSON outputs using `VERIFIER_MODEL` (default Router) and `BACKTRANSLATE_MODEL` (default Enhancer).

```41:47:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: VERIFIER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
  messages: [
```

```83:90:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: BACKTRANSLATE_MODEL,
  temperature: 0.3,
  response_format: { type: "json_object" },
  messages: [
```

## Prompt Hashing & Redacted Debug Previews

- Each call computes a `prompt_hash` over `{route, model, system, user[, schema]}`.

```11:20:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
export function buildPromptHash(args: {
  route: string;
  model: string;
  system: string;
  user: string;
  schema?: string;
}) {
  const { route, model, system, user, schema } = args;
  return stableHash({ route, model, system, user, schema });
}
```

- Redacted previews are logged only when gated by env flags.

```30:43:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
const DEBUG =
  process.env.DEBUG_PROMPTS === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
if (!DEBUG) return;
// Avoid printing full poem/user content in logs
console.info("[LLM]", {
  route: args.route,
  model: args.model,
  hash: args.hash,
  systemPreview: squeeze(args.system),
  userPreview: squeeze(args.user, 300),
});
```

## Parameters and Guards

- We set `instructions` and `input` for string user payloads; for message arrays we wrap with a system message.

```51:56:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
if (typeof user === "string") {
  args.instructions = system;
  args.input = user;
} else {
  args.input = [{ role: "system", content: system }, ...user];
}
```

- For non‑generative models (moderation, embeddings, audio, realtime), we drop `temperature`, `top_p`, and `response_format` if unsupported.

```47:51:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
const nonGen = isNonGenerative(model);
if (!nonGen && typeof temperature === "number")
  args.temperature = temperature;
if (!nonGen && typeof top_p === "number") args.top_p = top_p;
```

```57:58:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
if (!nonGen && response_format) args.response_format = response_format;
```

- Fallback: when API rejects `temperature`, we retry without `temperature`, `top_p`, and `response_format`.

```68:76:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
const unsupportedTemp = /Unsupported parameter:\s*'temperature'/i.test(msg);
if (unsupportedTemp) {
  const retryArgs: Record<string, unknown> = { ...args };
  delete (retryArgs as Record<string, unknown> & { temperature?: unknown })
    .temperature;
  delete (retryArgs as Record<string, unknown> & { top_p?: unknown }).top_p;
  delete (
    retryArgs as Record<string, unknown> & { response_format?: unknown }
  ).response_format;
```

### Policy vs Implementation

- Policy: all JSON surfaces should set `response_format: { type: "json_object" }`.
- Implementation: translator surfaces parse free‑form text and do not set `response_format`.

```93:104:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/translate.ts
const base = {
  model: TRANSLATOR_MODEL,
  temperature,
  ...(top_p ? { top_p } : {}),
  messages: [
    { role: "system", content: system },
    { role: "user", content: user },
  ] as const,
};
```

## Echo Policy (Translator)

- Preview: server-side anti-echo guard returns 409 when the model echoes the source and `forceTranslate` is not set.

```220:231:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (!forceTranslate && looksLikeEcho(sourceLines, outLines)) {
  return NextResponse.json(
    {
      ok: false,
      code: "PREVIEW_ECHOED_SOURCE",
      error: "Model echoed source text.",
    },
    { status: 409 }
  );
}
```

## Unsupported Parameters

- We do not use `min_p` (no in-code references).

```

```

### Translator Prompt Inputs

| Block                         | Included?         | Notes                                                                 |
| ----------------------------- | ----------------- | --------------------------------------------------------------------- |
| JOURNEY (most recent → older) | Preview, Instruct | Appended from `bundle.journeySummaries`                               |
| CITED_VERSION_FULL_TEXT       | Instruct only     | Included when `citeVersionId` provided, else implicit parent fallback |
| ACCEPTED_DRAFT_LINES          | Preview           | Pulled from RPC `get_accepted_version`                                |
| DECISIONS (last)              | Preview           | Last 3–5 ledger notes                                                 |
| SUMMARY                       | Preview           | From thread state summary                                             |
| GLOSSARY                      | Preview           | From thread state glossary terms                                      |

```212:234:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const userPrompt =
  [
    `SOURCE_POEM (line_policy=${bundle.line_policy}):\n${bundle.poem}`,
    `ENHANCED_REQUEST (JSON):\n${JSON.stringify(bundle.enhanced)}`,
    bundle.glossary?.length
      ? `GLOSSARY:\n${JSON.stringify(bundle.glossary)}`
      : "",
    bundle.acceptedLines.length
      ? `ACCEPTED_DRAFT_LINES:\n${bundle.acceptedLines.join("\n")}`
      : "",
    bundle.ledgerNotes.length
      ? "DECISIONS (last):\n" + bundle.ledgerNotes
          .map((n) => `- ${n}`)
          .join("\n")
      : "",
    `TARGET_LANGUAGE:\n${targetNorm}`,
    bundle.summary ? `SUMMARY:\n${bundle.summary}` : "",
    bundle.journeySummaries?.length
      ? "JOURNEY (most recent → older):\n" +
        bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n") + force;
```

```185:206:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
const bundleUser = [
  `INSTRUCTION:\n${instruction}`,
  `SOURCE_POEM:\n${poem}`,
  Object.keys(enhanced).length
    ? `ENHANCED_REQUEST(JSON):\n${JSON.stringify(enhanced)}`
    : "",
  glossary.length ? `GLOSSARY:\n${JSON.stringify(glossary)}` : "",
  `TARGET_LANGUAGE:\n${targetNormForPrompt}`,
  summary ? `SUMMARY:\n${summary}` : "",
  bundle.journeySummaries?.length
    ? "JOURNEY (most recent → older):\n" +
      bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
    : "",
  citedText ? `CITED_VERSION_FULL_TEXT:\n${citedText}` : "",
  citedText
    ? "Evolve from the cited PRIOR_VERSION only. Make minimal, intentional changes aligned with JOURNEY; do not restart from the source."
    : "",
  // Strengthen instruction against echo
  "CRITICAL: Output MUST be a translation. Do NOT return the source text.",
]
  .filter(Boolean)
  .join("\n\n");
```

### Guards (Preview & Instruct)

- Echo/Untranslated gate: both routes perform anti‑echo and language gates; one retry with a hard requirement; selected error codes below.

```294:318:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (!forceTranslate && (echoish || untranslated)) {
  const hardReq = `\n\nHARD REQUIREMENT: Output must be fully in the target language (English if requested).\nDo NOT echo or quote SOURCE_POEM lines or reproduce Urdu/Arabic script.\nPreserve the ghazal mechanics (radif/qaafiya) by transliterating refrains (e.g., "hai — hai?") if needed.`;

  const retryUser = userPrompt + hardReq;
  const respRetryUnknown: unknown = await responsesCall({
    model,
    system: getTranslatorSystem(effectiveMode),
    user: retryUser,
    temperature: 0.6,
  } as ResponsesCallOptions);
```

```270:279:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
if (echoish1 || untranslated1 || hangulUntranslated1) {
  const hardReq = `\n\nHARD REQUIREMENT: Output must be fully in the target language; do NOT echo or quote SOURCE_POEM lines or reproduce non-target script.`;
  const retryUser = bundleUser + hardReq;

  const respRetryUnknown: unknown = await responsesCall({
    model: TRANSLATOR_MODEL,
    system: getTranslatorSystem(effectiveMode),
    user: retryUser,
    temperature: 0.6,
  });
```

- Error codes: Preview `409 PREVIEW_ECHOED_SOURCE`; Instruct `409 INSTRUCT_ECHO_OR_UNTRANSLATED`, `502 INSTRUCT_RETRY_EMPTY`, `502 INSTRUCT_PARSE_RETRY_FAILED`.

```355:361:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
return NextResponse.json(
  {
    ok: false,
    code: "PREVIEW_ECHOED_SOURCE",
    error: "Model echoed/left source language after retry.",
    retryable: true,
  },
  { status: 409 }
);
```

```283:297:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
if (!raw2) {
  await supabase
    .from("versions")
    .update({
      meta: {
        ...placeholderMeta,
        status: "failed",
        error: "INSTRUCT_RETRY_EMPTY",
      },
    })
    .eq("id", newVersionId);
  return NextResponse.json(
    { ok: false, code: "INSTRUCT_RETRY_EMPTY", retryable: true },
    { status: 502 }
  );
}
```

```304:317:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
} catch {
  await supabase
    .from("versions")
    .update({
      meta: {
        ...placeholderMeta,
        status: "failed",
        error: "INSTRUCT_PARSE_RETRY_FAILED",
      },
    })
    .eq("id", newVersionId);
  return NextResponse.json(
    { ok: false, code: "INSTRUCT_PARSE_RETRY_FAILED", retryable: true },
    { status: 502 }
  );
}
```

- Must-keep enforcement (Instruct): single retry; 409 on missing required tokens.

```367:379:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
const respKeepUnknown: unknown = await responsesCall({
  model: TRANSLATOR_MODEL,
  system: getTranslatorSystem(effectiveMode),
  user: bundleUser + keepReq,
  temperature: 0.6,
});
```

```389:409:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
if (missing2.length) {
  await supabase
    .from("versions")
    .update({
      meta: {
        ...placeholderMeta,
        status: "failed",
        error: "REQUIRED_TOKENS_MISSING",
      },
    })
    .eq("id", newVersionId);
  return NextResponse.json(
    {
      ok: false,
      code: "REQUIRED_TOKENS_MISSING",
      retryable: true,
      missing: missing2,
    },
    { status: 409 }
  );
}
```

### Responses API usage (call sites)

- Translator (translate): `src/app/api/translate/route.ts:L112-L118`
- Preview: `src/app/api/translator/preview/route.ts:L268-L273`
- Instruct: `src/app/api/translator/instruct/route.ts:L222-L227`
- Router/classifier: `src/server/flow/intentLLM.ts:L26-L33`; `src/lib/ai/routeIntent.ts:L29-L37`; `src/app/api/interview/next/route.ts:L23-L31`

Prompt hashing in Preview/Instruct:

```228:236:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const prompt_hash = buildPromptHash({
  route: "translator",
  model: TRANSLATOR_MODEL,
  system: getTranslatorSystem(effectiveMode),
  user: userPrompt,
});
```

```164:170:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
const prompt_hash = buildPromptHash({
  route: "translator",
  model: TRANSLATOR_MODEL,
  system: getTranslatorSystem(effectiveMode),
  user: bundleUser,
});
```

### Prompt content (Preview)

Blocks included:

- SOURCE_POEM, ENHANCED_REQUEST, GLOSSARY, ACCEPTED_DRAFT_LINES, DECISIONS (last), TARGET_LANGUAGE, SUMMARY, JOURNEY (most recent → older)

```206:224:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const userPrompt =
  [
    `SOURCE_POEM (line_policy=${bundle.line_policy}):\n${bundle.poem}`,
    `ENHANCED_REQUEST (JSON):\n${JSON.stringify(bundle.enhanced)}`,
    bundle.glossary?.length
      ? `GLOSSARY:\n${JSON.stringify(bundle.glossary)}`
      : "",
    bundle.acceptedLines.length
      ? `ACCEPTED_DRAFT_LINES:\n${bundle.acceptedLines.join("\n")}`
      : "",
    bundle.ledgerNotes.length
      ? "DECISIONS (last):\n" + bundle.ledgerNotes
          .map((n) => `- ${n}`)
          .join("\n")
      : "",
    `TARGET_LANGUAGE:\n${targetNorm}`,
    bundle.summary ? `SUMMARY:\n${bundle.summary}` : "",
    bundle.journeySummaries?.length
      ? "JOURNEY (most recent → older):\n" +
        bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n") + force;
```

### Prompt content (Instruct)

Blocks included:

- INSTRUCTION, SOURCE_POEM, ENHANCED_REQUEST, GLOSSARY, TARGET_LANGUAGE, SUMMARY, JOURNEY (most recent → older), optional CITED_VERSION_FULL_TEXT, echo guard line

```148:161:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
const bundleUser = [
  `INSTRUCTION:\n${instruction}`,
  `SOURCE_POEM:\n${poem}`,
  Object.keys(enhanced).length
    ? `ENHANCED_REQUEST(JSON):\n${JSON.stringify(enhanced)}`
    : "",
  glossary.length ? `GLOSSARY:\n${JSON.stringify(glossary)}` : "",
  `TARGET_LANGUAGE:\n${targetNormForPrompt}`,
  summary ? `SUMMARY:\n${summary}` : "",
  bundle.journeySummaries?.length
    ? "JOURNEY (most recent → older):\n" +
      bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
    : "",
]
  .filter(Boolean)
  .join("\n\n");
```

```198:205:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
citedText ? `CITED_VERSION_FULL_TEXT:\n${citedText}` : "",
// Strengthen instruction against echo
"CRITICAL: Output MUST be a translation. Do NOT return the source text.",
```
