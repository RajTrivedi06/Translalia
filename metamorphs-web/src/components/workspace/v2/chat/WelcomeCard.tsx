"use client";
import * as React from "react";
import { ArrowRight, Upload } from "lucide-react";

export function WelcomeCard() {
  return (
    <div className="flex-1 rounded-xl border border-gray-200 bg-white p-6 shadow">
      <h3 className="text-lg font-semibold text-gray-900">Welcome to Translation Workshop</h3>
      <p className="mt-2 text-gray-600">
        Paste the text you'd like to translate. We'll guide you step-by-step.
      </p>

      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Source Text
        </label>
        <textarea
          className="mt-2 h-32 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm outline-none focus:border-gray-400"
          placeholder={`Paste your poem here…

Example:
Votre âme est un paysage choisi
Que vont charmant masques et bergamasques…`}
          aria-label="Source text"
        />
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-lg bg-gray-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-gray-800"
          aria-label="Analyze text"
        >
          <ArrowRight className="mr-2 inline h-5 w-5" />
          Analyze Text
        </button>
        <button
          type="button"
          className="rounded-lg border border-gray-300 px-5 py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50"
          aria-label="Upload file"
        >
          <Upload className="mr-2 inline h-5 w-5" />
          Upload File
        </button>
      </div>
    </div>
  );
}