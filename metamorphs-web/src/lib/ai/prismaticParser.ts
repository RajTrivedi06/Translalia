export type PrismaticSections = {
  A?: string;
  B?: string;
  C?: string;
  NOTES?: string;
  missing: string[];
};

function extract(label: string, text: string) {
  const re = new RegExp(
    `^---${label}---\\s*([\\s\\S]*?)(?=^---[A-Z ].*---|\\Z)`,
    "im"
  );
  const m = text.match(re);
  return m ? m[1].trim() : undefined;
}

export function parsePrismatic(text: string): PrismaticSections {
  const A = extract("VERSION A(?: \\(FAITHFUL\\))?", text);
  const B = extract("VERSION B(?: \\(IDIOMATIC\\))?", text);
  const C = extract("VERSION C(?: \\(CREATIVE\\))?", text);
  const NOTES = extract("NOTES", text);
  const missing = ["A", "B", "C", "NOTES"].filter(
    (k) => !({ A, B, C, NOTES } as any)[k]
  );
  return { A, B, C, NOTES, missing };
}
