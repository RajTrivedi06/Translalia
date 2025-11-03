export type Version = {
  id: string;
  title: string;
  lines: string[]; // text split per line
  tags: string[]; // e.g., ["literal", "tone:wistful"]
  pos?: { x: number; y: number };
  meta?: {
    model?: string;
    temperature?: number;
    recipe?: string;
    // allow arbitrary keys from DB
    [key: string]: unknown;
  };
  // optional server-only field
  created_at?: string;
};

export type CompareNode = {
  id: string;
  leftVersionId: string;
  rightVersionId: string;
  lens: "meaning" | "form" | "tone" | "culture";
  granularity: "line" | "phrase" | "char";
};

export type JourneyItem = {
  id: string;
  summary: string; // one-line “what changed”
  fromId?: string;
  toId?: string;
  // optional db-hydrated fields
  kind?: string;
  from_version_id?: string | null;
  to_version_id?: string | null;
  compare_id?: string | null;
  created_at?: string;
};
