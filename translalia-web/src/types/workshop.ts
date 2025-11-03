export interface WorkshopState {
  messages: Message[];
  sourceText: string;
  analysis: Analysis | null;
  interview: InterviewData;
  interviewStep: number;
  interviewComplete: boolean;
  lines: Line[];
  selections: Record<number, Record<string, string>>;
  compiled: CompiledLine[];
  currentPanel: "context" | "workshop" | "notebook";
  workshopOpen: boolean;
  currentLineIndex: number | null;
  linesCompleted: Set<number>;
  allLinesCompiled: boolean;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  type?: string;
  timestamp: Date;
}

export interface Line {
  text: string;
  tokens: Token[];
}

export interface Token {
  id: string;
  original: string;
  literalMeaning: string;
  grammarTag: string;
  options: TokenOption[];
}

export interface TokenOption {
  id: string;
  text: string;
  registerTag: string;
  confidence: "high" | "medium" | "low";
  note?: string;
}

export interface CompiledLine {
  lineIndex: number;
  text: string;
  notes: string;
  syllables: number;
  stressPattern: string;
}

export interface Analysis {
  language: string;
  tone: string;
  mood: string;
  confidence: string;
  specialNote?: string | null;
}

export interface InterviewData {
  targetLanguage: string;
  dialect: string | null;
  mixingAllowed: boolean;
  desiredMood: string | null;
  desiredTone: string | null;
  lockedPhrases: string[];
  focusWords: string[];
}
