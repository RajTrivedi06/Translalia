"use client";
import { useState } from "react";

interface ChatComposerProps {
  onSendMessage?: (message: string) => void;
  onFileUpload?: (content: string, fileName: string) => void;
  onAttach?: () => void;
}

export default function ChatComposer({
  onSendMessage,
  onFileUpload,
  onAttach,
}: ChatComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() && onSendMessage) {
      console.log("🚀 ChatComposer: Sending message:", value);
      onSendMessage(value);
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2" aria-label="Chat composer">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
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
          disabled={!value.trim()}
          onClick={handleSubmit}
        >
          Send
        </button>
      </div>
    </div>
  );
}
