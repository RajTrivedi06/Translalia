# Phase 5: AI Assistant Integration - Implementation Plan

**Date:** 2025-10-16
**Status:** 📋 **PLANNED** (Ready for Implementation)

---

## Executive Summary

Phase 5 will integrate AI-powered translation assistance into the notebook, allowing users to choose between writing translations themselves or getting AI suggestions based on their selected words and Guide Rail preferences. This document provides a complete implementation plan based on investigation of the existing codebase.

---

## 1. Investigation Results

### 1.1 Current AI Service Integration

**OpenAI Integration:**
- File: `src/lib/ai/openai.ts`
- Uses `OpenAI` SDK
- API Key: `process.env.OPENAI_API_KEY`
- Model: Configured in `src/lib/models.ts` as `TRANSLATOR_MODEL`
- Current usage: GPT-5 or GPT-4o with fallback

**Existing AI Endpoints:**
- `/api/workshop/generate-options` - Generates word translation options
- `/api/guide/analyze-poem` - Analyzes poem structure
- `/api/interview/next` - Handles interview flow
- `/api/notebook/prismatic` - Generates prismatic variants

### 1.2 Prompt Engineering Patterns

**File:** `src/lib/ai/workshopPrompts.ts`

**Functions:**
1. `buildWordTranslationPrompt()` - Creates context-aware prompts
2. `buildWorkshopSystemPrompt()` - System prompt for translations

**Context Used:**
- Word and line context
- Guide Rail answers (preferences)
- Source/target languages
- Style preferences (vibes)
- Translation closeness (literal vs. creative)
- Must-keep elements

### 1.3 User Preferences Structure

**File:** `src/store/guideSlice.ts`

```typescript
export interface GuideAnswers {
  targetLanguage?: { lang: string; variety: string; script: string };
  audience?: { audience: string; goal: string[] };
  stance?: { closeness: "close" | "in_between" | "natural" };
  style?: { vibes: string[] };
  translanguaging?: { allow: boolean; scopes: string[] };
  policy?: { must_keep: string[]; no_go: string[] };
  form?: { line_breaks: string; rhyme: string; line_length: string };
  style_anchors?: string[];
}
```

---

## 2. AI Assistant Panel Component

### 2.1 Component Structure

**File to Create:** `src/components/notebook/AIAssistantPanel.tsx`

**Purpose:** Sidebar or modal panel for AI-assisted translation

**Features:**
- "Write Myself" vs "AI Assist" choice
- Current cell context display
- AI suggestion preview
- Accept/Reject/Modify workflow
- Loading and error states

### 2.2 Component Interface

```typescript
export interface AIAssistantPanelProps {
  selectedCell: TranslationCellData | null;
  guideAnswers: GuideAnswers;
  poemLine: string;
  onApplySuggestion: (cellId: string, suggestion: string) => void;
  onClose: () => void;
}

export function AIAssistantPanel({
  selectedCell,
  guideAnswers,
  poemLine,
  onApplySuggestion,
  onClose,
}: AIAssistantPanelProps) {
  // Implementation
}
```

### 2.3 UI Layout

```
┌─────────────────────────────────┐
│  AI Translation Assistant       │
│  ×                              │
├─────────────────────────────────┤
│ ┌─────┐ ┌──────────────┐      │
│ │  ✍️  │ │  Write Myself │      │
│ └─────┘ └──────────────┘      │
│ ┌─────┐ ┌──────────────┐      │
│ │  🤖 │ │  AI Assist   │ ✓    │
│ └─────┘ └──────────────┘      │
├─────────────────────────────────┤
│ Your Words:                     │
│ ┌─────────────────────────────┐│
│ │ amour • vie • beauté        ││
│ └─────────────────────────────┘│
├─────────────────────────────────┤
│ AI Suggestion:                  │
│ ┌─────────────────────────────┐│
│ │ 🔄 Generating...            ││
│ └─────────────────────────────┘│
│ or                              │
│ ┌─────────────────────────────┐│
│ │ love, life, and beauty      ││
│ │ ─────────────────────────── ││
│ │ Confidence: 95%             ││
│ │ Style: Natural              ││
│ └─────────────────────────────┘│
├─────────────────────────────────┤
│  [Reject]  [Modify]  [Accept]  │
└─────────────────────────────────┘
```

---

## 3. API Endpoint Implementation

### 3.1 New Endpoint

**File to Create:** `src/app/api/notebook/ai-assist/route.ts`

**Purpose:** Generate AI translation suggestion for assembled words

