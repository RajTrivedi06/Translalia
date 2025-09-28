"use client";
import * as React from "react";
import { useWorkspace } from "@/store/workspace";

export function SettingsCard() {
  const [targetLang, setTargetLang] = React.useState<string>("en");
  const [style, setStyle] = React.useState<string>("neutral");
  // placeholder wiring; later integrate with a proper ui slice or persisted settings
  const setCurrentView = useWorkspace((s) => s.setCurrentView);
  return (
    <section
      role="region"
      aria-labelledby="settings-card-title"
      className="rounded-lg border p-3 bg-white dark:bg-neutral-950"
    >
      <div id="settings-card-title" className="mb-2 text-sm font-semibold">
        Settings
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="col-span-2">
          <dt className="text-xs text-neutral-500">Target language</dt>
          <dd>
            <select
              aria-label="Target language"
              className="w-full rounded-md border p-2 text-sm"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-neutral-500">Style</dt>
          <dd>
            <select
              aria-label="Target style"
              className="w-full rounded-md border p-2 text-sm"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option value="neutral">Neutral</option>
              <option value="lyrical">Lyrical</option>
              <option value="formal">Formal</option>
            </select>
          </dd>
        </div>
      </dl>
      <div className="mt-3 text-right">
        <button
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
          onClick={() => setCurrentView("line-selection")}
          aria-label="Start line selection"
        >
          Start selection
        </button>
      </div>
    </section>
  );
}

export default SettingsCard;
