export type CellStatus = 'untranslated' | 'draft' | 'reviewed' | 'locked';

import type { DragData } from "@/types/drag";

export interface NotebookCell {
  id: string;
  lineIndex: number;
  source: {
    text: string;
    language: string;
    dialect?: string;
  };
  translation: {
    text: string;
    status: CellStatus;
    lockedWords: number[];
  };
  notes: string[];
  footnotes: Array<{ word: string; note: string }>;
  prismaticVariants?: Array<{
    label: 'A' | 'B' | 'C';
    text: string;
    rationale: string;
    confidence: number;
  }>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    wordCount: number;
    sourceDragType?: DragData["dragType"];
    sourceVariantId?: number;
    sourceOriginal?: string;
    sourceStanzaIndex?: number;
  };
}

export interface NotebookCellUpdate {
  translation?: string;
  notes?: string[];
  footnotes?: Array<{ word: string; note: string }>;
  lockedWords?: number[];
  status?: CellStatus;
}

export type NotebookFilter = 'all' | 'untranslated' | 'needs_review' | 'locked' | 'with_notes';
export type ExportFormat = 'txt' | 'json' | 'pdf';
