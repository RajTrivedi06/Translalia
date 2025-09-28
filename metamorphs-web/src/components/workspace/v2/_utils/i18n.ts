// src/components/workspace/v2/_utils/i18n.ts
import { useUiLangStore } from "@/state/uiLang";

const STRINGS: Record<string, Record<string, string>> = {
  en: {
    source: "Source",
    analysis: "Analysis",
    settings: "Settings",
    targetLanguage: "Target language",
    targetStyle: "Target style",
    dialectOptions: "Dialect options",
    compactLines: "Compact lines",
    search: "Search",
    noSource: "No source yet. Paste a poem or attach a file in Chat to get started.",
    language: "Language",
    form: "Form",
    themes: "Themes",
    audienceTone: "Audience/Tone",
    setDuringInterview: "Set during the interview once available.",
    couldNotLoadSource: "Could not load source right now.",
    selectLinesToWork: "Select lines to work on",
    selectAll: "Select All",
    clearSelection: "Clear",
    proceedToWorkshop: "Proceed to Workshop",
    noSourceLines: "No source lines available",
    lineSelectionHelp: "Click to select lines, Shift+Click for range, Cmd+Click to toggle. Use Cmd+A to select all, Esc to clear.",
  },
  // add locales incrementally later
};

export function useT() {
  const lang = useUiLangStore.getState?.().uiLang ?? "en";
  const dict = STRINGS[lang] ?? STRINGS.en;
  return (k: keyof typeof STRINGS.en) => dict[k] ?? k;
}