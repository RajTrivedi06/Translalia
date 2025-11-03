function normalizedLines(lines: string[]): string[] {
  return (lines || [])
    .map((s) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + cost // substitution
      );
      prev = temp;
    }
  }
  return dp[n];
}

export function characterLevelSimilarity(
  source: string,
  output: string
): number {
  const normSource = source
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const normOutput = output
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normSource || !normOutput) return 0;

  const longer =
    normSource.length > normOutput.length ? normSource : normOutput;
  const shorter =
    normSource.length > normOutput.length ? normOutput : normSource;

  const editDistance = levenshteinDistance(shorter, longer);
  const similarity = 1 - editDistance / longer.length;

  return similarity;
}

export function looksLikeEcho(source: string[], output: string[]): boolean {
  // Line-level exact match ratio after normalization
  const src = new Set(normalizedLines(source));
  const out = normalizedLines(output);
  if (src.size === 0 || out.length === 0) return false;
  let same = 0;
  for (const l of out) if (src.has(l)) same++;
  const lineRatio = same / Math.max(out.length, 1);

  // Character-level similarity for paragraphized text
  const sourceText = (source || []).join(" ");
  const outputText = (output || []).join(" ");
  const charSimilarity = characterLevelSimilarity(sourceText, outputText);

  // Echo if EITHER condition is met
  return lineRatio >= 0.5 || charSimilarity >= 0.8;
}
