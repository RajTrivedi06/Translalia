// src/components/workspace/v2/_utils/data.ts
export function splitStanzas(text: string): string[][] {
  // Return array of stanzas; stanza = array of lines
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map(s => s.split("\n").filter(l => l.length > 0));
}

export type SourceFallback = {
  text?: string;
  titleHint?: string;
};

export function getSourceFromPeek(peek: unknown): SourceFallback {
  const peekData = peek as Record<string, unknown> | undefined;
  const snapshot = peekData?.snapshot as Record<string, unknown> | undefined;
  const state = peekData?.state as Record<string, unknown> | undefined;
  const t =
    snapshot?.poem_excerpt ??
    state?.source_text ??
    state?.poem_text ??
    undefined;
  return { text: typeof t === "string" ? t : undefined };
}

export function getSourceFromNodes(nodes: unknown[] | undefined): SourceFallback {
  // choose latest "complete" node or one with overviewLines
  const n = (nodes ?? []).findLast?.((x: unknown) => {
    const node = x as Record<string, unknown>;
    const overview = node?.overview as Record<string, unknown> | undefined;
    return node?.complete || (overview?.lines as unknown[])?.length > 0;
  }) ?? null;
  if (!n) return {};
  const node = n as Record<string, unknown>;
  const overview = node?.overview as Record<string, unknown> | undefined;
  const lines = overview?.lines as string[] | undefined;
  const text = Array.isArray(lines) ? lines.join("\n") : undefined;
  return { text };
}

export type GetSourceArgs = { flowPeek?: unknown; nodes?: unknown[] };
export function getSourceLines({ flowPeek, nodes }: GetSourceArgs): string[] | null {
  try {
    const peekData = flowPeek as Record<string, unknown> | undefined;
    const state = peekData?.state as Record<string, unknown> | undefined;
    const fromPeek = state?.source_text ?? state?.poem_text;
    if (typeof fromPeek === "string" && fromPeek.trim()) {
      return fromPeek.replace(/\r\n/g, "\n").split("\n");
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.debug("[V2] peek parse error", e);
  }

  try {
    const nodesList = nodes ?? [];
    const latest =
      nodesList.findLast?.((n: unknown) => {
        const node = n as Record<string, unknown>;
        return node?.complete || (node?.overviewLines as unknown[])?.length > 0;
      }) ?? nodesList[nodesList.length - 1];

    if (latest) {
      const node = latest as Record<string, unknown>;
      const overviewLines = node?.overviewLines as string[] | undefined;
      if (Array.isArray(overviewLines) && overviewLines.length > 0) {
        return overviewLines;
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.debug("[V2] nodes parse error", e);
  }
  return null;
}

export type AnalysisSnapshot = {
  language?: string;
  form?: string;
  themes?: string[];
  audienceOrTone?: string;
};

export function getAnalysisSnapshot(peek: unknown, latestNode: unknown): AnalysisSnapshot;
export function getAnalysisSnapshot({
  flowPeek,
  nodeMeta,
}: { flowPeek?: unknown; nodeMeta?: unknown }): AnalysisSnapshot;
export function getAnalysisSnapshot(
  peekOrArgs: unknown | { flowPeek?: unknown; nodeMeta?: unknown },
  latestNode?: unknown
): AnalysisSnapshot {
  // Handle both call signatures for backwards compatibility
  let flowPeek: unknown;
  let nodeMeta: unknown;

  if (peekOrArgs && typeof peekOrArgs === 'object' && 'flowPeek' in peekOrArgs) {
    // New signature: getAnalysisSnapshot({ flowPeek, nodeMeta })
    const args = peekOrArgs as { flowPeek?: unknown; nodeMeta?: unknown };
    flowPeek = args.flowPeek;
    nodeMeta = args.nodeMeta;
  } else {
    // Old signature: getAnalysisSnapshot(peek, latestNode)
    flowPeek = peekOrArgs;
    nodeMeta = (latestNode as Record<string, unknown> | undefined)?.meta;
  }

  try {
    const peekData = flowPeek as Record<string, unknown> | undefined;
    const state = peekData?.state as Record<string, unknown> | undefined;
    const a = state?.analysis as Record<string, unknown> | undefined ?? {};
    const snap: AnalysisSnapshot = {
      language: a.language as string | undefined,
      form: a.form as string | undefined,
      themes: Array.isArray(a.themes) ? a.themes as string[] : undefined,
      audienceOrTone: (a.audience ?? a.tone) as string | undefined,
    };
    if (snap.language || snap.form || snap.themes?.length || snap.audienceOrTone) return snap;
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.debug("[V2] analysis parse error", e);
  }

  const m = nodeMeta as Record<string, unknown> | undefined ?? {};
  return {
    language: m.language as string | undefined,
    form: m.form as string | undefined,
    themes: Array.isArray(m.themes) ? m.themes as string[] : undefined,
    audienceOrTone: (m.audience ?? m.tone) as string | undefined,
  };
}