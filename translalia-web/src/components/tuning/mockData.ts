/**
 * Hardcoded mock data for the Translation Tuning (Beta) view.
 *
 * This represents a single completed pipeline run for line 1 of a poem.
 * It exists purely to build out the UI — there are no API/store connections
 * yet. Real data will be wired in later.
 */

export type PipelineNodeStatus = "done" | "running" | "pending";

export interface SourcePoem {
  title: string;
  author: string;
  lines: string[];
}

export interface PipelineStats {
  totalTokens: number;
  estimatedCost: number;
  timeSeconds: number;
  model: string;
}

export interface LineInfo {
  lineNumber: number;
  totalLines: number;
  sourceLang: string;
  targetLang: string;
  preset: string;
}

export interface PresetOption {
  id: string;
  name: string;
}

export interface PipelineNode {
  id: string;
  name: string;
  status: PipelineNodeStatus;
  /** One-line summary shown under the title in the detail panel. */
  description: string;
  /** Editable nodes show a pencil affordance in the timeline. */
  editable?: boolean;
  /** Primary metadata line, e.g. "8 lines · 412 tokens". */
  metricLine: string;
  /** Optional secondary preview line (rendered italic). */
  previewLine?: string;
  /** Raw structured metadata, preserved for the (future) detail panel. */
  meta: Record<string, string | number | boolean | string[]>;
}

export const sourcePoem: SourcePoem = {
  title: "Hombres necios que acusáis",
  author: "Sor Juana Inés de la Cruz",
  lines: [
    "Hombres necios que acusáis",
    "a la mujer sin razón,",
    "sin ver que sois la ocasión",
    "de lo mismo que culpáis:",
  ],
};

export const pipelineStats: PipelineStats = {
  totalTokens: 12400,
  estimatedCost: 0.02,
  timeSeconds: 4.2,
  model: "gpt-4o-mini",
};

export const lineInfo: LineInfo = {
  lineNumber: 1,
  totalLines: 16,
  sourceLang: "ES",
  targetLang: "EN",
  preset: "Default v2.1",
};

export const presets: PresetOption[] = [
  { id: "default", name: "Default v2.1" },
  { id: "literal", name: "Literal-leaning" },
  { id: "sonic", name: "Sonic-first" },
  { id: "contemporary", name: "Contemporary register" },
];

export const pipelineNodes: PipelineNode[] = [
  {
    id: "context",
    name: "Source Text",
    status: "done",
    description: "Line, surrounding stanza, and style settings.",
    metricLine: "8 lines · 412 tokens",
    previewLine: "“Hombres necios que acusáis…”",
    meta: {
      status: "done",
      contextLines: 8,
      tokens: 412,
      preview: "Hombres necios que acusáis...",
    },
  },
  {
    id: "prompt",
    name: "Prompt Assembly",
    status: "done",
    description: "Compiled instructions, style cues, and source line.",
    editable: true,
    metricLine: "1,184 chars · 286 tokens",
    previewLine: "Sonic-first · 2 custom overrides",
    meta: {
      status: "done",
      editable: true,
      chars: 1184,
      tokens: 286,
      preset: "Sonic-first",
      overrides: 2,
    },
  },
  {
    id: "model",
    name: "AI Generation",
    status: "done",
    description: "Generates three variants. Model & reasoning effort.",
    editable: true,
    metricLine: "gpt-4o-mini · T 0.7",
    previewLine: "142 reasoning tokens",
    meta: {
      status: "done",
      editable: true,
      model: "gpt-4o-mini",
      temperature: 0.7,
      reasoningTokens: 142,
    },
  },
  {
    id: "quality",
    name: "Quality Gates",
    status: "done",
    description: "Schema, diversity, and meaning checks before release.",
    metricLine: "Diversity 0.32 · pass",
    previewLine: "Schema ✓ · 1 retry (variant B)",
    meta: {
      status: "done",
      diversityScore: 0.32,
      diversityPass: true,
      schemaPass: true,
      retries: 1,
      retriedVariant: "B",
    },
  },
  {
    id: "variants",
    name: "3 Variants Ready",
    status: "running",
    description:
      "Three distinct, scored translations released to the workshop.",
    metricLine: "64 output tokens",
    previewLine: "“Foolish…” / “Senseless…” / “Stubborn…”",
    meta: {
      status: "running",
      outputTokens: 64,
      variants: ["Foolish men...", "Senseless men...", "Stubborn men..."],
    },
  },
];

/** AI reasoning trace shown in the Prompt Assembly detail view. */
export const promptReasoning: { tokens: number; steps: string[] } = {
  tokens: 142,
  steps: [
    "Analyzed source: 8 syllables, octosyllabic redondilla; no end rhyme in this opening fragment.",
    'Variant A prioritized literal meaning. Chose "foolish" over "silly" to preserve necios as a moral, not intellectual, failing.',
    "Variant B explored alliterative alternatives for sonic texture; routed through sibilance.",
    "Variant C reimagined as a more contemporary register; tightened sin razón into legal language.",
  ],
};

export type ValidationTone = "success" | "warning" | "error";

export interface TestRunResult {
  current: string[];
  tuned: string[];
  validations: { label: string; tone: ValidationTone }[];
}

/** Mock test-run comparison, presented as if a run just completed. */
export const testRunResult: TestRunResult = {
  current: [
    "Foolish men who accuse women without reason",
    "Senseless men who blame women so unfairly",
    "Stubborn men, you fault women with no cause",
  ],
  tuned: [
    "Foolish men, you accuse women with no reason at all",
    "Reckless men, who level blame against the women you wrong",
    "You wilful men — naming faults in women, never seeing your own",
  ],
  validations: [
    { label: "Structure ✓", tone: "success" },
    { label: "Diversity ✓", tone: "success" },
    { label: "Quality 4.2 / 5", tone: "warning" },
    { label: "Fidelity 4.8 / 5", tone: "success" },
  ],
};

export interface PromptHistoryEntry {
  preset: string;
  timeAgo: string;
  diversity: number;
  quality: number;
  fidelity: number;
  active?: boolean;
}

/** Recent runs for Line 1, shown in the Prompt Assembly "History" tab. */
export const promptHistory: PromptHistoryEntry[] = [
  {
    preset: "Sonic-first",
    timeAgo: "2m ago",
    diversity: 0.32,
    quality: 4.2,
    fidelity: 4.8,
    active: true,
  },
  {
    preset: "Literal-leaning",
    timeAgo: "14m ago",
    diversity: 0.18,
    quality: 3.9,
    fidelity: 4.9,
  },
  {
    preset: "Default v2.1",
    timeAgo: "1h ago",
    diversity: 0.27,
    quality: 4.0,
    fidelity: 4.7,
  },
];

export type DownstreamStatus = "done" | "running" | "pending";

export interface DownstreamFeature {
  id: string;
  name: string;
  metric: string;
  status: DownstreamStatus;
}

/**
 * Downstream analysis stages that run after the per-line pipeline. These are
 * the real product features (kept to the four that currently exist).
 */
export const downstreamFeatures: DownstreamFeature[] = [
  {
    id: "notebook",
    name: "Notebook Analysis",
    metric: "24 nodes",
    status: "done",
  },
  {
    id: "rhyme",
    name: "Rhyme Workshop",
    metric: "ABBA · 1 deviation",
    status: "done",
  },
  {
    id: "poem",
    name: "Poem-Level Suggestions",
    metric: "analyzing…",
    status: "running",
  },
  {
    id: "verify",
    name: "Verification & Grade",
    metric: "pending",
    status: "pending",
  },
];
