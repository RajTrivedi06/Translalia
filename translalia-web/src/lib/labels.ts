export function indexToAlpha(n: number): string {
  let i = Math.floor(n);
  if (i < 0) i = 0;
  let s = "";
  while (i >= 0) {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

export function indexToDisplayLabel(n: number): string {
  return `Version ${indexToAlpha(n)}`;
}

export function displayLabelToIndex(label: string): number {
  const m = label?.trim().match(/^Version\s+([A-Z]+)$/i);
  if (!m) return -1;
  const letters = m[1].toUpperCase();
  let num = 0;
  for (let i = 0; i < letters.length; i++) {
    num *= 26;
    num += letters.charCodeAt(i) - 64;
  }
  return num - 1;
}
