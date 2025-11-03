# Guide Flow Components

This directory contains the React components for the Guide Rail feature, which helps users set up translation parameters through an interactive questionnaire.

## Components

### `GuideRail`

The main component that orchestrates the entire guide flow.

```tsx
import { GuideRail } from "@/components/guide";

export function MyPage() {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <GuideRail />
    </div>
  );
}
```

### `AnalysisCard`

Displays poem analysis results and handles the analysis API call.

### `QuestionCards`

Renders the interactive questionnaire with debounced auto-save.

## Integration Notes

### Store Import

The components use the correct import path:

```tsx
import { useGuideStore } from "@/store/guideSlice";
```

### Thread Management

Components automatically get `threadId` from URL params using:

```tsx
import { useThreadId } from "@/hooks/useThreadId";
```

### API Integration

Uses the provided hooks from `useGuideFlow.ts`:

- `useAnalyzePoem()` - for poem analysis
- `useSaveAnswer()` - for saving individual answers
- `useGuideState()` - for loading saved state

### Error Handling

- Analysis failures show retry button
- Save failures show toast notifications
- Loading states are handled gracefully

## Usage in Workspace

To integrate into an existing workspace:

```tsx
import { GuideRail } from "@/components/guide";

export function WorkspaceWithGuide() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>{/* Your existing workspace content */}</div>
      <div>
        <GuideRail />
      </div>
    </div>
  );
}
```

## State Persistence

The guide state is automatically persisted to Supabase via the `updateGuideState` server action and loaded on component mount.
