"use client";

import * as React from "react";
import { useWorkspace } from "@/store/workspace";
import { useT } from "../_utils/i18n";

const LANGS = ["en", "es", "fr", "de", "hi", "zh", "ar"]; // extend as needed
const STYLES = [
  { id: "literal", label: "Literal" },
  { id: "balanced", label: "Balanced" },
  { id: "formal", label: "Formal" },
  { id: "dialect-rich", label: "Dialect-rich" },
];

export function SettingsCard() {
  const t = useT();
  // Narrow selectors for performance
  const targetLang = useWorkspace((s) => s.ui.targetLang);
  const targetStyle = useWorkspace((s) => s.ui.targetStyle);
  const includeDialectOptions = useWorkspace((s) => s.ui.includeDialectOptions);
  const setTargetLang = useWorkspace((s) => s.setTargetLang);
  const setTargetStyle = useWorkspace((s) => s.setTargetStyle);
  const setIncludeDialectOptions = useWorkspace((s) => s.setIncludeDialectOptions);

  return (
    <section role="region" aria-labelledby="settings-title" className="m-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 space-y-2">
      <h2 id="settings-title" className="mb-2 text-sm font-semibold">{t("settings")}</h2>

      <div className="mb-3 grid grid-cols-[140px_1fr] items-center gap-2">
        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400" htmlFor="target-lang">
          {t("targetLanguage")}
        </label>
        <select
          id="target-lang"
          aria-label={t("targetLanguage")}
          className="h-8 rounded-md border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
          value={targetLang ?? "en"}
          onChange={(e) => setTargetLang(e.target.value)}
        >
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="mb-3 grid grid-cols-[140px_1fr] items-center gap-2">
        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400" htmlFor="target-style">
          {t("targetStyle")}
        </label>
        <select
          id="target-style"
          aria-label={t("targetStyle")}
          className="h-8 rounded-md border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
          value={targetStyle ?? "balanced"}
          onChange={(e) => setTargetStyle(e.target.value)}
          title="Affects the kind of options shown in Workshop (Phase 2+)"
        >
          {STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-[140px_1fr] items-center gap-2">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{t("dialectOptions")}</span>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!includeDialectOptions}
            onChange={(e) => setIncludeDialectOptions(e.target.checked)}
            aria-label={t("dialectOptions")}
            title="Show dialect-tagged options in Workshop (Phase 2)"
            className="focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 rounded-md"
          />
          {t("dialectOptions")}
        </label>
      </div>
    </section>
  );
}

export default SettingsCard;
