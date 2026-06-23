import { z } from "zod";
import {
  FormalFeaturesAnalysisSchema,
  AdjustmentSuggestionsResponseSchema,
  PersonalizedSuggestionsResponseSchema,
} from "@/types/notebookSuggestions";

const TranslationInsightSuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  lineReferences: z.array(z.number()).optional(),
});

export const TranslationInsightsSnapshotSchema = z.object({
  aims: z.string(),
  suggestions: z.array(TranslationInsightSuggestionSchema),
  confidence: z.number().min(0).max(1).nullable().optional(),
  generated_at: z.string().optional(),
});

export const RefineRhymeStateSchema = z.object({
  formalFeatures: FormalFeaturesAnalysisSchema.optional(),
  adjustments: AdjustmentSuggestionsResponseSchema.optional(),
  personalize: PersonalizedSuggestionsResponseSchema.optional(),
  updated_at: z.string().optional(),
});

export const JourneySummarySnapshotSchema = z.object({
  reflection_text: z.string().nullable().optional(),
  insights: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  challenges: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  created_at: z.string().optional(),
});

export type TranslationInsightsSnapshot = z.infer<
  typeof TranslationInsightsSnapshotSchema
>;

export type RefineRhymeState = z.infer<typeof RefineRhymeStateSchema>;

export type JourneySummarySnapshot = z.infer<
  typeof JourneySummarySnapshotSchema
>;

export interface ReflectionArtifactsResponse {
  translationInsights: {
    aims: string;
    suggestions: TranslationInsightsSnapshot["suggestions"];
    confidence: number | null;
    generatedAt: string | null;
  } | null;
  refineRhyme: {
    formalFeatures: RefineRhymeState["formalFeatures"] | null;
    adjustments: RefineRhymeState["adjustments"] | null;
    personalized: RefineRhymeState["personalize"] | null;
    updatedAt: string | null;
  } | null;
  journeySummary: {
    reflection: string | null;
    insights: string[];
    strengths: string[];
    challenges: string[];
    recommendations: string[];
    createdAt: string | null;
  } | null;
}

export function parseTranslationInsights(
  raw: unknown
): ReflectionArtifactsResponse["translationInsights"] {
  const parsed = TranslationInsightsSnapshotSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { aims, suggestions, confidence, generated_at } = parsed.data;
  if (!aims || suggestions.length === 0) return null;
  return {
    aims,
    suggestions,
    confidence: confidence ?? null,
    generatedAt: generated_at ?? null,
  };
}

export function parseRefineRhymeState(
  raw: unknown
): ReflectionArtifactsResponse["refineRhyme"] {
  const parsed = RefineRhymeStateSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { formalFeatures, adjustments, personalize, updated_at } = parsed.data;
  if (!formalFeatures && !adjustments && !personalize) return null;
  return {
    formalFeatures: formalFeatures ?? null,
    adjustments: adjustments ?? null,
    personalized: personalize ?? null,
    updatedAt: updated_at ?? null,
  };
}

export function parseJourneySummary(
  row: unknown
): ReflectionArtifactsResponse["journeySummary"] {
  const parsed = JourneySummarySnapshotSchema.safeParse(row);
  if (!parsed.success) return null;
  const {
    reflection_text,
    insights,
    strengths,
    challenges,
    recommendations,
    created_at,
  } = parsed.data;
  const hasContent =
    !!reflection_text?.trim() ||
    insights.length > 0 ||
    strengths.length > 0 ||
    challenges.length > 0 ||
    recommendations.length > 0;
  if (!hasContent) return null;
  return {
    reflection: reflection_text ?? null,
    insights,
    strengths,
    challenges,
    recommendations,
    createdAt: created_at ?? null,
  };
}
