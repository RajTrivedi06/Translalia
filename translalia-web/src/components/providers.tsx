"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());

  React.useEffect(() => {
    // Wrap in try-catch for safety
    try {
      const { data: listener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          try {
            // Sync auth state with server
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
              await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ event, session }),
              });
            }
          } catch (error) {
            console.error("[Providers] Auth sync error:", error);
            // Don't throw - just log
          }
        }
      );

      return () => {
        listener?.subscription.unsubscribe();
      };
    } catch (error) {
      console.error("[Providers] Auth setup error:", error);
      // Return empty cleanup function
      return () => {};
    }
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