**Request Schema:**
```typescript
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  cellId: z.string(),
  selectedWords: z.array(z.object({
    text: z.string(),
    originalWord: z.string(),
    partOfSpeech: z.string(),
    position: z.number(),
  })),
  sourceLineText: z.string(),
  instruction: z.enum(["refine", "rephrase", "expand", "simplify"]).optional(),
});
```

**Response Schema:**
```typescript
const ResponseSchema = z.object({
  cellId: z.string(),
  suggestion: z.string(),
  confidence: z.number(), // 0-100
  reasoning: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
});
```

### 3.2 Prompt Engineering

**Function to Create:** `buildAIAssistPrompt()`

**File:** `src/lib/ai/workshopPrompts.ts`

```typescript
export interface AIAssistContext {
  selectedWords: DragData[];
  sourceLineText: string;
  guideAnswers: GuideAnswers;
  instruction?: "refine" | "rephrase" | "expand" | "simplify";
}

export function buildAIAssistPrompt({
  selectedWords,
  sourceLineText,
  guideAnswers,
  instruction = "refine",
}: AIAssistContext): string {
  const targetLang = guideAnswers.targetLanguage?.lang || "the target language";
  const variety = guideAnswers.targetLanguage?.variety || "";
  const vibes = guideAnswers.style?.vibes || [];
  const closeness = guideAnswers.stance?.closeness || "in_between";
  const mustKeep = guideAnswers.policy?.must_keep || [];
  const noGo = guideAnswers.policy?.no_go || [];

  // Current words assembled
  const currentTranslation = selectedWords.map(w => w.text).join(" ");
  const originalWords = selectedWords.map(w => w.originalWord).join(" ");

  // Closeness instruction
  const closenessMap = {
    close: "Stay as close as possible to the literal meaning",
    in_between: "Balance literal accuracy with natural expression",
    natural: "Prioritize natural, idiomatic expression",
  };

  // Instruction mapping
  const instructionMap = {
    refine: "Refine and polish the translation while keeping the core meaning",
    rephrase: "Rephrase for better flow and naturalness",
    expand: "Expand slightly for clarity or poetic effect",
    simplify: "Simplify for directness and clarity",
  };

  return `You are assisting a poetry translator. They have selected individual words from translation options and need help combining them into a natural, poetic line.

SOURCE LINE: "${sourceLineText}"
ORIGINAL WORDS: "${originalWords}"

TRANSLATOR'S WORD CHOICES: "${currentTranslation}"

TRANSLATOR PREFERENCES:
- Target language: ${targetLang}${variety ? ` (${variety} variety)` : ""}
- Style: ${vibes.join(", ") || "Natural poetic expression"}
- Approach: ${closenessMap[closeness]}
${mustKeep.length > 0 ? `- Must preserve: ${mustKeep.join(", ")}` : ""}
${noGo.length > 0 ? `- Avoid: ${noGo.join(", ")}` : ""}

TASK: ${instructionMap[instruction]}

CONSTRAINTS:
1. Use the translator's selected words as the foundation
2. Make MINIMAL changes - respect their choices
3. Adjust word order, articles, connectors ONLY if needed
4. Maintain poetic quality and natural flow
5. Stay true to the source meaning
6. Match the target language variety and style

Provide:
1. A refined translation (single line)
2. A brief explanation of any changes made
3. 2-3 alternative phrasings (optional)

Return ONLY a JSON object:
{
  "suggestion": "the refined translation",
  "confidence": 85,
  "reasoning": "brief explanation",
  "alternatives": ["alt1", "alt2"]
}`;
}
```

### 3.3 System Prompt

```typescript
export function buildAIAssistSystemPrompt(): string {
  return `You are a poetry translation assistant specializing in refining and polishing translations.

IMPORTANT RULES:
- Return ONLY valid JSON
- Respect the translator's word choices
- Make MINIMAL changes
- Focus on natural flow and poetic quality
- Confidence score: 0-100 based on how natural/accurate the suggestion is
- Reasoning: Explain what was changed and why (1 sentence)
- Alternatives: Provide 2-3 variations if useful

WHAT TO ADJUST:
✓ Word order for natural flow
✓ Articles (a, an, the) for grammar
✓ Connectors (and, but, or) for flow
✓ Punctuation for rhythm

WHAT NOT TO CHANGE:
✗ Core vocabulary chosen by translator
✗ Meaning or tone of the line
✗ Replace words with synonyms unnecessarily

Example valid response:
{
  "suggestion": "love and life and beauty bright",
  "confidence": 92,
  "reasoning": "Added conjunction for flow, adjusted word order",
  "alternatives": ["love, life, beauty bright", "bright love and life and beauty"]
}`;
}
```

---

## 4. Write Myself vs AI Assist Choice

