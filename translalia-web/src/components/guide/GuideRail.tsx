"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, UploadCloud, X, Info } from "lucide-react";

import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { cn } from "@/lib/utils";
import { useSaveAnswer } from "@/lib/hooks/useGuideFlow";
import { t, getLangFromCookie } from "@/lib/i18n/minimal";

interface GuideRailProps {
  className?: string;
}

type UploadChip = {
  id: string;
  name: string;
  size: number;
};

const POEM_CHAR_LIMIT = 5000;

function toChip(file: File): UploadChip {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
  };
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}

function mergeChips(existing: UploadChip[], incoming: UploadChip[]) {
  const map = new Map(existing.map((chip) => [chip.id, chip]));
  for (const chip of incoming) {
    map.set(chip.id, chip);
  }
  return Array.from(map.values());
}

/**
 * Detects if the poem text contains blank lines (lines that are empty or only whitespace)
 */
function hasBlankLines(text: string): boolean {
  if (!text.trim()) return false;
  return text.split("\n").some((line) => line.trim() === "");
}

export function GuideRail({ className = "" }: GuideRailProps) {
  const lang = getLangFromCookie();

  const {
    currentStep,
    poem,
    setPoem,
    submitPoem,
    setPreserveFormatting,
    translationIntent,
    setTranslationIntent,
    submitTranslationIntent,
    reset,
    hydrated,
  } = useGuideStore();

  const translationZone = useGuideStore((s) => s.translationZone);
  const setTranslationZone = useGuideStore((s) => s.setTranslationZone);
  const submitTranslationZone = useGuideStore((s) => s.submitTranslationZone);

  const translationZoneRaw = translationZone.text;
  const translationZoneText =
    typeof translationZoneRaw === "string" ? translationZoneRaw : "";
  const isTranslationZoneSubmitted = translationZone.isSubmitted;

  const workshopReset = useWorkshopStore((s) => s.reset);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const threadId = useThreadId();
  const previousThreadId = useRef<string | null>(null);
  const saveTranslationIntent = useSaveAnswer();

  const [poemMode, setPoemMode] = useState<"paste" | "upload">("paste");
  const [poemFiles, setPoemFiles] = useState<UploadChip[]>([]);
  const [corpusFiles, setCorpusFiles] = useState<UploadChip[]>([]);
  const [showCorpus, setShowCorpus] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState(false);
  const [editingIntent, setEditingIntent] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [isSavingZone, setIsSavingZone] = useState(false);
  const [isSavingIntent, setIsSavingIntent] = useState(false);
  const [userHasManuallySetFormatting, setUserHasManuallySetFormatting] =
    useState(false);
  const poemTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const poemFileInputRef = useRef<HTMLInputElement | null>(null);
  const corpusFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (
      threadId &&
      previousThreadId.current &&
      threadId !== previousThreadId.current
    ) {
      reset();
      workshopReset();
      setPoemFiles([]);
      setCorpusFiles([]);
      setPoemMode("paste");
      setShowCorpus(false);
      setUserHasManuallySetFormatting(false);
    }

    if (threadId) {
      previousThreadId.current = threadId;
    }
  }, [threadId, reset, workshopReset]);

  const poemText = poem.text ?? "";
  const poemCharCount = poemText.length;
  const isSubmitDisabled = !poemText.trim();
  const translationIntentRaw = translationIntent?.text;
  const translationIntentText =
    typeof translationIntentRaw === "string" ? translationIntentRaw : "";
  const isTranslationIntentFilled = translationIntentText.trim().length > 0;
  const isTranslationIntentSubmitted =
    translationIntent?.isSubmitted && isTranslationIntentFilled;

  const readyForWorkshop = poem.isSubmitted && isTranslationIntentSubmitted;

  // Safety check for formatting toggle
  const hasStartedWork = Object.keys(completedLines).length > 0;

  // Auto-detect blank lines and set preserveFormatting accordingly
  // Only auto-set if user hasn't manually changed it
  useEffect(() => {
    if (!poem.text || hasStartedWork || userHasManuallySetFormatting) {
      return;
    }

    const hasBlanks = hasBlankLines(poem.text);
    // Auto-preserve if blank lines detected, otherwise auto-collapse
    if (hasBlanks && !poem.preserveFormatting) {
      setPreserveFormatting(true);
    } else if (!hasBlanks && poem.preserveFormatting) {
      setPreserveFormatting(false);
    }
  }, [
    poem.text,
    poem.preserveFormatting,
    hasStartedWork,
    userHasManuallySetFormatting,
    setPreserveFormatting,
  ]);

  const headerSubtitle = useMemo(() => {
    if (readyForWorkshop) {
      return "All set—head to the workshop when you're ready.";
    }
    return "Upload your poem and describe the translation intent to begin.";
  }, [readyForWorkshop]);

  // Don't render until store is hydrated
  if (!hydrated) {
    return null;
  }

  const formattedStep = currentStep === "ready" ? "Ready" : "Setup";
  const ariaAnnouncement = readyForWorkshop
    ? "Guide setup complete"
    : "Guide setup in progress";

  const handlePoemChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setPoem(event.target.value.slice(0, POEM_CHAR_LIMIT));
    // Reset manual flag when text changes significantly (user is pasting new content)
    setUserHasManuallySetFormatting(false);
  };

  const handlePoemKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handlePoemSubmit();
    }
  };

  const handlePoemSubmit = () => {
    if (!poem.text?.trim()) {
      return;
    }
    submitPoem();
  };

  const handleSaveZone = async () => {
    if (!translationZoneText.trim()) {
      setZoneError("Please describe the translation zone before saving.");
      return;
    }

    if (!threadId) {
      setZoneError("Open or create a workspace thread to save your zone.");
      return;
    }

    setIsSavingZone(true);
    try {
      await saveTranslationIntent.mutateAsync({
        threadId,
        questionKey: "translationZone",
        value: translationZoneText.trim(),
      });
      submitTranslationZone();
      setEditingZone(false);
    } catch (_error) {
      setZoneError("Failed to save. Please try again.");
    } finally {
      setIsSavingZone(false);
    }
  };

  const handleSaveIntent = async () => {
    if (!translationIntentText.trim()) {
      setIntentError("Please describe the translation intent before saving.");
      return;
    }

    if (!threadId) {
      setIntentError("Open or create a workspace thread to save your intent.");
      return;
    }

    setIsSavingIntent(true);
    try {
      await saveTranslationIntent.mutateAsync({
        threadId,
        questionKey: "translationIntent",
        value: translationIntentText.trim(),
      });
      submitTranslationIntent();
      setEditingIntent(false);
    } catch (_error) {
      setIntentError("Failed to save. Please try again.");
    } finally {
      setIsSavingIntent(false);
    }
  };

  const handlePoemFileSelection = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const chips = Array.from(fileList).map(toChip);
    setPoemFiles((prev) => mergeChips(prev, chips));
  };

  const handleCorpusFileSelection = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const chips = Array.from(fileList).map(toChip);
    setCorpusFiles((prev) => mergeChips(prev, chips));
  };

  const removePoemFile = (id: string) => {
    setPoemFiles((prev) => prev.filter((chip) => chip.id !== id));
  };

  const removeCorpusFile = (id: string) => {
    setCorpusFiles((prev) => prev.filter((chip) => chip.id !== id));
  };

  const clearPoemFiles = () => setPoemFiles([]);
  const clearCorpusFiles = () => setCorpusFiles([]);

  const handleResetAll = () => {
    reset();
    workshopReset();
    setPoemFiles([]);
    setCorpusFiles([]);
    setPoemMode("paste");
    setShowCorpus(false);
    setIntentError(null);
    setUserHasManuallySetFormatting(false);
  };

  const renderFileChips = (
    chips: UploadChip[],
    onRemove: (id: string) => void
  ) => {
    if (chips.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 flex flex-wrap gap-2 text-left" aria-live="polite">
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
          >
            <FileText
              className="h-3.5 w-3.5 text-gray-500"
              aria-hidden="true"
            />
            <span className="max-w-[140px] truncate">{chip.name}</span>
            <span className="text-[10px] text-gray-400">
              {formatFileSize(chip.size)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(chip.id)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-700 transition hover:bg-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Remove {chip.name}</span>
            </button>
          </span>
        ))}
      </div>
    );
  };

  const isPoemSubmitted = poem.isSubmitted;
  const renderSetup = () => (
    <div className="space-y-4">
      {/* Card 1: Poem Input */}
      <section
        className={cn(
          "rounded-2xl border bg-white shadow-sm transition-all duration-200",
          !isPoemSubmitted
            ? "border-blue-500 ring-2 ring-blue-100"
            : "border-gray-200 opacity-75"
        )}
        aria-labelledby="poem-section-title"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <label
              id="poem-section-title"
              htmlFor="poem-input"
              className="text-sm font-semibold text-gray-900"
            >
              Your poem {isPoemSubmitted && "✓"}
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Paste the original poem (source language).
            </p>
          </div>
          <span className="text-xs font-medium text-gray-500">
            {poemCharCount} / {POEM_CHAR_LIMIT}
          </span>
        </div>

        <div className="px-4 py-3">
          <div
            className="inline-flex rounded-full bg-gray-100 p-1 text-sm font-medium text-gray-500"
            role="tablist"
            aria-label="Poem input mode"
          >
            <button
              type="button"
              id="poem-tab-paste-btn"
              className={cn(
                "relative rounded-full px-4 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                poemMode === "paste"
                  ? "text-gray-900 after:absolute after:-bottom-[10px] after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-blue-500 after:to-blue-700 after:content-['']"
                  : "text-gray-500 hover:text-gray-700"
              )}
              role="tab"
              aria-selected={poemMode === "paste"}
              aria-controls="poem-tab-paste"
              onClick={() => setPoemMode("paste")}
            >
              Paste
            </button>
            <button
              type="button"
              id="poem-tab-upload-btn"
              className={cn(
                "relative rounded-full px-4 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                poemMode === "upload"
                  ? "text-gray-900 after:absolute after:-bottom-[10px] after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-blue-500 after:to-blue-700 after:content-['']"
                  : "text-gray-500 hover:text-gray-700"
              )}
              role="tab"
              aria-selected={poemMode === "upload"}
              aria-controls="poem-tab-upload"
              onClick={() => setPoemMode("upload")}
            >
              Upload
            </button>
          </div>

          <div
            id="poem-tab-paste"
            role="tabpanel"
            aria-labelledby="poem-tab-paste-btn"
            className={cn("mt-4 space-y-3", poemMode !== "paste" && "hidden")}
          >
            <textarea
              id="poem-input"
              ref={poemTextareaRef}
              rows={5}
              maxLength={POEM_CHAR_LIMIT}
              value={poemText}
              onChange={handlePoemChange}
              onKeyDown={handlePoemKeyDown}
              placeholder={t("guide.poemPlaceholder", lang)}
              aria-describedby="poem-helper poem-error"
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm leading-tight text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              style={{ maxHeight: "40vh", overflowY: "auto" }}
            />
            <p id="poem-helper" className="text-xs text-gray-500">
              Paste the original poem (source language).
            </p>
            <p
              id="poem-error"
              className="hidden text-sm text-red-600"
              aria-live="polite"
            />

            {/* Auto-detected Formatting Indicator - Only shown when blank lines detected */}
            {hasBlankLines(poemText) && !hasStartedWork && (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 mb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span className="text-xs text-blue-700">
                    Blank lines detected — formatting will be preserved
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserHasManuallySetFormatting(true);
                    setPreserveFormatting(!poem.preserveFormatting);
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 rounded"
                >
                  {poem.preserveFormatting ? "Collapse blanks" : "Preserve"}
                </button>
              </div>
            )}
          </div>

          <div
            id="poem-tab-upload"
            role="tabpanel"
            aria-labelledby="poem-tab-upload-btn"
            className={cn("mt-4 space-y-3", poemMode !== "upload" && "hidden")}
          >
            <input
              ref={poemFileInputRef}
              id="poem-file-input"
              type="file"
              className="hidden"
              accept=".txt,.md,.doc,.docx,.pdf"
              multiple
              onChange={(event) => handlePoemFileSelection(event.target.files)}
            />
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <FileText
                className="mx-auto h-8 w-8 text-gray-400"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-gray-600">
                Upload a poem file (.txt, .md, .docx, .pdf).
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  id="poem-upload-btn"
                  onClick={() => poemFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  Choose files
                </button>
                <button
                  type="button"
                  id="poem-upload-clear"
                  onClick={clearPoemFiles}
                  className="text-sm font-medium text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                  Clear
                </button>
              </div>
            </div>
            {renderFileChips(poemFiles, removePoemFile)}
          </div>

          <button
            id="corpus-trigger"
            type="button"
            onClick={() => setShowCorpus((prev) => !prev)}
            className="mt-4 text-sm font-semibold text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            Add reference corpus (optional)
          </button>

          {showCorpus && (
            <div className="corpus-popover mt-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-gray-600">
                  Upload texts that represent the desired voice/style.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCorpus(false);
                  }}
                  className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                  aria-label="Close corpus uploader"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <input
                ref={corpusFileInputRef}
                id="corpus-file-input"
                type="file"
                className="hidden"
                accept=".txt,.md,.doc,.docx,.pdf"
                multiple
                onChange={(event) =>
                  handleCorpusFileSelection(event.target.files)
                }
              />

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  id="corpus-upload-btn"
                  onClick={() => corpusFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  Upload files
                </button>
                <button
                  type="button"
                  id="corpus-help-link"
                  className="text-sm font-medium text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                  title="Share backlist titles, comparable translations, or publications that capture the target voice."
                >
                  What should I upload?
                </button>
              </div>

              {renderFileChips(corpusFiles, removeCorpusFile)}

              <button
                type="button"
                onClick={clearCorpusFiles}
                className="mt-3 text-xs font-medium text-gray-500 transition hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                Clear corpus files
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-500">
              {!isPoemSubmitted && "Cmd/Ctrl + Enter to submit."}
            </div>
            <button
              id="add-poem-btn"
              type="button"
              onClick={handlePoemSubmit}
              disabled={isSubmitDisabled || isPoemSubmitted}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPoemSubmitted ? "Poem Submitted ✓" : "Submit Poem"}
            </button>
          </div>
        </div>
      </section>

      {/* Card 2: Translation Zone */}
      {isPoemSubmitted && (
        <section
          className={cn(
            "rounded-2xl border bg-white shadow-sm transition-all duration-200",
            !isTranslationZoneSubmitted
              ? "border-blue-500 ring-2 ring-blue-100"
              : "border-gray-200"
          )}
          aria-labelledby="translation-zone-title"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <label
                id="translation-zone-title"
                htmlFor="translation-zone-input"
                className="text-sm font-semibold text-gray-900"
              >
                {t("guide.translationZone", lang)}{" "}
                {isTranslationZoneSubmitted && "✓"}
              </label>
              {isTranslationZoneSubmitted && (
                <button
                  type="button"
                  onClick={() => setEditingZone(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {t("guide.edit", lang)}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t("guide.translationZoneHelper", lang)}
            </p>
            <p className="text-xs text-gray-400 italic">
              {t("guide.translationZoneExamples", lang)}
            </p>
          </div>

          <div className="px-4 py-3">
            <textarea
              id="translation-zone-input"
              rows={2}
              value={translationZoneText}
              onChange={(e) => {
                setTranslationZone(e.target.value);
                setZoneError(null);
              }}
              disabled={isTranslationZoneSubmitted && !editingZone}
              placeholder="e.g., Contemporary Mexican Spanish with indigenous influences"
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm leading-tight text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
              style={{ maxHeight: "30vh", overflowY: "auto" }}
            />

            {zoneError && <p className="text-xs text-red-600">{zoneError}</p>}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveZone}
                disabled={!translationZoneText.trim() || isSavingZone}
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingZone
                  ? t("guide.saving", lang)
                  : editingZone
                  ? t("guide.updateZone", lang)
                  : t("guide.saveZone", lang)}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Card 3: Translation Intent */}
      {isPoemSubmitted && (
        <section
          className={cn(
            "rounded-2xl border bg-white shadow-sm transition-all duration-200",
            !isTranslationIntentSubmitted
              ? "border-blue-500 ring-2 ring-blue-100"
              : "border-gray-200"
          )}
          aria-labelledby="translation-intent-title"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <label
                id="translation-intent-title"
                htmlFor="translation-intent-input"
                className="text-sm font-semibold text-gray-900"
              >
                {t("guide.translationIntent", lang)}{" "}
                {isTranslationIntentSubmitted && "✓"}
              </label>
              {isTranslationIntentSubmitted && (
                <button
                  type="button"
                  onClick={() => setEditingIntent(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {t("guide.edit", lang)}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t("guide.translationIntentHelper", lang)}
            </p>
            <p className="text-xs text-gray-400 italic">
              {t("guide.translationIntentExamples", lang)}
            </p>
          </div>

          <div className="px-4 py-3">
            <textarea
              id="translation-intent-input"
              rows={3}
              value={translationIntentText}
              onChange={(e) => {
                setTranslationIntent(e.target.value);
                setIntentError(null);
              }}
              disabled={isTranslationIntentSubmitted && !editingIntent}
              placeholder="e.g., Preserve the rhythmic structure while finding contemporary equivalents"
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm leading-tight text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
              style={{ maxHeight: "30vh", overflowY: "auto" }}
            />

            {intentError && (
              <p className="text-xs text-red-600">{intentError}</p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveIntent}
                disabled={!translationIntentText.trim() || isSavingIntent}
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingIntent
                  ? t("guide.saving", lang)
                  : editingIntent
                  ? t("guide.updateIntent", lang)
                  : t("guide.saveIntent", lang)}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );

  try {
    return (
      <aside
        id="panel-guide"
        data-panel="guide"
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm",
          className
        )}
      >
        <div id="context-panel" className="flex h-full flex-col">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {t("guide.title", lang)}
                </h2>
                <p className="mt-0.5 text-xs text-gray-600">{headerSubtitle}</p>
              </div>
              <span className="inline-flex h-6 items-center rounded-full bg-gray-100 px-2 text-xs font-medium text-gray-600">
                {formattedStep}
              </span>
            </div>
          </div>

          <div
            id="guide-scroll-region"
            className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-3"
          >
            {renderSetup()}
          </div>

          <div className="border-t border-gray-100 bg-white px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                id="start-workshop-btn"
                type="button"
                disabled={!readyForWorkshop}
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Start Workshop
              </button>
              <button
                id="clear-guide-btn"
                type="button"
                onClick={handleResetAll}
                className="w-full rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 sm:w-auto"
              >
                Clear inputs
              </button>
            </div>
            <div className="sr-only" aria-live="polite">
              {ariaAnnouncement}
            </div>
          </div>
        </div>
      </aside>
    );
  } catch (error) {
    return (
      <div className={`h-full p-4 bg-red-100 ${className}`}>
        <h1 className="text-2xl font-bold">Error in GuideRail</h1>
        <pre className="text-xs">{String(error)}</pre>
      </div>
    );
  }
}
