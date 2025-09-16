### [Last Updated: 2025-09-16]

## Business Logic

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