### 4.1 Choice Component

**Component:** `AIChoiceCard.tsx`

```typescript
interface AIChoiceCardProps {
  mode: "write" | "assist";
  selected: boolean;
  onClick: () => void;
}

function AIChoiceCard({ mode, selected, onClick }: AIChoiceCardProps) {
  const isWrite = mode === "write";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <div className="text-3xl">
        {isWrite ? "✍️" : "🤖"}
      </div>
      <div className="text-left">
        <h3 className="font-medium text-sm">
          {isWrite ? "Write Myself" : "AI Assist"}
        </h3>
        <p className="text-xs text-gray-500">
          {isWrite
            ? "Manually arrange and edit words"
            : "Get AI suggestions for your selection"}
        </p>
      </div>
      {selected && (
        <Check className="w-5 h-5 text-blue-600 ml-auto" />
      )}
    </button>
  );
}
```

### 4.2 Mode Toggle

**State Management:**
```typescript
const [aiMode, setAIMode] = useState<"write" | "assist">("write");
```

**Behavior:**
- "Write Myself": Default mode, user has full control
- "AI Assist": Shows AI suggestion panel, user can accept/reject/modify

---

## 5. Loading States

### 5.1 Loading Component

```typescript
function AILoadingState() {
  return (
    <div className="p-6 text-center space-y-3">
      <div className="inline-block animate-spin">
        <Sparkles className="w-8 h-8 text-blue-500" />
      </div>
      <p className="text-sm text-gray-600">
        Generating AI suggestion...
      </p>
      <p className="text-xs text-gray-500">
        Analyzing your word choices
      </p>
    </div>
  );
}
```

### 5.2 Loading Flow

1. User clicks "AI Assist"
2. Show loading spinner
3. Display "Generating..." message
4. Show progress indicator (optional)
5. On success: Show suggestion
6. On error: Show error message with retry

---

## 6. Error Handling & Retry

### 6.1 Error States

```typescript
interface AIError {
  type: "network" | "rate_limit" | "api_error" | "invalid_response";
  message: string;
  retryable: boolean;
}

function AIErrorState({ error, onRetry }: { error: AIError; onRetry: () => void }) {
  return (
    <div className="p-6 space-y-3 border border-red-200 rounded-lg bg-red-50">
      <div className="flex items-center gap-2 text-red-700">
        <AlertCircle className="w-5 h-5" />
        <h3 className="font-medium">AI Assist Error</h3>
      </div>

      <p className="text-sm text-red-600">
        {error.message}
      </p>

      {error.retryable && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="w-full"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAIMode("write")}
        className="w-full text-gray-600"
      >
        Write Myself Instead
      </Button>
    </div>
  );
}
```

### 6.2 Error Messages

```typescript
const ERROR_MESSAGES = {
  network: "Network error. Please check your connection and try again.",
  rate_limit: "Rate limit reached. Please wait a moment and try again.",
  api_error: "AI service error. Please try again or write yourself.",
  invalid_response: "Unexpected response from AI. Please try again.",
};
```

---

## 7. AI Response Preview

### 7.1 Suggestion Display

