function normalizedLines(lines: string[]): string[] {
  return (lines || [])
    .map((s) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function looksLikeEcho(source: string[], output: string[]): boolean {
  const src = new Set(normalizedLines(source));
  const out = normalizedLines(output);
  if (src.size === 0 || out.length === 0) return false;
  let same = 0;
  for (const l of out) if (src.has(l)) same++;
  const ratio = same / Math.max(out.length, 1);
  return ratio >= 0.5; // if >= 50% lines are exact matches after normalization, treat as echo
}
