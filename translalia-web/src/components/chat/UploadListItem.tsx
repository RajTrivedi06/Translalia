"use client";

import { useState } from "react";
import { useUploadToSupabase } from "../../hooks/useUploadToSupabase";
import { toastError } from "@/lib/ui/toast";
import type { UploadItem, UploadStatus } from "@/state/uploads";

function Badge({ status }: { status: UploadStatus }) {
  const map: Record<UploadStatus, string> = {
    queued: "bg-yellow-50 text-yellow-800 border-yellow-200",
    uploading: "bg-blue-50 text-blue-800 border-blue-200",
    done: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };
  const label: Record<UploadStatus, string> = {
    queued: "Queued",
    uploading: "Uploading",
    done: "Ready",
    error: "Error",
  };
  return (
    <span className={`text-[10px] rounded px-2 py-0.5 border ${map[status]}`}>
      {label[status]}
    </span>
  );
}

export default function UploadListItem({
  it,
  onRemove,
  onDeleted,
}: {
  it: UploadItem;
  onRemove: () => void; // local remove
  onDeleted: () => void; // after server delete succeeds
}) {
  const { signPath, deletePath } = useUploadToSupabase();
  const [busy, setBusy] = useState<null | "sign" | "delete">(null);
  const kb = Math.max(1, Math.round(it.size / 1024));
  const disabled = !it.path || it.status !== "done" || busy !== null;

  return (
    <li className="flex items-center justify-between rounded-lg border px-3 py-1">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate">{it.name}</span>
          <Badge status={it.status} />
        </div>
        <div className="text-xs opacity-70">{kb} KB</div>
        {it.status === "error" && it.error && (
          <div className="text-xs text-red-600 mt-0.5">{it.error}</div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="text-xs underline disabled:opacity-50"
          disabled={disabled}
          onClick={async () => {
            if (!it.path) return;
            try {
              setBusy("sign");
              const { url } = await signPath(it.path);
              window.open(url, "_blank");
            } finally {
              setBusy(null);
            }
          }}
        >
          Get link
        </button>

        <button
          className="text-xs underline text-red-600 disabled:opacity-50"
          disabled={!it.path || busy !== null}
          onClick={async () => {
            if (!it.path) return;
            try {
              setBusy("delete");
              await deletePath(it.path);
              onDeleted();
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Delete failed";
              toastError(msg);
            } finally {
              setBusy(null);
            }
          }}
        >
          Delete
        </button>

        <button className="text-xs underline opacity-80" onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}
