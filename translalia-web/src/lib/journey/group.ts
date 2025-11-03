export type JourneyItem = {
  id: string;
  kind: string;
  summary: string;
  meta: Record<string, unknown> | null;
  created_at: string; // ISO timestamp
};

export function groupJourney(items: JourneyItem[]) {
  const out: Array<{ header: JourneyItem; children: JourneyItem[] }> = [];
  const sameBatch = (a: JourneyItem, b: JourneyItem) => {
    if (a.kind !== "accept_line" || b.kind !== "accept_line") return false;
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    // Treat events within 2s & same thread as one batch
    const near = Math.abs(ta - tb) <= 2000;
    const thA = (a.meta as Record<string, unknown> | null)?.thread_id as
      | string
      | undefined;
    const thB = (b.meta as Record<string, unknown> | null)?.thread_id as
      | string
      | undefined;
    return near && !!thA && thA === thB;
  };

  for (const it of items) {
    const last = out[out.length - 1];
    if (last && sameBatch(last.header, it)) {
      last.children.push(it);
      // Prefer the human summary if present (Accepted N line(s))
      const isCount = /Accepted \d+ line/.test(it.summary);
      const lastIsCount = /Accepted \d+ line/.test(last.header.summary);
      if (isCount && !lastIsCount) {
        last.header = it;
      }
    } else {
      out.push({ header: it, children: [] });
    }
  }
  return out;
}


