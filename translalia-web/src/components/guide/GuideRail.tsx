"use client";

import * as React from "react";
import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronLeft, Info } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";

import { useGuideStore } from "@/store/guideSlice";
import { useWorkshopStore } from "@/store/workshopSlice";
import { useThreadId } from "@/hooks/useThreadId";
import { cn } from "@/lib/utils";
import {
  useSaveAnswer,
  useSaveMultipleAnswers,
  useSavePoemState,
} from "@/lib/hooks/useGuideFlow";
import { useQueryClient } from "@tanstack/react-query";

import { ConfirmationDialog } from "@/components/guide/ConfirmationDialog";
import { GuideSteps } from "@/components/guide/GuideSteps";
import {
  SegmentEditor,
  type CustomSegmentation,
} from "@/components/guide/SegmentEditor";

interface GuideRailProps {
  className?: string;
  projectId: string;
  threadId: string;
  onCollapseToggle?: () => void;
  onAutoCollapse?: () => void;
  isCollapsed?: boolean;
  showHeading?: boolean;
}

const POEM_CHAR_LIMIT = 5000;

/**
 * Detects if the poem text contains blank lines (lines that are empty or only whitespace)
 */
function hasBlankLines(text: string): boolean {
  if (!text.trim()) return false;
  return text.split("\n").some((line) => line.trim() === "");
}

