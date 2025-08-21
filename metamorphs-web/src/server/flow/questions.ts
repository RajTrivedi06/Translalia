import type { SessionState } from "@/types/sessionState";

export type QuestionId =
  | "q1_target"
  | "q2_form"
  | "q3_tone"
  | "q4_trans"
  | "q5_keep"
  | "q6_avoid"
  | "q7_line"
  | "q8_refs"; // conditional, only when state flag is set (future)

export type Question = {
  id: QuestionId;
  prompt: string;
  required?: boolean; // Q1 is required
};

export const QUESTIONS: Question[] = [
  {
    id: "q1_target",
    required: true,
    prompt:
      "Which language or variety should we translate into? Write it in your own words (e.g., “Moroccan Arabic, Casablanca urban register”).",
  },
  {
    id: "q2_form",
    prompt:
      "Any form constraints? You can say “none”, or describe meter/rhyme (e.g., “loose rhyme”, “iambic pentameter, couplets”).",
  },
  {
    id: "q3_tone",
    prompt:
      "What tone or mood should it carry? Give 3–5 words (e.g., “nostalgic, sea-salted, tender”).",
  },
  {
    id: "q4_trans",
    prompt:
      "Is translanguaging okay (mixing languages/registers when natural)? Reply “yes” or “no”. You can add examples (e.g., a touch of French).",
  },
  {
    id: "q5_keep",
    prompt:
      "List any images/terms we must keep as-is (comma-separated). Or say “none”.",
  },
  {
    id: "q6_avoid",
    prompt:
      "Anything to avoid (e.g., “don’t standardize dialect”, “avoid clichés”)? Or say “none”.",
  },
  {
    id: "q7_line",
    prompt:
      "Line policy: “line-preserving” (keep line breaks) or “free” (looser line breaks)?",
  },
  // q8_refs appears only if you later set a state flag to ask references
];

const isSkip = (s: string) => s.trim().toLowerCase() === "skip";
const isNone = (s: string) => s.trim().toLowerCase() === "none";

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

function parseList(answer: string): string[] {
  if (isSkip(answer) || isNone(answer)) return [];
  return answer
    .split(",")
    .map((x) => clean(x))
    .filter(Boolean)
    .slice(0, 50);
}

function parseTone(answer: string): string {
  if (isSkip(answer)) return ""; // “as in source” default
  // cap at 6 tokens; keep commas for human readability
  const items = answer
    .split(",")
    .map((x) => clean(x))
    .filter(Boolean)
    .slice(0, 6);
  return items.join(", ");
}

function parseYesNo(answer: string): boolean {
  const a = clean(answer).toLowerCase();
  if (isSkip(a)) return false; // default
  return a.startsWith("y"); // yes / yep / yeah
}

function parseLinePolicy(answer: string): "line-preserving" | "free" {
  const a = clean(answer).toLowerCase();
  if (isSkip(a)) return "line-preserving";
  return a.includes("free") ? "free" : "line-preserving";
}

export function computeNextQuestion(state: SessionState): Question | null {
  const f = state.collected_fields ?? {};
  if (!f.target_lang_or_variety) return QUESTIONS[0];
  if (!f.style_form?.meter || !f.style_form?.rhyme) return QUESTIONS[1];
  if (typeof f.style_form?.tone !== "string") return QUESTIONS[2];
  if (typeof f.translanguaging?.allowed !== "boolean") return QUESTIONS[3];
  if (!Array.isArray(f.must_keep)) return QUESTIONS[4];
  if (!Array.isArray(f.must_avoid)) return QUESTIONS[5];
  if (!f.line_policy) return QUESTIONS[6];

  // Optional Q8 if you later set a flag in state; otherwise skip
  // if (state.flags?.ask_references && !Array.isArray(f.references)) return { id: "q8_refs", prompt: "Any references to consider (URLs or short notes)? Or say “none”." };

  return null;
}

export function processAnswer(
  id: QuestionId,
  answer: string,
  prev: SessionState
): SessionState {
  const s: SessionState = {
    ...prev,
    collected_fields: { ...(prev.collected_fields ?? {}) },
  };

  switch (id) {
    case "q1_target": {
      const v = clean(answer);
      if (!v || isSkip(v)) {
        // hard block: target is required
        throw new Error(
          "Target language/variety is required. Please provide a short phrase (e.g., “Moroccan Arabic, Casablanca urban register”)."
        );
      }
      s.collected_fields!.target_lang_or_variety = v;
      break;
    }
    case "q2_form": {
      const a = clean(answer);
      const meter = isSkip(a) || isNone(a) ? "none" : a; // user free-text; we default meter="none"
      const rhyme = isSkip(a) || isNone(a) ? "none" : a; // MVP keeps simple; you can split meter/rhyme later
      s.collected_fields!.style_form = {
        ...(s.collected_fields!.style_form ?? {}),
        meter,
        rhyme,
      };
      break;
    }
    case "q3_tone": {
      s.collected_fields!.style_form = {
        ...(s.collected_fields!.style_form ?? {}),
        tone: parseTone(answer),
      };
      break;
    }
    case "q4_trans": {
      const allowed = parseYesNo(answer);
      // allow user to add examples inline after yes/no using " — " or ":" or parentheses; keep simple:
      const examples =
        answer.includes("touch") || answer.includes("example")
          ? answer
          : undefined;
      s.collected_fields!.translanguaging = {
        allowed,
        ...(examples ? { examples: clean(examples) } : {}),
      };
      break;
    }
    case "q5_keep": {
      s.collected_fields!.must_keep = parseList(answer);
      break;
    }
    case "q6_avoid": {
      s.collected_fields!.must_avoid = parseList(answer);
      break;
    }
    case "q7_line": {
      s.collected_fields!.line_policy = parseLinePolicy(answer);
      break;
    }
    case "q8_refs": {
      // Optional; not used yet in MVP
      // s.collected_fields!.references = parseReferences(answer);
      break;
    }
  }
  return s;
}

export function firstQuestion(): Question {
  return QUESTIONS[0];
}
