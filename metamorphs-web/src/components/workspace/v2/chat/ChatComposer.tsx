"use client";
import * as React from "react";
import { Paperclip, Send } from "lucide-react";

/** Sticky-bottom composer (UI only). */
export function ChatComposer() {
  const [val, setVal] = React.useState("");
  return (
    <div className="relative">
      <label htmlFor="chat-input" className="sr-only">Type your message</label>
      <textarea
        id="chat-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Type your message..."
        className="h-12 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 pr-28 outline-none transition focus:border-gray-500"
      />
      <div className="absolute right-2 top-2 flex items-center gap-2">
        <button type="button" className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100" aria-label="Attach a file">
          <Paperclip className="h-5 w-5" />
        </button>
        <button type="button" className="rounded-lg bg-gray-700 p-2 text-white transition hover:bg-gray-800" aria-label="Send message">
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}