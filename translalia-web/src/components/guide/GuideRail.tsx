"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { FileText, UploadCloud, X, Info, ChevronLeft } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";

import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { cn } from "@/lib/utils";
import { useSaveAnswer, useSavePoemState } from "@/lib/hooks/useGuideFlow";
import { ConfirmationDialog } from "@/components/guide/ConfirmationDialog";

interface GuideRailProps {
  className?: string;
  onCollapseToggle?: () => void;
  onAutoCollapse?: () => void;
  isCollapsed?: boolean;
  showHeading?: boolean;
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

export function GuideRail({
  className = "",
  onCollapseToggle,
  onAutoCollapse,
  isCollapsed: _isCollapsed, // Prop available but not used in this component's logic
  showHeading = true,
}: GuideRailProps) {
  const t = useTranslations("Guide");
  const tThread = useTranslations("Thread");
  const locale = useLocale();
  const router = useRouter();

  // Determine text direction for inputs
  const dir = locale === "ar" ? "rtl" : "ltr";

  const {
    poem,
    setPoem,
    submitPoem,
    setPreserveFormatting,
    translationIntent,
    setTranslationIntent,
    submitTranslationIntent,
    reset,
    hydrated,
    checkGuideComplete,
    unlockWorkshop,
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
  const savePoemState = useSavePoemState();

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showGuideHints, setShowGuideHints] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
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
  const hasBlankLinesDetected =
    hasBlankLines(poem.text ?? "") && !hasStartedWork;

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

  // Don't render until store is hydrated
  if (!hydrated) {
    return null;
  }

  const ariaAnnouncement = readyForWorkshop
    ? t("ariaAnnouncementComplete")
    : t("ariaAnnouncementProgress");

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
    // Just mark as submitted (stanzas already computed in setPoem)
    submitPoem();
  };

  const handleSaveZone = async () => {
    if (!translationZoneText.trim()) {
      setZoneError(t("zoneErrorDescribe"));
      return;
    }

    if (!threadId) {
      setZoneError(t("zoneErrorThread"));
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
    } catch {
      setZoneError(t("zoneErrorSave"));
    } finally {
      setIsSavingZone(false);
    }
  };

