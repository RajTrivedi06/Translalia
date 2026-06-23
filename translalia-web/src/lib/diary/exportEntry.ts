import type {
  DiaryEntry,
  DiaryExportLabels,
  DiaryRefineRhyme,
} from "@/lib/diary/types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "poem"
  );
}

function getValidLines(entry: DiaryEntry) {
  return (
    entry.workshop_lines?.filter(
      (line): line is NonNullable<typeof line> => line !== null
    ) ?? []
  );
}

function hasThreadNote(entry: DiaryEntry): boolean {
  return !!entry.notebook_notes?.thread_note?.trim();
}

function hasLineNotes(entry: DiaryEntry): boolean {
  const lineNotes = entry.notebook_notes?.line_notes ?? {};
  return Object.values(lineNotes).some((note) => note?.trim());
}

function hasNotesAndReflection(entry: DiaryEntry): boolean {
  return (
    hasThreadNote(entry) ||
    hasLineNotes(entry) ||
    !!entry.expressYourView?.trim()
  );
}

function getLineNoteEntries(
  entry: DiaryEntry
): Array<{ lineIndex: number; note: string }> {
  const lineNotes = entry.notebook_notes?.line_notes ?? {};
  return Object.entries(lineNotes)
    .filter(([, note]) => note?.trim())
    .map(([idx, note]) => ({ lineIndex: Number(idx), note: note!.trim() }))
    .filter(({ lineIndex }) => !Number.isNaN(lineIndex))
    .sort((a, b) => a.lineIndex - b.lineIndex);
}

function hasRefineRhyme(entry: DiaryEntry): boolean {
  return hasRefineRhymeData(entry.refineRhyme);
}

function hasRefineRhymeData(
  refineRhyme: DiaryRefineRhyme | null | undefined
): boolean {
  if (!refineRhyme) return false;
  return !!(
    refineRhyme.formalFeatures ||
    refineRhyme.adjustments ||
    refineRhyme.personalize
  );
}

function hasTranslationInsightsData(
  insights: DiaryEntry["translationInsights"]
): boolean {
  if (!insights) return false;
  return !!(
    insights.aims?.trim() ||
    (insights.suggestions && insights.suggestions.length > 0)
  );
}

function hasTranslationInsights(entry: DiaryEntry): boolean {
  return hasTranslationInsightsData(entry.translationInsights);
}

function hasJourneyContent(entry: DiaryEntry): boolean {
  return !!(
    entry.reflection_text?.trim() ||
    (entry.insights && entry.insights.length > 0) ||
    (entry.strengths && entry.strengths.length > 0) ||
    (entry.challenges && entry.challenges.length > 0) ||
    (entry.recommendations && entry.recommendations.length > 0)
  );
}

function hasJourney(entry: DiaryEntry): boolean {
  return hasJourneyContent(entry);
}

function formatDate(iso: string, locale = "en-US"): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildTranslationSectionTxt(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  const lines = getValidLines(entry);
  const parts: string[] = [];

  parts.push(`${labels.translation}\n${"=".repeat(60)}\n`);

  lines.forEach((line, idx) => {
    parts.push(`Line ${idx + 1}`);
    parts.push(`${labels.originalText}: ${line.original}`);
    parts.push(`${labels.translatedText}: ${line.translated}`);
    parts.push("");
  });

  return parts.join("\n");
}

function buildNotesAndReflectionSectionTxt(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  const parts: string[] = [`${labels.notesAndReflection}\n${"=".repeat(60)}`];
  const lineNoteEntries = getLineNoteEntries(entry);

  if (hasThreadNote(entry)) {
    parts.push(`${labels.threadNote}:`);
    parts.push(entry.notebook_notes!.thread_note!);
    parts.push("");
  }

  if (lineNoteEntries.length > 0) {
    parts.push(`${labels.lineNotes}:`);
    lineNoteEntries.forEach(({ lineIndex, note }) => {
      parts.push(`  Line ${lineIndex + 1}: ${note}`);
    });
    parts.push("");
  }

  if (entry.expressYourView?.trim()) {
    parts.push(`${labels.expressYourView}:`);
    parts.push(entry.expressYourView);
    parts.push("");
  }

  return parts.join("\n");
}

