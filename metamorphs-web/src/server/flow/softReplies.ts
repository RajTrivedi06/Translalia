export function softReply(intent: string, phase: string) {
  if (intent === "help") {
    if (phase === "welcome")
      return "Paste one stanza to begin. Then I’ll ask a few tiny questions (you can also type “skip”).";
    if (phase === "interviewing")
      return "Answer the current question, or type “skip”. You can always ask for “status” or say “restart”.";
    if (phase === "await_plan_confirm")
      return "Review the plan + poem preview. Type “Looks good” to proceed, or edit any field.";
    if (phase === "translating")
      return "We’re ready to translate. You can adjust your choices or ask for “status”.";
  }
  if (intent === "status") {
    if (phase === "welcome")
      return "We’re at Step 0 (welcome). Paste a stanza to start.";
    if (phase === "interviewing")
      return "We’re interviewing. Answer the current question, or type “skip”.";
    if (phase === "await_plan_confirm")
      return "Plan prepared. Say “Looks good” to proceed.";
    if (phase === "translating")
      return "Translating. You can ask for edits afterward.";
  }
  if (intent === "out_of_scope") {
    if (phase === "welcome")
      return "Let’s begin with a stanza pasted as text. Then I’ll guide you step by step.";
    if (phase === "interviewing")
      return "I’m expecting a short answer to the current question (or “skip”). Ask “help” if you’d like examples.";
    if (phase === "await_plan_confirm")
      return "We’re waiting for confirmation. Say “Looks good” to move on, or edit the fields.";
  }
  if (intent === "restart")
    return "Okay — restarting the interview. Paste your stanza again when you’re ready.";
  if (intent === "looks_good") return "Great — proceeding!";
  return null;
}