export function GuideRail({
  className = "",
  projectId,
  threadId: propThreadId,
  onCollapseToggle,
  onAutoCollapse,
  showHeading = true,
}: GuideRailProps) {
  const t = useTranslations("Guide");
  const tThread = useTranslations("Thread");

  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const dir = locale === "ar" ? "rtl" : "ltr";

  const {
    poem,
    setPoem,
    submitPoem,
    setPreserveFormatting,
    setCustomSegmentation,
    translationIntent,
    setTranslationIntent,
    submitTranslationIntent,
    translationRangeMode,
    setTranslationRangeMode,
    translationModel,
    setTranslationModel,
    reset,
    hydrated,
    checkGuideComplete,
    unlockWorkshop,
    isWorkshopUnlocked,
    editSourceLanguageVariety,
  } = useGuideStore();

  const translationZone = useGuideStore((s) => s.translationZone);
  const setTranslationZone = useGuideStore((s) => s.setTranslationZone);
  const submitTranslationZone = useGuideStore((s) => s.submitTranslationZone);

  const sourceLanguageVariety = useGuideStore((s) => s.sourceLanguageVariety);
  const setSourceLanguageVariety = useGuideStore(
    (s) => s.setSourceLanguageVariety
  );
  const submitSourceLanguageVariety = useGuideStore(
    (s) => s.submitSourceLanguageVariety
  );

  const workshopReset = useWorkshopStore((s) => s.reset);
  const completedLines = useWorkshopStore((s) => s.completedLines);
  const draftLines = useWorkshopStore((s) => s.draftLines);
  const lineTranslations = useWorkshopStore((s) => s.lineTranslations);

  const threadIdFromHook = useThreadId();
  const threadId = propThreadId || threadIdFromHook;

  const previousThreadId = useRef<string | null>(null);

  const saveTranslationIntent = useSaveAnswer();
  const saveMultipleAnswers = useSaveMultipleAnswers();
  const savePoemState = useSavePoemState();

  const [intentError, setIntentError] = useState<string | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [varietyError, setVarietyError] = useState<string | null>(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  // Accordion state for auto-opening next step after save
  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    undefined
  );

  const [editingZone, setEditingZone] = useState(false);
  const [editingIntent, setEditingIntent] = useState(false);

  const [isSavingZone, setIsSavingZone] = useState(false);
  const [isSavingIntent, setIsSavingIntent] = useState(false);
  const [isSavingVariety, setIsSavingVariety] = useState(false);
  const [isSavingTranslationRangeMode, setIsSavingTranslationRangeMode] = useState(false);
  const [isSavingTranslationModel, setIsSavingTranslationModel] =
    useState(false);

  const [userHasManuallySetFormatting, setUserHasManuallySetFormatting] =
    useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showGuideHints, setShowGuideHints] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSegmentEditor, setShowSegmentEditor] = useState(false);

  const poemTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // =========================================================================
  // DEBOUNCED AUTO-SAVE (800ms) for translationZone and translationIntent
  // Ensures backend always has fresh guide_answers before translation API calls
  // =========================================================================
  const DEBOUNCE_MS = 800;
  const zoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track last-saved values to avoid redundant saves
  const lastSavedZoneRef = useRef<string | null>(null);
  const lastSavedIntentRef = useRef<string | null>(null);

  /**
   * Debounced auto-save for translationZone.
   * Called on change; also triggered immediately on blur.
   */
  const debouncedSaveZone = useCallback(
    (value: string) => {
      if (!threadId || !value.trim()) return;
      if (value === lastSavedZoneRef.current) return; // No change

      if (zoneDebounceRef.current) clearTimeout(zoneDebounceRef.current);

      zoneDebounceRef.current = setTimeout(async () => {
        try {
          await saveTranslationIntent.mutateAsync({
            threadId,
            questionKey: "translationZone",
            value: value.trim(),
          });
          lastSavedZoneRef.current = value.trim();
        } catch (err) {
          console.error("[debouncedSaveZone] Auto-save failed:", err);
        }
      }, DEBOUNCE_MS);
    },
    [threadId, saveTranslationIntent]
  );

  /**
   * Debounced auto-save for translationIntent.
   * Called on change; also triggered immediately on blur.
   */
  const debouncedSaveIntent = useCallback(
    (value: string) => {
      if (!threadId || !value.trim()) return;
      if (value === lastSavedIntentRef.current) return; // No change

      if (intentDebounceRef.current) clearTimeout(intentDebounceRef.current);

      intentDebounceRef.current = setTimeout(async () => {
        try {
          await saveTranslationIntent.mutateAsync({
            threadId,
            questionKey: "translationIntent",
            value: value.trim(),
          });
          lastSavedIntentRef.current = value.trim();
        } catch (err) {
          console.error("[debouncedSaveIntent] Auto-save failed:", err);
        }
      }, DEBOUNCE_MS);
    },
    [threadId, saveTranslationIntent]
  );

  /**
   * Flush pending saves immediately (called on blur).
   * Accesses store directly to avoid dependency on derived variables.
   */
  const flushPendingSaves = useCallback(async () => {
    if (zoneDebounceRef.current) {
      clearTimeout(zoneDebounceRef.current);
      zoneDebounceRef.current = null;
    }
    if (intentDebounceRef.current) {
      clearTimeout(intentDebounceRef.current);
      intentDebounceRef.current = null;
    }

    // Access store directly to get fresh values
    const storeState = useGuideStore.getState();
    const zoneRaw = storeState.translationZone?.text;
    const intentRaw = storeState.translationIntent?.text;

    const zoneVal = typeof zoneRaw === "string" ? zoneRaw.trim() : "";
    const intentVal = typeof intentRaw === "string" ? intentRaw.trim() : "";

    const promises: Promise<unknown>[] = [];

    if (zoneVal && zoneVal !== lastSavedZoneRef.current && threadId) {
      promises.push(
        saveTranslationIntent
          .mutateAsync({
            threadId,
            questionKey: "translationZone",
            value: zoneVal,
          })
          .then(() => {
            lastSavedZoneRef.current = zoneVal;
          })
          .catch((err) =>
            console.error("[flushPendingSaves] Zone save failed:", err)
          )
      );
    }

    if (intentVal && intentVal !== lastSavedIntentRef.current && threadId) {
      promises.push(
        saveTranslationIntent
          .mutateAsync({
            threadId,
            questionKey: "translationIntent",
            value: intentVal,
          })
          .then(() => {
            lastSavedIntentRef.current = intentVal;
          })
          .catch((err) =>
            console.error("[flushPendingSaves] Intent save failed:", err)
          )
      );
    }

    await Promise.all(promises);
  }, [threadId, saveTranslationIntent]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (zoneDebounceRef.current) clearTimeout(zoneDebounceRef.current);
      if (intentDebounceRef.current) clearTimeout(intentDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (
      threadId &&
      previousThreadId.current &&
      threadId !== previousThreadId.current
    ) {
      reset();
      workshopReset();
      setUserHasManuallySetFormatting(false);
    }

    if (threadId) previousThreadId.current = threadId;
  }, [threadId, reset, workshopReset]);

  const translationZoneRaw = translationZone.text;
  const translationZoneText =
    typeof translationZoneRaw === "string" ? translationZoneRaw : "";
  const isTranslationZoneSubmitted = translationZone.isSubmitted;

  const sourceVarietyRaw = sourceLanguageVariety.text;
  const sourceVarietyText =
    typeof sourceVarietyRaw === "string" ? sourceVarietyRaw : "";
  const isSourceVarietySubmitted = sourceLanguageVariety.isSubmitted;

  const poemText = poem.text ?? "";
  const poemCharCount = poemText.length;
  const isSubmitDisabled = !poemText.trim();

  const translationIntentRaw = translationIntent?.text;
  const translationIntentText =
    typeof translationIntentRaw === "string" ? translationIntentRaw : "";
  const isTranslationIntentFilled = translationIntentText.trim().length > 0;
  const isTranslationIntentSubmitted =
    translationIntent?.isSubmitted && isTranslationIntentFilled;

  const isPoemSubmitted = poem.isSubmitted;

  // Check if there's any workshop progress (must be before canEditSteps)
  const hasWorkshopProgress = React.useMemo(() => {
    const hasCompletedLines = Object.keys(completedLines).length > 0;
    const hasDraftLines = Object.keys(draftLines).length > 0;
    const hasLineTranslations = Object.keys(lineTranslations).length > 0;
    return hasCompletedLines || hasDraftLines || hasLineTranslations;
  }, [completedLines, draftLines, lineTranslations]);

  // Allow editing if workshop hasn't started yet
  const canEditSteps = !isWorkshopUnlocked && !hasWorkshopProgress;

  const canEditVariety = isPoemSubmitted;
  const canEditZone = isPoemSubmitted && isSourceVarietySubmitted;
  const canEditIntent =
    isPoemSubmitted && isSourceVarietySubmitted && isTranslationZoneSubmitted;

  // Handlers to enable editing for each step
  const handleEditStep = React.useCallback(
    (stepIndex: number) => {
      switch (stepIndex) {
        case 0: // Source Language Variety
          editSourceLanguageVariety();
          setAccordionValue("step-1");
          break;
        case 1: // Translation Zone
          // Reset submission state by setting the zone again (this clears isSubmitted)
          setTranslationZone(translationZone.text);
          setEditingZone(true);
          setAccordionValue("step-2");
          break;
        case 2: // Translation Intent
          setEditingIntent(true);
          setAccordionValue("step-3");
          break;
        case 3: // Translation Range
          setAccordionValue("step-4");
          break;
        case 4: // Translation Model
          setAccordionValue("step-5");
          break;
      }
    },
    [
      setAccordionValue,
      setEditingZone,
      setEditingIntent,
      editSourceLanguageVariety,
      setTranslationZone,
      translationZone.text,
    ]
  );

  const hasStartedWork = Object.keys(completedLines).length > 0;

  const hasBlankLinesDetected =
    hasBlankLines(poem.text ?? "") && !hasStartedWork;

  // Auto-detect blank lines and set preserveFormatting accordingly
  // Only auto-set if user hasn't manually changed it
  useEffect(() => {
    if (!poem.text || hasStartedWork || userHasManuallySetFormatting) return;

    const hasBlanks = hasBlankLines(poem.text);

    if (hasBlanks && !poem.preserveFormatting) setPreserveFormatting(true);
    else if (!hasBlanks && poem.preserveFormatting)
      setPreserveFormatting(false);
  }, [
    poem.text,
    poem.preserveFormatting,
    hasStartedWork,
    userHasManuallySetFormatting,
    setPreserveFormatting,
  ]);

  // Get poem lines for segment editor (must be before early returns)
  const poemLines = React.useMemo(() => {
    if (!poem.text) return [];
    return poem.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [poem.text]);

  // Get initial segmentation if exists (must be before early returns)
  const initialSegmentation = React.useMemo(() => {
    if (!poem.customSegmentation) return undefined;
    const lineToSegmentMap = new Map(
      Object.entries(poem.customSegmentation.lineToSegment).map(([k, v]) => [
        Number(k),
        v,
      ])
    );
    return {
      lineToSegment: lineToSegmentMap,
      totalSegments: poem.customSegmentation.totalSegments,
    };
  }, [poem.customSegmentation]);

  // Don't render until store is hydrated
  if (!hydrated) return null;

  const ariaAnnouncement =
    isPoemSubmitted && isTranslationIntentSubmitted
      ? t("ariaAnnouncementComplete")
      : t("ariaAnnouncementProgress");

  const isGuideCompleteUI =
    isPoemSubmitted &&
    isSourceVarietySubmitted &&
    isTranslationZoneSubmitted &&
    isTranslationIntentSubmitted &&
    !!translationRangeMode &&
    !!translationModel;

  const ui = {
    panel: cn(
      "flex h-full flex-col overflow-hidden rounded-lg",
      "border border-border bg-surface shadow-card"
    ),

    panelHeader: cn(
      "flex flex-row items-start justify-between gap-3",
      "px-5 py-4",
      "border-b border-border-subtle"
    ),

    panelTitle: "truncate text-base font-semibold text-foreground lg:text-lg",
    panelSubtitle: "mt-1 text-sm text-foreground-secondary",

    iconButton: cn(
      "flex-shrink-0 rounded-md p-2",
      "text-foreground-muted transition-colors duration-fast",
      "hover:bg-muted hover:text-foreground-secondary",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    ),

    scrollRegion: cn(
      "flex-1 min-h-0 max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-hidden",
      "bg-muted/60",
      "px-4 py-5 md:px-5 md:py-6"
    ),

    footer: cn("bg-surface px-5 py-4", "border-t border-border-subtle"),

    card: cn("rounded-lg border border-border-subtle bg-surface shadow-card", "transition-colors duration-fast"),

    cardHeader: cn(
      "flex items-start justify-between gap-4",
      "px-5 py-4",
      "border-b border-border-subtle"
    ),

    cardBody: cn("px-5 py-5"),

    label: "text-sm font-semibold text-foreground",
    helper: "mt-1 text-sm text-foreground-secondary",
    subtle: "text-xs text-foreground-secondary",
    subtleItalic: "text-xs text-foreground-muted italic",

    pill: cn(
      "inline-flex items-center gap-2 rounded-full",
      "bg-muted px-3 py-1",
      "text-xs font-medium text-foreground-secondary"
    ),

    input: cn(
      "w-full rounded-md border border-border bg-surface",
      "px-4 py-2.5 text-sm text-foreground",
      "shadow-card",
      "placeholder:text-foreground-muted",
      "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
      "disabled:bg-muted disabled:text-foreground-muted",
      "transition-colors duration-fast"
    ),

    textarea: cn(
      "w-full rounded-md border border-border bg-surface",
      "px-4 py-3 text-sm text-foreground",
      "leading-relaxed",
      "shadow-card",
      "placeholder:text-foreground-muted",
      "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
      "disabled:bg-muted disabled:text-foreground-muted",
      "transition-colors duration-fast"
    ),

    primaryBtn: cn(
      "inline-flex items-center justify-center rounded-md",
      "bg-accent px-4 py-2.5 text-sm font-semibold text-white",
      "shadow-card transition-all duration-fast",
      "hover:bg-accent-dark",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50"
    ),

    blueBtn: cn(
      "inline-flex items-center justify-center rounded-md",
      "bg-accent px-4 py-2.5 text-sm font-semibold text-white",
      "shadow-card transition-all duration-fast",
      "hover:bg-accent-dark",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50"
    ),

    ghostBtn: cn(
      "inline-flex items-center justify-center rounded-md",
      "border border-border bg-surface px-4 py-2.5",
      "text-sm font-medium text-foreground",
      "transition-all duration-fast",
      "hover:bg-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50"
    ),

    textBtn: cn(
      "text-sm font-semibold text-foreground-secondary transition-colors duration-fast",
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
      "rounded-md"
    ),

    errorBox: cn(
      "rounded-md border border-error/30 bg-error-light",
      "px-4 py-3 text-sm text-error"
    ),

    infoBox: cn(
      "rounded-md border border-accent/30 bg-accent-light/30",
      "px-4 py-3 text-sm text-accent-dark"
    ),
  };

  const handlePoemChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setPoem(event.target.value.slice(0, POEM_CHAR_LIMIT));
    setUserHasManuallySetFormatting(false);
  };

  const handlePoemKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handlePoemSubmit();
    }
  };

  const handlePoemSubmit = () => {
    if (!poem.text?.trim()) return;
    // Show segment editor before submitting
    setShowSegmentEditor(true);
  };

  const handleSegmentEditorConfirm = (segmentation: CustomSegmentation) => {
    // Convert Map to Record for storage
    const lineToSegmentRecord: Record<number, number> = {};
    segmentation.lineToSegment.forEach((seg, lineIdx) => {
      lineToSegmentRecord[lineIdx] = seg;
    });

    // Save custom segmentation
    setCustomSegmentation({
      lineToSegment: lineToSegmentRecord,
      totalSegments: segmentation.totalSegments,
    });

    // Close editor and submit poem
    setShowSegmentEditor(false);
    submitPoem();
  };

  const handleSegmentEditorCancel = () => {
    setShowSegmentEditor(false);
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
      // Auto-open next step (step 3: Translation Intent)
      setAccordionValue("step-3");
    } catch {
      setZoneError(t("zoneErrorSave"));
    } finally {
      setIsSavingZone(false);
    }
  };

  const handleSaveSourceVariety = async () => {
    if (!threadId) {
      setVarietyError(t("zoneErrorThread"));
      return;
    }

    const trimmed = sourceVarietyText.trim();

    setIsSavingVariety(true);

    try {
      await saveTranslationIntent.mutateAsync({
        threadId,
        questionKey: "sourceLanguageVariety",
        value: trimmed.length > 0 ? trimmed : null,
      });

      submitSourceLanguageVariety();
      // Auto-open next step (step 2: Translation Zone)
      setAccordionValue("step-2");
    } catch {
      setVarietyError(t("zoneErrorSave"));
    } finally {
      setIsSavingVariety(false);
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
      // Auto-open next step (step 4: Translation Method)
      setAccordionValue("step-4");
    } catch {
      setIntentError(t("intentErrorSave"));
    } finally {
      setIsSavingIntent(false);
    }
  };

  const handleSaveTranslationRangeMode = async (
    nextMode: "focused" | "balanced" | "adventurous"
  ) => {
    if (!threadId) return;

    setIsSavingTranslationRangeMode(true);

    try {
      await saveTranslationIntent.mutateAsync({
        threadId,
        questionKey: "translationRangeMode",
        value: nextMode,
      });
      // Auto-open next step (Step 5: Translation Model)
      setAccordionValue("step-5");
    } catch (error) {
      console.error("[handleSaveTranslationRangeMode] Error:", error);
    } finally {
      setIsSavingTranslationRangeMode(false);
    }
  };

  const handleSaveTranslationModel = async (
    nextModel: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-5" | "gpt-5-mini"
  ) => {
    if (!threadId) return;

    setIsSavingTranslationModel(true);

    try {
      await saveTranslationIntent.mutateAsync({
        threadId,
        questionKey: "translationModel",
        value: nextModel,
      });
    } catch (error) {
      console.error("[handleSaveTranslationModel] Error:", error);
    } finally {
      setIsSavingTranslationModel(false);
    }
  };

  const handleResetAll = () => {
    // If there's workshop progress, show confirmation dialog
    if (hasWorkshopProgress) {
      setShowClearConfirmation(true);
      return;
    }

    // No progress, clear immediately
    performReset();
  };

  const performReset = () => {
    reset();
    workshopReset();

    setIntentError(null);
    setZoneError(null);
    setVarietyError(null);

    setUserHasManuallySetFormatting(false);
    setShowClearConfirmation(false);
  };

  const handleStartWorkshop = () => {
    const isComplete = checkGuideComplete();

    if (!isComplete) {
      setValidationError(t("validationError"));
      return;
    }

    setValidationError(null);
    setShowConfirmDialog(true);
  };

  const handleConfirmWorkshop = async () => {
    if (!threadId) {
      setValidationError(t("validationErrorThread"));
      return;
    }

    if (!poem.text || !poem.stanzas) {
      setValidationError(t("validationErrorPoem"));
      return;
    }

    setShowConfirmDialog(false);
    setValidationError(null);

    // Trigger auto-collapse callback first to update section states
    const hasExistingWork = Object.keys(completedLines || {}).length > 0;
    if (!hasExistingWork) {
      onAutoCollapse?.();
    }

    // Unlock workshop after state updates
    unlockWorkshop();

    // Small delay to ensure state updates propagate before navigation
    // The navigation is to the same route, so it's mainly for state refresh
    setTimeout(() => {
      router.push(`/workspaces/${projectId}/threads/${threadId}`);
    }, 0);

    (async () => {
      try {
        if (!poem.stanzas) {
          console.error("Poem stanzas missing - this should not happen");
          return;
        }

        // Persist the latest guide answers (including model + method + translation range mode)
        // before background translations start, so the backend doesn't fall back to
        // env defaults (e.g. TRANSLATOR_MODEL=gpt-4o).
        await saveMultipleAnswers.mutateAsync({
          threadId,
          updates: useGuideStore.getState().answers,
        });

        await savePoemState.mutateAsync({
          threadId,
          rawPoem: poem.text,
          stanzas: poem.stanzas,
        });

        const response = await fetch("/api/workshop/initialize-translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            // runInitialTick omitted - defaults to false for fast response
            // Worker handles processing in background
          }),
          cache: "no-store", // Ensure no caching
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(
            "Failed to initialize translations:",
            errorData.error || "Unknown error"
          );
        } else {
          // Immediately invalidate translation status query to trigger refetch
          queryClient.invalidateQueries({
            queryKey: ["translation-job", threadId],
          });
        }
      } catch (error) {
        console.error(
          "Error starting background translation processing:",
          error
        );
      }
    })();
  };

  const renderSetup = () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-3 lg:h-full lg:min-h-0">
      {/* Card 1: Poem Input */}
      <section
        className={cn(
          ui.card,
          "lg:row-span-3 flex flex-col h-full min-h-0",
          !isPoemSubmitted
            ? "border-accent bg-accent-light/20 ring-2 ring-accent/30"
            : "border-border-subtle"
        )}
        aria-labelledby="poem-section-title"
      >
        <div className={ui.cardHeader}>
          <div className="min-w-0">
            <label
              id="poem-section-title"
              htmlFor="poem-input"
              className={ui.label}
            >
              {t("poemTitle")} {isPoemSubmitted && "✓"}
            </label>

            <p className={ui.helper}>{t("poemHelper")}</p>
          </div>

          <span className={ui.pill}>
            {t("characterCount", {
              current: poemCharCount,
              limit: POEM_CHAR_LIMIT,
            })}
          </span>
        </div>

        <div
          className={cn(
            ui.cardBody,
            "flex-1 min-h-0 flex flex-col overflow-hidden"
          )}
        >
          <div className="flex flex-1 min-h-0 flex-col gap-5 overflow-y-auto py-2">
            <textarea
              id="poem-input"
              ref={poemTextareaRef}
              rows={10}
              maxLength={POEM_CHAR_LIMIT}
              value={poemText}
              onChange={handlePoemChange}
              onKeyDown={handlePoemKeyDown}
              placeholder={t("poemPlaceholder")}
              aria-describedby="poem-helper poem-error"
              lang={locale}
              dir={dir}
              className={cn(
                ui.textarea,
                "flex-1 min-h-[200px] resize-none",
                !isPoemSubmitted && "focus:bg-accent-light/10"
              )}
            />

            {/* Keep element for aria-describedby, but avoid duplicating the helper visually */}
            <p id="poem-helper" className="sr-only">
              {t("poemHelper")}
            </p>

            {(poem.stanzas?.totalStanzas ?? 0) > 0 || hasBlankLinesDetected ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowGuideHints((prev) => !prev)}
                  className={cn(
                    "inline-flex items-center gap-2",
                    "text-sm font-semibold text-accent",
                    "transition-colors duration-fast hover:text-accent-dark",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    "rounded-md"
                  )}
                >
                  <Info className="h-4 w-4" aria-hidden="true" />

                  {showGuideHints
                    ? t("hideDetectionNotes")
                    : t("showDetectionNotes")}
                </button>

                {showGuideHints && (
                  <div className={cn(ui.infoBox, "space-y-3")}>
                    {poem.stanzas && poem.stanzas.totalStanzas > 0 && (
                      <p className="text-sm">
                        {t("segmentsDetected", {
                          count: poem.stanzas.totalStanzas,
                        })}
                      </p>
                    )}

                    {hasBlankLinesDetected && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm">
                          {t("blankLinesDetected")}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setUserHasManuallySetFormatting(true);
                            setPreserveFormatting(!poem.preserveFormatting);
                          }}
                          className={cn(
                            "text-sm font-semibold text-accent underline",
                            "transition-colors duration-fast hover:text-accent-dark",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                            "rounded-md"
                          )}
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

            <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={ui.subtle}>
                {!isPoemSubmitted && t("submitShortcut")}
              </div>

              <button
                id="add-poem-btn"
                type="button"
                onClick={handlePoemSubmit}
                disabled={isSubmitDisabled || isPoemSubmitted}
                className={ui.primaryBtn}
              >
                {isPoemSubmitted ? t("poemSubmitted") : t("submitPoem")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Accordion */}
      <GuideSteps
        className="lg:row-span-3 h-full min-h-0"
        stepTitles={[
          t("sourceLanguageVarietyTitle"),
          t("translationZone"),
          t("translationIntent"),
          t("translationRange"),
          t("translationModel"),
        ]}
        stepCompletions={[
          isSourceVarietySubmitted,
          isTranslationZoneSubmitted,
          isTranslationIntentSubmitted,
          !!translationRangeMode,
          !!translationModel,
        ]}
        value={accordionValue}
        onValueChange={setAccordionValue}
        onEditStep={handleEditStep}
        canEditSteps={canEditSteps}
      >
        {[
          // Step 1: Source Language Variety
          <div key="step-1" className="space-y-4">
            <div className="space-y-2">
              <p className={ui.subtle}>{t("sourceLanguageVarietyHelper")}</p>
              <p className={ui.subtleItalic}>
                {t("sourceLanguageVarietyHelperNote")}
              </p>
              <p className={ui.subtleItalic}>
                {t("sourceLanguageVarietyExamples")}
              </p>
            </div>

            <input
              id="source-language-variety-input"
              value={sourceVarietyText}
              onChange={(e) => {
                setSourceLanguageVariety(e.target.value);
                setVarietyError(null);
              }}
              disabled={!canEditVariety || isSourceVarietySubmitted}
              placeholder={t("sourceLanguageVarietyPlaceholder")}
              className={ui.input}
              dir={dir}
              lang={locale}
            />

            {varietyError && (
              <p className="text-sm text-error">{varietyError}</p>
            )}

            {canEditVariety && !isSourceVarietySubmitted && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSourceLanguageVariety("");
                    void handleSaveSourceVariety();
                  }}
                  disabled={!threadId || isSavingVariety}
                  className={cn(ui.textBtn, "text-left")}
                >
                  {t("skipStandardVariety")}
                </button>

                <button
                  type="button"
                  onClick={handleSaveSourceVariety}
                  disabled={!threadId || isSavingVariety}
                  className={ui.primaryBtn}
                >
                  {isSavingVariety ? t("saving") : "Save"}
                </button>
              </div>
            )}
          </div>,

          // Step 2: Translation Zone
          <div key="step-2" className="space-y-4">
            <div className="space-y-2">
              <p className={ui.subtle}>{t("translationZoneHelper")}</p>
              <p className={ui.subtleItalic}>{t("translationZoneHelperNote")}</p>
              <p className={ui.subtleItalic}>{t("translationZoneExamples")}</p>
            </div>

            <textarea
              id="translation-zone-input"
              rows={4}
              value={translationZoneText}
              onChange={(e) => {
                const val = e.target.value;
                setTranslationZone(val);
                setZoneError(null);
                // DEBOUNCED AUTO-SAVE: persist to backend after 800ms idle
                debouncedSaveZone(val);
              }}
              onBlur={() => {
                // FLUSH on blur: ensure backend has latest value before user leaves field
                void flushPendingSaves();
              }}
              disabled={
                !canEditZone || (isTranslationZoneSubmitted && !editingZone)
              }
              placeholder={t("translationZonePlaceholder")}
              lang={locale}
              dir={dir}
              className={cn(ui.textarea, "resize-y")}
            />

            {zoneError && <p className="text-sm text-error">{zoneError}</p>}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveZone}
                disabled={
                  !canEditZone || !translationZoneText.trim() || isSavingZone
                }
                className={ui.primaryBtn}
              >
                {isSavingZone
                  ? t("saving")
                  : editingZone
                  ? t("updateZone")
                  : t("saveZone")}
              </button>
            </div>
          </div>,

          // Step 3: Translation Intent
          <div key="step-3" className="space-y-4">
            <div className="space-y-2">
              <p className={ui.subtle}>{t("translationIntentHelper")}</p>
              <p className={ui.subtleItalic}>
                {t("translationIntentExamples")}
              </p>
            </div>

            <textarea
              id="translation-intent-input"
              rows={4}
              value={translationIntentText}
              onChange={(e) => {
                const val = e.target.value;
                setTranslationIntent(val);
                setIntentError(null);
                // DEBOUNCED AUTO-SAVE: persist to backend after 800ms idle
                debouncedSaveIntent(val);
              }}
              onBlur={() => {
                // FLUSH on blur: ensure backend has latest value before user leaves field
                void flushPendingSaves();
              }}
              disabled={
                !canEditIntent ||
                (isTranslationIntentSubmitted && !editingIntent)
              }
              placeholder={t("translationIntentPlaceholder")}
              lang={locale}
              dir={dir}
              className={cn(ui.textarea, "resize-y")}
            />

            {intentError && (
              <p className="text-sm text-error">{intentError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveIntent}
                disabled={
                  !canEditIntent ||
                  !translationIntentText.trim() ||
                  isSavingIntent
                }
                className={ui.primaryBtn}
              >
                {isSavingIntent
                  ? t("saving")
                  : editingIntent
                  ? t("updateIntent")
                  : t("saveIntent")}
              </button>
            </div>
          </div>,

          // Step 4: Translation Range
          <div key="step-4" className="space-y-4">
            <p className={ui.subtle}>{t("translationRangeHelper")}</p>

            <div className="flex flex-col gap-2 sm:flex-row">
              {(["focused", "balanced", "adventurous"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setTranslationRangeMode(mode);
                    void handleSaveTranslationRangeMode(mode);
                  }}
                  disabled={isSavingTranslationRangeMode}
                  className={cn(
                    "flex-1 rounded-md px-4 py-2.5 text-sm font-semibold",
                    "transition-all duration-fast",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    translationRangeMode === mode
                      ? "bg-accent text-white"
                      : "bg-muted text-foreground hover:bg-border-subtle",
                    isSavingTranslationRangeMode && "opacity-70"
                  )}
                  aria-pressed={translationRangeMode === mode}
                >
                  {t(`translationMode.${mode}`)}
                </button>
              ))}
            </div>

            {!translationRangeMode && (
              <p className="text-sm text-error">
                {t("translationRangeRequired", {
                  defaultValue: "Please select a translation range to continue",
                })}
              </p>
            )}

            {isSavingTranslationRangeMode && <p className={ui.subtle}>Saving…</p>}
          </div>,

          // Step 5: Translation Model
          <div key="step-5" className="space-y-4">
            <p className="text-sm text-foreground-secondary leading-relaxed">
              {t("translationModelHelper")}
            </p>

            <div className="flex flex-col gap-2">
              {(
                [
                  "gpt-4o",
                  "gpt-4o-mini",
                  "gpt-4-turbo",
                  "gpt-5",
                  "gpt-5-mini",
                ] as const
              ).map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => {
                    setTranslationModel(model);
                    void handleSaveTranslationModel(model);
                  }}
                  disabled={isSavingTranslationModel}
                  className={cn(
                    "rounded-md px-4 py-3 text-left",
                    "transition-all duration-fast",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    translationModel === model
                      ? "bg-accent text-white"
                      : "bg-muted text-foreground hover:bg-border-subtle",
                    isSavingTranslationModel && "opacity-70"
                  )}
                  aria-pressed={translationModel === model}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{model}</span>

                    {model === "gpt-4o" && (
                      <span className="text-xs opacity-80">
                        (default)
                      </span>
                    )}
                    {model === "gpt-4o-mini" && (
                      <span className="text-xs opacity-80">
                        (quicker)
                      </span>
                    )}
                    {model === "gpt-4-turbo" && (
                      <span className="text-xs opacity-80">
                        (may give better results)
                      </span>
                    )}
                    {model === "gpt-5" && (
                      <span className="text-xs opacity-80">
                        (thinks for longer - may be very slow)
                      </span>
                    )}
                    {model === "gpt-5-mini" && (
                      <span className="text-xs opacity-80">(quicker GPT-5)</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>,
        ]}
      </GuideSteps>
    </div>
  );

  try {
    return (
      <aside
        id="panel-guide"
        data-panel="guide"
        className={cn(ui.panel, className)}
      >
        <div id="context-panel" className="flex h-full flex-col">
          {showHeading && (
            <div className={ui.panelHeader}>
              <div className="min-w-0 flex-1">
                <h2 className={ui.panelTitle}>{t("title")}</h2>
                <p className={ui.panelSubtitle}>{t("subtitle")}</p>
              </div>

              <button
                type="button"
                onClick={onCollapseToggle}
                className={ui.iconButton}
                title={tThread("collapseGuidePanel")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          )}

          <div id="guide-scroll-region" className={ui.scrollRegion}>
            {renderSetup()}
          </div>

          <div className={ui.footer}>
            {validationError && (
              <div className="mb-4">
                <div className={ui.errorBox}>{validationError}</div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                id="clear-guide-btn"
                type="button"
                onClick={handleResetAll}
                className={cn(
                  "w-full rounded-md px-4 py-2.5 text-sm font-semibold",
                  "text-foreground-secondary transition-all duration-fast",
                  "hover:bg-muted hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  "sm:w-auto"
                )}
              >
                {t("clearInputs")}
              </button>

              <button
                id="start-workshop-btn"
                type="button"
                onClick={handleStartWorkshop}
                disabled={!isGuideCompleteUI}
                className={cn(ui.blueBtn, "w-full sm:w-auto")}
              >
                {t("startWorkshop")}
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

          {/* Clear Inputs Confirmation Dialog */}
          <ConfirmationDialog
            open={showClearConfirmation}
            onOpenChange={setShowClearConfirmation}
            onConfirm={performReset}
            isLoading={false}
            title="Clear All Inputs?"
            description="Warning: This will clear all your progress in both the 'Let's Get Started' section and the Workshop area. All completed translations, drafts, and line translations will be lost. This action cannot be undone."
            confirmText="Yes, Clear Everything"
            cancelText="Cancel"
          />

          {/* Segment Editor */}
          {showSegmentEditor && (
            <SegmentEditor
              poemLines={poemLines}
              initialSegmentation={initialSegmentation}
              onConfirm={handleSegmentEditorConfirm}
              onCancel={handleSegmentEditorCancel}
            />
          )}
        </div>
      </aside>
    );
  } catch (error) {
    return (
      <div
        className={cn("h-full p-6 bg-error-light border border-error/30 rounded-lg", className)}
      >
        <h1 className="text-xl font-bold text-error">Error in GuideRail</h1>
        <pre className="mt-3 text-xs text-error/80">{String(error)}</pre>
      </div>
    );
  }
}
