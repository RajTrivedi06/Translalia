"use client";
import { useState } from "react";
export default function ChatComposer({ onAttach }: { onAttach?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-2" aria-label="Chat composer">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a message…"
        className="w-full rounded-xl border p-3 resize-y min-h-[88px]"
        aria-label="Message text"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-xl border px-3 py-1"
          onClick={onAttach}
          aria-label="Attach file"
        >
          📎 Attach
        </button>
        <button
          type="button"
          className="rounded-xl bg-black text-white px-4 py-1 disabled:opacity-50"
          disabled
        >
          Send
        </button>
      </div>
    </div>
  );
}
