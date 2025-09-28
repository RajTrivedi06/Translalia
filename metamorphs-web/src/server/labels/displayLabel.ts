import { supabaseServer } from "@/lib/supabaseServer";
import { indexToDisplayLabel } from "@/lib/labels";

export async function allocateDisplayLabel(threadId: string) {
  const supabase = await supabaseServer();

  const { data: thread, error: thErr } = await supabase
    .from("chat_threads")
    .select("id, project_id, state")
    .eq("id", threadId)
    .single();
  if (thErr || !thread) throw thErr || new Error("Thread not found");

  const state = (thread.state as unknown as Record<string, unknown>) || {};
  const currentIndex = Number.isFinite((state as any).last_display_label_index)
    ? (state as any).last_display_label_index
    : -1;
  const nextIndex = currentIndex + 1;

  const displayLabel = indexToDisplayLabel(nextIndex);

  // Debug logging for label allocation
  console.log("[LABEL] Thread:", threadId);
  console.log("[LABEL] Current index:", currentIndex);
  console.log("[LABEL] Next index:", nextIndex);
  console.log("[LABEL] Display label:", displayLabel);
  if (!displayLabel || displayLabel.includes("?")) {
    console.error("[LABEL] Invalid label generated!", {
      currentIndex,
      nextIndex,
    });
  }

  const nextState = { ...state, last_display_label_index: nextIndex } as Record<
    string,
    unknown
  >;
  const { error: upErr } = await supabase
    .from("chat_threads")
    .update({ state: nextState })
    .eq("id", threadId);
  if (upErr) throw upErr;

  return {
    index: nextIndex,
    displayLabel,
    projectId: thread.project_id as string,
    nextIndex,
  };
}
