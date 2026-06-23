export type DiaryWorkshopLine = {
  original: string;
  translated: string;
  completedAt?: string;
};

export type DiaryTranslationInsights = {
  aims: string;
  suggestions: Array<{
    title: string;
    description: string;
    lineReferences?: number[];
  }>;
  confidence?: number | null;
  generated_at?: string;
};

export type DiaryEntry = {
  thread_id: string;
  title: string;
  thread_created_at: string;
  raw_poem: string | null;
  workshop_lines: Array<DiaryWorkshopLine | null>;
  notebook_notes: {
    thread_note?: string | null;
    line_notes?: Record<number, string>;
  } | null;
  expressYourView: string | null;
  translationInsights: DiaryTranslationInsights | null;
  journey_summary_created_at: string | null;
  reflection_text: string | null;
  insights: string[] | null;
  strengths: string[] | null;
  challenges: string[] | null;
  recommendations: string[] | null;
};

export type DiaryResponse = {
  ok: boolean;
  items: DiaryEntry[];
  nextCursor?: {
    beforeCreatedAt: string;
    beforeId: string;
  };
};

/** Labels for export / print (from Diary i18n namespace). */
export type DiaryExportLabels = {
  title: string;
  heading: string;
  originalText: string;
  translatedText: string;
  translation: string;
  notes: string;
  threadNote: string;
  lineNote: string;
  lineNotes: string;
  translationInsights: string;
  yourTranslationAims: string;
  suggestions: string;
  journeySummary: string;
  insights: string;
  strengths: string;
  challenges: string;
  recommendations: string;
  expressYourView: string;
  originalTextFull: string;
  notesAndReflection: string;
  generatedOn: string;
  lineCount: string;
  untitledPoem: string;
};
