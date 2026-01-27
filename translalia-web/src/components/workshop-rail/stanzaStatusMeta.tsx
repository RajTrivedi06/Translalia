import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PauseCircle,
} from "lucide-react";
import type { TranslationStanzaStatus } from "@/types/translationJob";

interface StatusMeta {
  label: string;
  badgeClass: string;
  dotClass: string;
  icon: LucideIcon;
}

export const STANZA_STATUS_META: Record<TranslationStanzaStatus, StatusMeta> = {
  pending: {
    label: "Pending",
    badgeClass: "bg-muted text-foreground-secondary border border-border-subtle",
    dotClass: "bg-foreground-muted",
    icon: PauseCircle,
  },
  queued: {
    label: "Queued",
    badgeClass: "bg-muted text-foreground-secondary border border-border-subtle",
    dotClass: "bg-foreground-muted",
    icon: Clock3,
  },
  processing: {
    label: "Processing",
    badgeClass: "bg-warning-light text-warning border border-warning/30",
    dotClass: "bg-warning",
    icon: Loader2,
  },
  completed: {
    label: "Ready",
    badgeClass: "bg-success-light text-success border border-success/30",
    dotClass: "bg-success",
    icon: CheckCircle2,
  },
  failed: {
    label: "Needs Attention",
    badgeClass: "bg-error-light text-error border border-error/30",
    dotClass: "bg-error",
    icon: AlertTriangle,
  },
};

export function getStatusMeta(
  status: TranslationStanzaStatus | undefined
): StatusMeta {
  return status ? STANZA_STATUS_META[status] : STANZA_STATUS_META.pending;
}