function buildRefineRhymeSectionTxt(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  const parts: string[] = [`${labels.refineRhyme}\n${"=".repeat(60)}`];
  const r = entry.refineRhyme;

  if (r && hasRefineRhymeData(r)) {
    if (r.formalFeatures) {
      const ff = r.formalFeatures;
      if (ff.rhymeScheme) {
        parts.push(`${labels.rhymeScheme}: ${ff.rhymeScheme}`);
        if (ff.rhymeSchemeDescription) parts.push(ff.rhymeSchemeDescription);
      }
      if (ff.summary) parts.push(ff.summary);
      if (ff.otherFeatures?.length) {
        parts.push(`\n${labels.otherSoundPatterns}:`);
        ff.otherFeatures.forEach((f) => {
          parts.push(`  • ${f.name}: ${f.description}`);
        });
      }
      parts.push("");
    }

    if (r.adjustments?.adjustments?.length) {
      parts.push(`${labels.suggestedChanges}:`);
      r.adjustments.adjustments.forEach((adj, i) => {
        parts.push(
          `  ${i + 1}. Lines ${adj.targetLines.map((n) => n + 1).join(", ")}`
        );
        parts.push(`     ${labels.current}: ${adj.currentText}`);
        parts.push(`     ${labels.suggested}: ${adj.suggestedText}`);
        parts.push(`     ${adj.explanation}`);
      });
      parts.push("");
    }

    if (r.personalize) {
      const p = r.personalize;
      parts.push(`${labels.personalizedIdeas}:`);
      if (p.insight?.observation) parts.push(p.insight.observation);
      p.suggestions?.forEach((s, i) => {
        parts.push(`  ${i + 1}. ${s.title}`);
        parts.push(`     ${s.description}`);
      });
      if (p.encouragement) parts.push(p.encouragement);
      parts.push("");
    }
  }

  return parts.join("\n");
}

function buildInsightsSectionTxt(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  const parts: string[] = [`${labels.translationInsights}\n${"=".repeat(60)}`];
  const ti = entry.translationInsights;

  if (ti && hasTranslationInsightsData(ti)) {
    if (ti.aims) {
      parts.push(`${labels.yourTranslationAims}:`);
      parts.push(ti.aims);
      parts.push("");
    }
    if (ti.suggestions?.length) {
      parts.push(`${labels.suggestions}:`);
      ti.suggestions.forEach((s, i) => {
        parts.push(`${i + 1}. ${s.title}`);
        parts.push(`   ${s.description}`);
        if (s.lineReferences?.length) {
          parts.push(
            `   Lines: ${s.lineReferences.map((n) => n + 1).join(", ")}`
          );
        }
      });
      parts.push("");
    }
  }
  return parts.join("\n");
}

function buildJourneySectionTxt(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  const parts: string[] = [`${labels.journeySummary}\n${"=".repeat(60)}`];

  if (hasJourneyContent(entry)) {
    if (entry.reflection_text) {
      parts.push(entry.reflection_text);
      parts.push("");
    }
    const appendList = (title: string, items: string[] | null) => {
      if (items?.length) {
        parts.push(`${title}:`);
        items.forEach((item) => parts.push(`  • ${item}`));
        parts.push("");
      }
    };
    appendList(labels.insights, entry.insights);
    appendList(labels.strengths, entry.strengths);
    appendList(labels.challenges, entry.challenges);
    appendList(labels.recommendations, entry.recommendations);
  }
  return parts.join("\n");
}

function buildFullDocumentTxt(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  const title = entry.title?.trim() || labels.untitledPoem;
  const lineCount = getValidLines(entry).length;
  const header = [
    title,
    `${formatDate(entry.thread_created_at)} · ${lineCount} ${labels.lineCount}`,
    "",
    `${labels.generatedOn}: ${new Date().toLocaleString()}`,
    "",
    "-".repeat(60),
    "",
  ].join("\n");

  const sections = [
    buildTranslationSectionTxt(entry, labels),
    buildRefineRhymeSectionTxt(entry, labels),
    buildInsightsSectionTxt(entry, labels),
    buildJourneySectionTxt(entry, labels),
    buildNotesAndReflectionSectionTxt(entry, labels),
  ];

  return header + sections.join("\n");
}

