"use client";
import * as React from "react";
import { ChatTimeline } from "./ChatTimeline";
import { ChatComposer } from "./ChatComposer";

/** UI-only chat, sized for the main workspace pane. */
export function ChatView() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      {/* timeline */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8"
      >
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <ChatTimeline />
        </div>
      </div>

      {/* composer */}
      <div className="w-full border-t border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-3xl p-4">
          <ChatComposer />
        </div>
      </div>
    </div>
  );
}