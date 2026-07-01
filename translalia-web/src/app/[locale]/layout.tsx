import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Providers } from "@/components/providers";
import { AuthNav } from "@/components/auth/AuthNav";
import { routing } from "@/i18n/routing";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { TranslaliaLogo } from "@/components/brand/TranslaliaLogo";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client
  // Explicitly pass locale to ensure messages are loaded correctly
  const messages = await getMessages();

  // Determine direction
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <div
              suppressHydrationWarning
              className="locale-wrapper min-h-screen bg-base text-foreground"
            >
              <header className="sticky top-0 z-40 h-[var(--header-h)] border-b border-border-subtle bg-surface/80 backdrop-blur">
                <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-4 py-2">
                  <Link
                    href="/"
                    aria-label="Translalia home"
                    className={cn(
                      "group inline-flex items-center rounded-sm outline-none",
                      "transition-opacity duration-300 ease-out",
                      "hover:opacity-80",
                      "focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    )}
                  >
                    <TranslaliaLogo size="sm" />
                  </Link>
                  <div className="flex items-center gap-3">
                    <AuthNav />
                  </div>
                </div>
              </header>
              <main className="min-h-[calc(100vh-var(--header-h))]">
                {children}
              </main>
            </div>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