export function exportEntryAsTxt(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): void {
  const text = buildFullDocumentTxt(entry, labels);
  const slug = slugifyTitle(entry.title || labels.untitledPoem);
  const date = new Date(entry.thread_created_at).toISOString().slice(0, 10);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diary-${slug}-${date}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildTranslationSectionHtml(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  const lines = getValidLines(entry);

  const rows = lines
    .map(
      (line, idx) => `
        <div class="comparison-row">
          <div class="line-number">${idx + 1}</div>
          <div class="source">${escapeHtml(line.original)}</div>
          <div class="translation">${escapeHtml(line.translated)}</div>
        </div>
      `
    )
    .join("");

  return `
    <section class="doc-section">
      <h2>${escapeHtml(labels.translation)}</h2>
      <div class="comparison-row header-row">
        <div class="line-number"></div>
        <div class="column-header">${escapeHtml(labels.originalText)}</div>
        <div class="column-header">${escapeHtml(labels.translatedText)}</div>
      </div>
      ${rows}
    </section>
  `;
}

function buildNotesAndReflectionSectionHtml(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  let inner = "";
  const lineNoteEntries = getLineNoteEntries(entry);

  if (hasThreadNote(entry)) {
    inner += `
      <h3>${escapeHtml(labels.threadNote)}</h3>
      <p class="prose">${escapeHtml(entry.notebook_notes!.thread_note!)}</p>
    `;
  }

  if (lineNoteEntries.length > 0) {
    inner += `<h3>${escapeHtml(labels.lineNotes)}</h3><ul>`;
    lineNoteEntries.forEach(({ lineIndex, note }) => {
      inner += `<li><strong>Line ${lineIndex + 1}:</strong> ${escapeHtml(note)}</li>`;
    });
    inner += `</ul>`;
  }

  if (entry.expressYourView?.trim()) {
    inner += `
      <h3>${escapeHtml(labels.expressYourView)}</h3>
      <p class="prose whitespace">${escapeHtml(entry.expressYourView)}</p>
    `;
  }

  return `
    <section class="doc-section accent-amber">
      <h2>${escapeHtml(labels.notesAndReflection)}</h2>
      ${inner}
    </section>
  `;
}

function buildRefineRhymeSectionHtml(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  let inner = "";
  const r = entry.refineRhyme;

  if (r && hasRefineRhymeData(r)) {
    if (r.formalFeatures) {
      const ff = r.formalFeatures;
      if (ff.rhymeScheme) {
        inner += `<p><strong>${escapeHtml(labels.rhymeScheme)}:</strong> ${escapeHtml(ff.rhymeScheme)}</p>`;
        if (ff.rhymeSchemeDescription) {
          inner += `<p class="muted">${escapeHtml(ff.rhymeSchemeDescription)}</p>`;
        }
      }
      if (ff.summary) inner += `<p>${escapeHtml(ff.summary)}</p>`;
      if (ff.otherFeatures?.length) {
        inner += `<h3>${escapeHtml(labels.otherSoundPatterns)}</h3><ul>`;
        ff.otherFeatures.forEach((f) => {
          inner += `<li><strong>${escapeHtml(f.name)}</strong>: ${escapeHtml(f.description)}</li>`;
        });
        inner += `</ul>`;
      }
    }

    if (r.adjustments?.adjustments?.length) {
      inner += `<h3>${escapeHtml(labels.suggestedChanges)}</h3>`;
      r.adjustments.adjustments.forEach((adj, i) => {
        inner += `
        <div class="adjustment-block">
          <p><strong>${i + 1}.</strong> Lines ${adj.targetLines.map((n) => n + 1).join(", ")}</p>
          <p class="muted"><em>${escapeHtml(labels.current)}:</em> ${escapeHtml(adj.currentText)}</p>
          <p><em>${escapeHtml(labels.suggested)}:</em> ${escapeHtml(adj.suggestedText)}</p>
          <p>${escapeHtml(adj.explanation)}</p>
        </div>
      `;
      });
    }

    if (r.personalize) {
      const p = r.personalize;
      inner += `<h3>${escapeHtml(labels.personalizedIdeas)}</h3>`;
      if (p.insight?.observation) {
        inner += `<p>${escapeHtml(p.insight.observation)}</p>`;
      }
      if (p.suggestions?.length) {
        inner += `<ul>`;
        p.suggestions.forEach((s) => {
          inner += `<li><strong>${escapeHtml(s.title)}</strong>: ${escapeHtml(s.description)}</li>`;
        });
        inner += `</ul>`;
      }
      if (p.encouragement) {
        inner += `<p class="muted">${escapeHtml(p.encouragement)}</p>`;
      }
    }
  }

  return `
    <section class="doc-section accent-teal">
      <h2>${escapeHtml(labels.refineRhyme)}</h2>
      ${inner}
    </section>
  `;
}

function buildInsightsSectionHtml(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  let inner = "";
  const ti = entry.translationInsights;

  if (ti && hasTranslationInsightsData(ti)) {
    if (ti.aims) {
      inner += `<h3>${escapeHtml(labels.yourTranslationAims)}</h3><p>${escapeHtml(ti.aims)}</p>`;
    }
    if (ti.suggestions?.length) {
      inner += `<h3>${escapeHtml(labels.suggestions)}</h3><ol>`;
      ti.suggestions.forEach((s) => {
        const lines = s.lineReferences?.length
          ? ` <span class="muted">(Lines ${s.lineReferences.map((n) => n + 1).join(", ")})</span>`
          : "";
        inner += `<li><strong>${escapeHtml(s.title)}</strong>${lines}<br/>${escapeHtml(s.description)}</li>`;
      });
      inner += `</ol>`;
    }
  }

  return `
    <section class="doc-section accent-blue">
      <h2>${escapeHtml(labels.translationInsights)}</h2>
      ${inner}
    </section>
  `;
}

function buildJourneySectionHtml(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): string {
  let inner = "";

  if (hasJourneyContent(entry)) {
    if (entry.reflection_text) {
      inner += `<p class="prose">${escapeHtml(entry.reflection_text)}</p>`;
    }

    const listBlock = (title: string, items: string[] | null) => {
      if (!items?.length) return "";
      return `<h3>${escapeHtml(title)}</h3><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    };

    inner += listBlock(labels.insights, entry.insights);
    inner += listBlock(labels.strengths, entry.strengths);
    inner += listBlock(labels.challenges, entry.challenges);
    inner += listBlock(labels.recommendations, entry.recommendations);
  }

  return `
    <section class="doc-section accent-purple">
      <h2>${escapeHtml(labels.journeySummary)}</h2>
      ${inner}
    </section>
  `;
}

const PRINT_STYLES = `
  @media print {
    body { margin: 0; padding: 16mm; }
    .no-print { display: none; }
  }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.65;
    color: #1a1a1a;
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 32px;
    background: #fff;
  }
  h1 {
    font-size: 1.75rem;
    font-weight: 500;
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }
  .meta {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e5e5;
  }
  .doc-section {
    margin-bottom: 2rem;
    page-break-inside: avoid;
  }
  .doc-section h2 {
    font-size: 1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #444;
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e5e5e5;
  }
  .doc-section h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
    color: #555;
  }
  .accent-teal h2 { border-color: #0d9488; color: #0f766e; }
  .accent-blue h2 { border-color: #3b82f6; color: #1d4ed8; }
  .accent-amber h2 { border-color: #f59e0b; color: #b45309; }
  .comparison-row {
    display: grid;
    grid-template-columns: 32px 1fr 1fr;
    gap: 16px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f0f0f0;
  }
  .header-row {
    border-bottom: 2px solid #333;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #666;
  }
  .line-number { color: #999; font-size: 0.75rem; font-family: monospace; }
  .source { font-style: italic; color: #555; }
  .translation { font-weight: 500; }
  .column-header { }
  .line-note {
    margin: -4px 0 12px 48px;
    padding: 8px 12px;
    background: #fffbeb;
    border-left: 3px solid #f59e0b;
    font-size: 0.875rem;
    color: #78350f;
  }
  .prose { font-size: 1rem; line-height: 1.7; }
  .whitespace { white-space: pre-wrap; }
  .poem {
    white-space: pre-wrap;
    font-family: inherit;
    font-size: 1rem;
    margin: 0;
  }
  .muted { color: #666; font-size: 0.9rem; }
  .adjustment-block {
    margin-bottom: 1rem;
    padding: 12px;
    background: #fafafa;
    border-radius: 6px;
  }
  ul, ol { margin: 0.5rem 0; padding-left: 1.5rem; }
  li { margin-bottom: 0.35rem; }
  .footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e5e5;
    font-size: 0.75rem;
    color: #888;
  }
  .toolbar {
    text-align: center;
    margin-bottom: 24px;
  }
  .toolbar button {
    background: #1a1a1a;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    margin: 0 4px;
  }
  .toolbar button.secondary {
    background: #6b7280;
  }
`;

export function exportEntryAsPdf(
  entry: DiaryEntry,
  labels: DiaryExportLabels
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export as PDF");
    return;
  }

  const title = entry.title?.trim() || labels.untitledPoem;
  const lineCount = getValidLines(entry).length;

  const bodySections = [
    buildTranslationSectionHtml(entry, labels),
    buildRefineRhymeSectionHtml(entry, labels),
    buildInsightsSectionHtml(entry, labels),
    buildJourneySectionHtml(entry, labels),
    buildNotesAndReflectionSectionHtml(entry, labels),
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} — ${escapeHtml(labels.title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="no-print toolbar">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
    <button type="button" class="secondary" onclick="window.close()">Close</button>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <div>${escapeHtml(formatDate(entry.thread_created_at))} · ${lineCount} ${escapeHtml(labels.lineCount)}</div>
    <div>${escapeHtml(labels.generatedOn)}: ${escapeHtml(new Date().toLocaleString())}</div>
  </div>
  ${bodySections}
  <div class="footer">
    <p>${escapeHtml(labels.title)} · ${escapeHtml(new Date().toLocaleString())}</p>
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

export {
  getValidLines,
  getLineNoteEntries,
  hasThreadNote,
  hasLineNotes,
  hasNotesAndReflection,
  hasRefineRhyme,
  hasRefineRhymeData,
  hasTranslationInsights,
  hasTranslationInsightsData,
  hasJourney,
  hasJourneyContent,
};
