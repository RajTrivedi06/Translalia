// src/state/uiLang.ts
"use client";

import { create } from "zustand";
const DEFAULT = process.env.NEXT_PUBLIC_UI_LANG_DEFAULT ?? "en";

type UiLangState = { uiLang: string; setUiLang: (l: string) => void };
export const useUiLangStore = create<UiLangState>((set) => ({
  uiLang: DEFAULT,
  setUiLang: (l) => set({ uiLang: l }),
}));
