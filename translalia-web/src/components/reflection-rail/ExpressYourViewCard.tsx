"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  PenLine,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThreadNotesEditor } from "@/components/notebook/ThreadNotesEditor";
import { useDebouncedExpressYourViewSave } from "@/lib/hooks/useDebouncedExpressYourViewSave";

interface ExpressYourViewCardProps {
  threadId: string | null;
}

const MAX_LENGTH = 5000;

export function ExpressYourViewCard({ threadId }: ExpressYourViewCardProps) {
  const t = useTranslations("Thread");
  const [open, setOpen] = React.useState(true);
  const { value, onChange, saveStatus } =
    useDebouncedExpressYourViewSave(threadId);

  return (
    <Card className="p-4 border-card-amber-border bg-card-amber-bg/30">
      <div className="space-y-3">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between"
          aria-expanded={open}
          aria-controls="express-your-view-content"
        >
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">
              {t("expressYourViewTitle")}
            </h3>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-accent" />
          ) : (
            <ChevronDown className="h-4 w-4 text-accent" />
          )}
        </button>

        {open && (
          <div id="express-your-view-content" className="space-y-3">
            <p className="text-sm text-foreground-muted">
              {t("expressYourViewDescription")}
            </p>

            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
              <li>{t("expressYourViewQuestion1")}</li>
              <li>{t("expressYourViewQuestion2")}</li>
            </ul>

            <ThreadNotesEditor
              value={value}
              onChange={onChange}
              placeholder={t("expressYourViewPlaceholder")}
              maxLength={MAX_LENGTH}
            />

            <div className="flex h-4 items-center justify-end text-xs text-foreground-muted">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("expressYourViewSaving")}
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-success">
                  <Check className="h-3 w-3" />
                  {t("expressYourViewSaved")}
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-error">
                  {t("expressYourViewSaveError")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
