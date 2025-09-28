// src/types/workshop.ts
export type DialectTag = "Std" | "Scots" | "Creole" | "Casual" | string;

export type TokenOption = {
  id: string;
  label: string;
  dialect: DialectTag;
  from?: "llm" | "lex" | "user";
};

export type ExplodedToken = {
  tokenId: string;
  surface: string;
  kind: "word" | "phrase";
  options: TokenOption[];
  selectedOptionId?: string;
};

export type ExplodedLine = {
  lineId: string;
  lineIdx: number;
  tokens: ExplodedToken[];
};