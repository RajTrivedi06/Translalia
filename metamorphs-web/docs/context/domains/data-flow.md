### [Last Updated: 2025-09-16]

## Domain: Data Flow

End-to-end: Interview → Plan → Preview → Accept → Canvas

### Pipeline (textual diagram with anchors)

1. Interview (collect fields in `chat_threads.state`)

```60:71:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/flow/peek/route.ts
const phase = state.phase || (has_poem ? "interviewing" : "welcome");
if (phase === "interviewing") {
  const q = computeNextQuestion({ ...state, collected_fields: state.collected_fields || {} });
}
```

2. Plan (confirm gate → translating)

```28:34:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/flow/confirm/route.ts
if (state.phase !== "await_plan_confirm") {
  return NextResponse.json({ error: "Not at plan gate" }, { status: 409 });
}
await patchThreadState(threadId, { phase: "translating" });
```

3. Preview (LLM + anti-echo + cache; placeholder node → generated)

```55:58:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

```124:134:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const { data: inserted } = await sb.from("versions").insert({ project_id: projectId, title: displayLabel, lines: [], meta: placeholderMeta, tags: ["translation"] }).select("id").single();
```

```361:396:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
await cacheSet(key, preview, 3600);
const { error: upErr2 } = await sb.from("versions").update({ meta: updatedMeta }).eq("id", placeholderId);
```

4. Accept (merge lines via RPC and append ledger)

```63:71:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
for (const s of selections) { await supabase.rpc("accept_line", { p_thread_id: threadId, p_line_index: s.index + 1, p_new_text: s.text, p_actor: userId }); }
```

```72:76:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
await appendLedger(threadId, { ts, kind: "accept", note: `Accepted ${selections.length} line(s)` });
```

5. Canvas (React Query lists nodes by thread)

```33:38:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
.from("versions").select("id, tags, meta, created_at").eq("project_id", th.project_id).filter("meta->>thread_id", "eq", threadId)
```

### Notes

- Target variety is enforced before translate/preview.

```103:121:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const hasTarget = Boolean(state.collected_fields?.target_lang_or_variety || enhanced?.target);
if (!hasTarget) return NextResponse.json({ error: "MISSING_TARGET_VARIETY" }, { status: 422 });
```
