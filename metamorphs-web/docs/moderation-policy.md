Purpose: Where and how moderation is enforced, and current/intent policies.
Updated: 2025-09-16

# Moderation Policy (2025-09-16)

## Model & Client

- Model: `omni-moderation-latest` via OpenAI moderations API.

```10:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/moderation.ts
const res = await client.moderations.create({
  model: "omni-moderation-latest",
  input: text.slice(0, 20000),
});
```

## Enforcement points (observed)

- Enhancer: block on flagged poem excerpt (`400`).

```44:49:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts
const pre = await moderateText(poem);
if (pre.flagged) {
  return NextResponse.json(
    { error: "Poem content flagged by moderation; cannot enhance." },
    { status: 400 }
  );
}
```

- Translator Preview: pre-check source + enhanced; block `400` if flagged.

```60:67:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const pre = await moderateText(
  bundle.poem + "\n" + JSON.stringify(bundle.enhanced).slice(0, 4000)
);
if (pre.flagged)
  return NextResponse.json(
    { error: "Content flagged by moderation; cannot preview." },
    { status: 400 }
  );
```

- Translate (full): pre-check inputs; post-check outputs; block `400` on pre; set `blocked` flag on post.

```66:71:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const pre = await moderateText([poem, JSON.stringify(enhanced)].join("\n\n"));
if (pre.flagged) {
  return NextResponse.json(
    { error: "Content flagged by moderation; cannot translate." },
    { status: 400 }
  );
}
```

```132:138:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const post = await moderateText(
  parsedOut.data.versionA + "\n" + parsedOut.data.notes.join("\n")
);
const blocked = post.flagged;
const result = { ...parsedOut.data, blocked };
```

- Accept-lines: moderation on accepted text; block `400` if flagged.

```48:50:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
const combined = selections.map((s) => s.text).join("\n");
const mod = await moderateText(combined);
if (mod.flagged) {
```

## Returned fields

- Moderation helper returns `{ flagged, categories }` (categories are provider keys when available).

```16:19:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/moderation.ts
const flagged = !!first?.flagged;
const categories: Record<string, unknown> = first?.categories ?? {};
return { flagged, categories };
```

## Categories (policy intent)

- We do not label categories in responses today; policy intent is to map provider categories (hate, minors, self-harm, violence, PII, harassment) to user-facing guidance in the future.

## Actions

- Block on pre-checks with `400` and a generic message.
- Post-checks set `blocked: boolean` on the result to inform UI handling.
- No auto-downgrade or temperature change is implemented today (policy-only previously documented).

## Known deviations

- We do not include provider category labels in API responses today.
- Some endpoints treat moderation failures as `400` with generic messages; future policy may map categories to specific guidance.

## Escalation (policy intent)

- For repeated borderline cases, consider thread-level throttling and admin notifications. Tooling is not implemented yet.
