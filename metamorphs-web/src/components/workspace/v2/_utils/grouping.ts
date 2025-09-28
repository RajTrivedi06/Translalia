// src/components/workspace/v2/_utils/grouping.ts
import type { ExplodedLine, ExplodedToken, TokenOption } from "@/types/workshop";

export function groupWithNext(line: ExplodedLine, atIndex: number): ExplodedLine {
  if (atIndex < 0 || atIndex >= line.tokens.length - 1) return line;
  const a = line.tokens[atIndex];
  const b = line.tokens[atIndex + 1];
  const merged: ExplodedToken = {
    tokenId: `${a.tokenId}+${b.tokenId}`,
    surface: `${a.surface} ${b.surface}`,
    kind: "phrase",
    options: mergeOptions(a.options, b.options),
  };
  const tokens = [...line.tokens.slice(0, atIndex), merged, ...line.tokens.slice(atIndex + 2)];
  return { ...line, tokens };
}

export function ungroup(line: ExplodedLine, atIndex: number): ExplodedLine {
  const t = line.tokens[atIndex];
  if (!t || t.kind !== "phrase") return line;
  const parts = t.surface.split(" ").filter(Boolean);
  const tokens: ExplodedToken[] = parts.map((p, i) => ({
    tokenId: `${t.tokenId}:${i}`,
    surface: p,
    kind: "word",
    options: cloneWordOptions(t.options, p),
  }));
  const next = [...line.tokens.slice(0, atIndex), ...tokens, ...line.tokens.slice(atIndex + 1)];
  return { ...line, tokens: next };
}

function mergeOptions(a: TokenOption[], b: TokenOption[]): TokenOption[] {
  // simplistic Phase-2 placeholder: keep first of a, first of b, make two phrase options
  const head = a[0]?.label ?? "";
  const tail = b[0]?.label ?? "";
  const phrase = `${head} ${tail}`.trim();
  return [
    ...(a.slice(0, 1)),
    ...(b.slice(0, 1)),
    { id: "phrase-1", label: phrase, dialect: "Std", from: "lex" },
  ];
}

function cloneWordOptions(src: TokenOption[], surface: string): TokenOption[] {
  // map phrase options back to word-scale; fallback to surface
  return [{ id: "w0", label: surface, dialect: "Std", from: "lex" }];
}