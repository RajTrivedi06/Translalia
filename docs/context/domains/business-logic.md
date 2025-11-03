### [Last Updated: 2025-09-16]

## Business Logic

> Status: Phase 2 introduces no changes to auth/user/business logic. UI-only features and flags.

### Overview

- Pipeline: Interview → Plan → Preview → Accept → Canvas

### Translator Output (NOTES rubric)

- We expect a poem and a NOTES section (up to 10 items).

```10:18:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/parse.ts
export function parseTranslatorOutput(raw: string): TranslatorParsed {
  const afterA = text.split(/---VERSION A---/i)[1] ?? "";
  const [poemRaw, notesRaw] = afterA.split(/---NOTES---/i);
}
```

### Anti-echo policy

- Preview returns 409 when output echoes the source beyond thresholds; one retry may be issued server-side with stricter wording.

```289:296:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const echoish = looksLikeEcho(sourceLines, outLines);
const untranslated = looksUntranslatedToEnglish(targetVariety, outLines);
if (!forceTranslate && (echoish || untranslated)) {
  // retry path then PREVIEW_ECHOED_SOURCE 409 on failure
}
```

### Prismatic mode

- Prismatic (A/B/C) is enabled only when the flag is on; sections parsed from a single call.

```1:3:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/flags/prismatic.ts
export function isPrismaticEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_PRISMATIC === "1";
}
```

```281:285:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const sections =
  isPrismaticEnabled() && effectiveMode === "prismatic"
    ? parsePrismatic(raw)
    : undefined;
```

### Accept-lines

- Moderation guards selected lines; writes via RPC `accept_line` and appends ledger entries.

```48:60:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
const mod = await moderateText(combined);
if (mod.flagged) return NextResponse.json({ ok: false, flagged: true }, { status: 400 });
```

```63:71:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
for (const s of selections) {
  await supabase.rpc("accept_line", { p_thread_id: threadId, p_line_index: s.index + 1, p_new_text: s.text, p_actor: userId });
}
```

```72:76:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
await appendLedger(threadId, { ts: new Date().toISOString(), kind: "accept", note: `Accepted ${selections.length} line(s)` });
```

### Translator Rubric

- Anti-echo policy

  - Server detects echo/untranslated; retries once with stronger directive; returns 409 on failure.

  ```294:306:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
  if (!forceTranslate && (echoish || untranslated)) {
    const hardReq = `\n\nHARD REQUIREMENT: Output must be fully in the target language (English if requested).\nDo NOT echo or quote SOURCE_POEM lines or reproduce Urdu/Arabic script.`;
    const respRetryUnknown: unknown = await responsesCall({ /* ... */ });
  }
  ```

- Acceptance criteria

  - Notes present (1–10), lines trimmed, final overview persisted to `versions.meta.overview`.

  ```10:17:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/parse.ts
  const afterA = text.split(/---VERSION A---/i)[1] ?? "";
  const [poemRaw, notesRaw] = afterA.split(/---NOTES---/i);
  ```

  ```440:447:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
  const updatedMeta: Record<string, unknown> = {
    ...placeholderMeta,
    status: "generated" as const,
    overview: { lines: preview.lines, notes: preview.notes, line_policy: bundle.line_policy },
  };
  ```

- Reviewer rubric (human-in-the-loop)
  - Evaluate faithfulness, fluency, form adherence (line policy), and preservation of must-keep tokens.
  - Server enforces must-keep with single retry; returns 409 `REQUIRED_TOKENS_MISSING` when unmet.
  ```389:409:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
  return NextResponse.json(
    {
      ok: false,
      code: "REQUIRED_TOKENS_MISSING",
      retryable: true,
      missing: stillMissing,
    },
    { status: 409 }
  );
  ```

JSON: Translator acceptance rubric (LLM consumption)

```json
{
  "anti_echo": { "retry": 1, "on_fail_status": 409 },
  "notes": { "min": 1, "max": 10 },
  "overview_persisted": true,
  "must_keep": { "enforced": true, "on_fail_status": 409 }
}
```

Scenario: Accept lines with moderation fail → 400

```48:60:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
const mod = await moderateText(combined);
if (mod.flagged) {
  return NextResponse.json(
    { ok: false, blocked: true, flagged: true, categories: mod.categories, error: "Selected lines flagged by moderation; not saved." },
    { status: 400 }
  );
}
```
