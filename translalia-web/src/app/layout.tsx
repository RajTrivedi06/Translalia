import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Translalia",
  description:
    "A decolonial, AI-assisted creative poetry translation workspace.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The locale-specific layout under /app/[locale]/layout.tsx renders the HTML scaffold.
  return <>{children}</>;
}
