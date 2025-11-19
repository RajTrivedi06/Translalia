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
    badgeClass: "bg-gray-100 text-gray-700 border border-gray-200",
    dotClass: "bg-gray-400",
    icon: PauseCircle,
  },
  queued: {
    label: "Queued",
    badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
    dotClass: "bg-slate-400",
    icon: Clock3,
  },
  processing: {
    label: "Processing",
    badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    dotClass: "bg-amber-500",
    icon: Loader2,
  },
  completed: {
    label: "Ready",
    badgeClass: "bg-green-50 text-green-700 border border-green-200",
    dotClass: "bg-green-500",
    icon: CheckCircle2,
  },
  failed: {
    label: "Needs Attention",
    badgeClass: "bg-red-50 text-red-700 border border-red-200",
    dotClass: "bg-red-500",
    icon: AlertTriangle,
  },
};

export function getStatusMeta(
  status: TranslationStanzaStatus | undefined
): StatusMeta {
  return status ? STANZA_STATUS_META[status] : STANZA_STATUS_META.pending;
}