  const handleSaveIntent = async () => {
    if (!translationIntentText.trim()) {
      setIntentError(t("intentErrorDescribe"));
      return;
    }

    if (!threadId) {
      setIntentError(t("intentErrorThread"));
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
    } catch {
      setIntentError(t("intentErrorSave"));
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

  const handleStartWorkshop = () => {
    // Validate all fields are complete
    const isComplete = checkGuideComplete();

    if (!isComplete) {
      // Show validation error message
      setValidationError(t("validationError"));
      return;
    }

    // All fields are valid, show confirmation dialog
    setValidationError(null);
    setShowConfirmDialog(true);
  };

  const handleConfirmWorkshop = async () => {
    // Validation
    if (!threadId) {
      setValidationError(t("validationErrorThread"));
      return;
    }
    if (!poem.text || !poem.stanzas) {
      setValidationError(t("validationErrorPoem"));
      return;
    }

    // ✅ IMMEDIATE UI UPDATE: Close dialog, unlock workshop, and navigate
    // Don't wait for API calls - let them happen in background
    setShowConfirmDialog(false);
    setValidationError(null);
    unlockWorkshop();
    onAutoCollapse?.();

    // Navigate immediately so user sees stanza selector right away
    router.push(`/workspaces/${threadId}/threads/${threadId}`);

    // ✅ BACKGROUND: Fire off API calls asynchronously (don't block UI)
    // These will start translation processing in the background
    // User can already interact with stanzas while this happens
    (async () => {
      try {
        // Step 1: Save poem and stanzas to thread state
        // We already validated that poem.stanzas is not null above
        if (!poem.stanzas) {
          console.error("Poem stanzas missing - this should not happen");
          return;
        }
        await savePoemState.mutateAsync({
          threadId,
          rawPoem: poem.text,
          stanzas: poem.stanzas,
        });

        // Step 2: Initialize translation job in background
        const response = await fetch("/api/workshop/initialize-translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            runInitialTick: true, // Start processing immediately
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(
            "Failed to initialize translations:",
            errorData.error || "Unknown error"
          );
          // Note: We don't show error to user here since they're already in workshop
          // Translation processing will just be delayed/retried
        }
      } catch (error) {
        console.error(
          "Error starting background translation processing:",
          error
        );
        // Background error - don't block user from using workshop
        // Translation processing can be retried later
      }
    })();
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
              <span className="sr-only">
                {t("removeFile", { name: chip.name })}
              </span>
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
              {t("poemTitle")} {isPoemSubmitted && "✓"}
            </label>
            <p className="mt-1 text-xs text-gray-500">{t("poemHelper")}</p>
          </div>
          <span className="text-xs font-medium text-gray-500">
            {t("characterCount", {
              current: poemCharCount,
              limit: POEM_CHAR_LIMIT,
            })}
          </span>
        </div>

        <div className="px-4 py-3">
          <div
            className="inline-flex rounded-full bg-gray-100 p-1 text-sm font-medium text-gray-500"
            role="tablist"
            aria-label={t("poemModeLabel")}
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
              {t("paste")}
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
              {t("upload")}
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
              placeholder={t("poemPlaceholder")}
              aria-describedby="poem-helper poem-error"
              lang={locale}
              dir={dir}
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm leading-tight text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              style={{ maxHeight: "40vh", overflowY: "auto" }}
            />
            <p id="poem-helper" className="text-xs text-gray-500">
              {t("poemHelper")}
            </p>
            {(poem.stanzas?.totalStanzas ?? 0) > 0 || hasBlankLinesDetected ? (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowGuideHints((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 rounded"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                  {showGuideHints
                    ? t("hideDetectionNotes")
                    : t("showDetectionNotes")}
                </button>
                {showGuideHints && (
                  <div className="mt-2 space-y-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-700">
                    {poem.stanzas && poem.stanzas.totalStanzas > 0 && (
                      <p>
                        {t("chunksDetected", {
                          count: poem.stanzas.totalStanzas,
                        })}
                      </p>
                    )}
                    {hasBlankLinesDetected && (
                      <div className="flex items-center justify-between gap-3">
                        <span>{t("blankLinesDetected")}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUserHasManuallySetFormatting(true);
                            setPreserveFormatting(!poem.preserveFormatting);
                          }}
                          className="text-xs font-medium text-blue-600 underline transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 rounded"
                        >
                          {poem.preserveFormatting
                            ? t("collapseBlanks")
                            : t("preserve")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
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
                {t("uploadPoemFile")}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  id="poem-upload-btn"
                  onClick={() => poemFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  {t("chooseFiles")}
                </button>
                <button
                  type="button"
                  id="poem-upload-clear"
                  onClick={clearPoemFiles}
                  className="text-sm font-medium text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                  {t("clear")}
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
            {t("addReferenceCorpus")}
          </button>

          {showCorpus && (
            <div className="corpus-popover mt-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-gray-600">
                  {t("corpusDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCorpus(false);
                  }}
                  className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                  aria-label={t("closeCorpusUploader")}
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
                  {t("uploadFiles")}
                </button>
                <button
                  type="button"
                  id="corpus-help-link"
                  className="text-sm font-medium text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                  title={t("corpusHelpTooltip")}
                >
                  {t("corpusHelp")}
                </button>
              </div>

              {renderFileChips(corpusFiles, removeCorpusFile)}

              <button
                type="button"
                onClick={clearCorpusFiles}
                className="mt-3 text-xs font-medium text-gray-500 transition hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                {t("clearCorpusFiles")}
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-500">
              {!isPoemSubmitted && t("submitShortcut")}
            </div>
            <button
              id="add-poem-btn"
              type="button"
              onClick={handlePoemSubmit}
              disabled={isSubmitDisabled || isPoemSubmitted}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPoemSubmitted ? t("poemSubmitted") : t("submitPoem")}
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
                {t("translationZone")} {isTranslationZoneSubmitted && "✓"}
              </label>
              {isTranslationZoneSubmitted && (
                <button
                  type="button"
                  onClick={() => setEditingZone(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {t("edit")}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t("translationZoneHelper")}
            </p>
            <p className="text-xs text-gray-400 italic">
              {t("translationZoneExamples")}
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
              placeholder={t("translationZonePlaceholder")}
              lang={locale}
              dir={dir}
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
                  ? t("saving")
                  : editingZone
                  ? t("updateZone")
                  : t("saveZone")}
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
                {t("translationIntent")} {isTranslationIntentSubmitted && "✓"}
              </label>
              {isTranslationIntentSubmitted && (
                <button
                  type="button"
                  onClick={() => setEditingIntent(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {t("edit")}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t("translationIntentHelper")}
            </p>
            <p className="text-xs text-gray-400 italic">
              {t("translationIntentExamples")}
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
              placeholder={t("translationIntentPlaceholder")}
              lang={locale}
              dir={dir}
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
                  ? t("saving")
                  : editingIntent
                  ? t("updateIntent")
                  : t("saveIntent")}
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
          "flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm",
          className
        )}
      >
        <div id="context-panel" className="flex h-full flex-col">
          {showHeading && (
            <div className="flex flex-row items-start justify-between gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-gray-900 lg:text-lg">
                  {t("title")}
                </h2>
                <p className="mt-1 text-xs text-slate-500 lg:text-sm">
                  {t("subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={onCollapseToggle}
                className="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                title={tThread("collapseGuidePanel")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}

          <div
            id="guide-scroll-region"
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-4"
          >
            {renderSetup()}
          </div>

          <div className="bg-white px-4 py-3">
            {/* Validation error message */}
            {validationError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {validationError}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                id="start-workshop-btn"
                type="button"
                onClick={handleStartWorkshop}
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {t("startWorkshop")}
              </button>
              <button
                id="clear-guide-btn"
                type="button"
                onClick={handleResetAll}
                className="w-full rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 sm:w-auto"
              >
                {t("clearInputs")}
              </button>
            </div>
            <div className="sr-only" aria-live="polite">
              {ariaAnnouncement}
            </div>
          </div>

          {/* Confirmation Dialog */}
          <ConfirmationDialog
            open={showConfirmDialog}
            onOpenChange={setShowConfirmDialog}
            onConfirm={handleConfirmWorkshop}
            isLoading={false}
            title={t("confirmDialogTitle")}
            description={t("confirmDialogDescription")}
            confirmText={t("confirmDialogConfirm")}
            cancelText={t("confirmDialogCancel")}
          />
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
