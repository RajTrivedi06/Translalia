"use client";
import * as React from "react";
import { Bot, MessageCircle, Sparkles, FileText } from "lucide-react";
import { WelcomeCard } from "./WelcomeCard";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function ChatTimeline() {
  return (
    <div className="space-y-8">
      {/* Special system welcome (per design.HTML) */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <Sparkles className="h-5 w-5 text-gray-600" />
        </div>
        <WelcomeCard />
      </div>

      {/* Example user bubble (visual only) */}
      <div className="flex items-start justify-end gap-4">
        <div className="rounded-l-xl rounded-br-xl bg-gray-700 p-4 text-white shadow">
          <p className="mb-2 font-medium">Here's the poem I'd like to translate:</p>
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200">
Votre âme est un paysage choisi
Que vont charmant masques et bergamasques…
          </pre>
        </div>
        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-300" />
      </div>

      {/* Example assistant card (analysis look) */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <Bot className="h-5 w-5 text-gray-600" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="inline-block max-w-2xl rounded-bl-xl rounded-r-xl bg-gray-100 p-4">
            <p className="text-gray-700">
              Nice! I've analyzed your text. This looks like Verlaine's <em>Clair de lune</em>.
            </p>
          </div>

          <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-5 shadow">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
              <FileText className="h-5 w-5 text-gray-600" />
              Text Analysis
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Language" value="French" />
              <Info label="Tone" value="Melancholic, dreamlike" />
              <Info label="Themes" value="Masquerade, inner landscape" />
              <Info label="Audience" value="Classroom" />
            </div>
          </div>
        </div>
      </div>

      {/* Example interview chips */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <MessageCircle className="h-5 w-5 text-gray-600" />
        </div>
        <div className="max-w-2xl rounded-bl-xl rounded-r-xl bg-gray-100 p-4">
          <p className="mb-3 text-gray-700">Choose target language:</p>
          <div className="flex flex-wrap gap-2">
            {["English", "Spanish", "German", "Other…"].map((t) => (
              <button
                key={t}
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
                aria-label={`Choose ${t}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}