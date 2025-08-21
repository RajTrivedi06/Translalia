export async function enforceConstraints(text: string, _rules: string[]) {
  return { ok: true, text, violations: [] as string[] };
}