```typescript
interface AISuggestionProps {
  suggestion: string;
  confidence: number;
  reasoning?: string;
  alternatives?: string[];
}

function AISuggestionDisplay({
  suggestion,
  confidence,
  reasoning,
  alternatives,
}: AISuggestionProps) {
  return (
    <div className="space-y-3">
      {/* Main Suggestion */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <p className="text-base font-medium text-gray-900 leading-relaxed">
          {suggestion}
        </p>
      </div>

      {/* Confidence & Reasoning */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-gray-600">
            Confidence: {confidence}%
          </span>
        </div>
        {confidence >= 90 && (
          <Badge variant="success" className="text-xs">
            High Quality
          </Badge>
        )}
      </div>

      {reasoning && (
        <p className="text-xs text-gray-600 italic">
          {reasoning}
        </p>
      )}

      {/* Alternatives */}
      {alternatives && alternatives.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-700 mb-2">
            Alternative Phrasings:
          </h4>
          <div className="space-y-2">
            {alternatives.map((alt, idx) => (
              <button
                key={idx}
                className="w-full text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                onClick={() => onSelectAlternative(alt)}
              >
                {alt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Side-by-Side Comparison

### 8.1 Comparison Component

```typescript
function TranslationComparison({
  original: string;
  userVersion: string;
  aiSuggestion: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Your Version */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-700 flex items-center gap-2">
          <User className="w-3.5 h-3.5" />
          Your Version
        </h4>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm">{userVersion}</p>
        </div>
      </div>

      {/* AI Suggestion */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-700 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          AI Suggestion
        </h4>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm">{aiSuggestion}</p>
        </div>
      </div>

      {/* Original for Reference */}
      <div className="col-span-full space-y-2">
        <h4 className="text-xs font-medium text-gray-500 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          Original Line
        </h4>
        <div className="p-2 bg-white rounded border border-gray-200">
          <p className="text-xs text-gray-600 italic">{original}</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. Accept/Reject/Modify Workflow

### 9.1 Action Buttons

```typescript
function AISuggestionActions({
  suggestion: string;
  onAccept: () => void;
  onReject: () => void;
  onModify: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-4 border-t">
      <Button
        variant="outline"
        size="sm"
        onClick={onReject}
        className="flex-1"
      >
        <X className="w-4 h-4 mr-2" />
        Reject
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={onModify}
        className="flex-1"
      >
        <Edit2 className="w-4 h-4 mr-2" />
        Modify
      </Button>

      <Button
        variant="default"
        size="sm"
        onClick={onAccept}
        className="flex-1 bg-green-600 hover:bg-green-700"
      >
        <Check className="w-4 h-4 mr-2" />
        Accept
      </Button>
    </div>
  );
}
```

### 9.2 Workflow Logic

**Accept:**
1. Apply AI suggestion to current cell
2. Mark cell as modified
3. Close AI assistant panel
4. Show success toast

**Reject:**
1. Dismiss AI suggestion
2. Keep user's original version
3. Return to "Write Myself" mode
4. Optionally show feedback form

**Modify:**
1. Load AI suggestion into edit mode
2. Allow user to edit inline
3. Save changes
4. Mark as modified (hybrid: user + AI)

---

## 10. Implementation Checklist

### 10.1 Backend (API)

- [ ] Create `/api/notebook/ai-assist/route.ts`
- [ ] Implement `buildAIAssistPrompt()` in `workshopPrompts.ts`
- [ ] Implement `buildAIAssistSystemPrompt()`
- [ ] Add rate limiting (10 requests/minute)
- [ ] Add caching for identical requests
- [ ] Add error handling and fallbacks
- [ ] Add telemetry/logging

### 10.2 Frontend Components

- [ ] Create `AIAssistantPanel.tsx`
- [ ] Create `AIChoiceCard.tsx`
- [ ] Create `AISuggestionDisplay.tsx`
- [ ] Create `TranslationComparison.tsx`
- [ ] Create `AILoadingState.tsx`
- [ ] Create `AIErrorState.tsx`
- [ ] Create `AISuggestionActions.tsx`

### 10.3 Integration

- [ ] Add AI assistant toggle to NotebookPanel toolbar
- [ ] Connect to Guide Rail for preferences
- [ ] Connect to Workshop for word selections
- [ ] Add to notebook store (aiSuggestions state)
- [ ] Wire up accept/reject/modify handlers
- [ ] Add keyboard shortcuts (Cmd+Shift+A for AI assist)

### 10.4 Testing

- [ ] Test with various word combinations
- [ ] Test with different Guide Rail preferences
- [ ] Test error states (network, rate limit, etc.)
- [ ] Test loading states and timeouts
- [ ] Test accept/reject/modify workflows
- [ ] Test comparison UI with long text
- [ ] Test on mobile devices

---

## 11. Future Enhancements

### 11.1 Advanced Features

1. **Multi-Cell Suggestions:**
   - AI suggests translations for multiple cells at once
   - Maintains consistency across cells

2. **Iterative Refinement:**
   - "Try Again" with different instructions
   - "More Creative" / "More Literal" buttons
   - Chat-like interface for refinement

3. **Style Learning:**
   - AI learns from user's accept/reject patterns
   - Personalizes suggestions over time

4. **Confidence Thresholds:**
   - Only show suggestions above X% confidence
   - Highlight uncertain parts for review

5. **Batch Processing:**
   - "AI Assist All Cells" button
   - Review queue for batch suggestions

---

## 12. Summary

Phase 5 is **ready for implementation**. This plan provides:

1. ✅ Complete understanding of existing AI integration
2. ✅ Detailed component specifications
3. ✅ API endpoint design
4. ✅ Prompt engineering strategies
5. ✅ UI/UX workflow definitions
6. ✅ Error handling patterns
7. ✅ Testing checklist
8. ✅ Future enhancement roadmap

**Next Steps:**
1. Implement API endpoint with prompt engineering
2. Build AI Assistant Panel components
3. Integrate with existing notebook system
4. Test with real translations
5. Gather user feedback and iterate

**Estimated Implementation Time:** 2-3 days for full feature

---

**Phase 5 Status:** 📋 **PLANNED & READY**
