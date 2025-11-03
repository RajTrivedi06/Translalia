"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());
  React.useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event, session }),
        }).catch(() => {});
      }
    );
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
