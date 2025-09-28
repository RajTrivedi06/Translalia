import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import MainNav from "@/components/nav/MainNav";
import { AuthNav } from "@/components/auth/AuthNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Metamorphs",
  description:
    "A decolonial, AI-assisted creative poetry translation workspace.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <header className="sticky top-0 z-40 h-[var(--header-h)] border-b bg-white/70 backdrop-blur">
            <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-4">
              <div className="text-sm font-semibold">Metamorphs</div>
              <AuthNav />
            </div>
          </header>
          <MainNav />
          {/* Default: allow pages to size naturally; workspace routes add their own wrapper */}
          <main className="min-h-[calc(100vh-var(--header-h))]">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
