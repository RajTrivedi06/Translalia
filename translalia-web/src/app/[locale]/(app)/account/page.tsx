"use client";

import { ProfileForm } from "@/components/account/ProfileForm";
import { useTranslations } from "next-intl";
import { User } from "lucide-react";

export default function AccountPage() {
  const t = useTranslations("Account");

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-stone-50 via-stone-50 to-orange-50/30">
      {/* Hero header — matching diary page pattern */}
      <header className="relative overflow-hidden border-b border-stone-200/60 bg-white/60 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl px-6 py-12 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                {t("title")}
              </p>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl">
                {t("description")}
              </h1>
            </div>
            <User className="hidden h-10 w-10 text-stone-300 sm:block" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <div className="rounded-2xl bg-white/80 p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 backdrop-blur-sm sm:p-10">
          <ProfileForm />
        </div>
      </main>

      {/* Footer accent gradient */}
      <div className="h-24 bg-gradient-to-t from-orange-50/40 to-transparent" />
    </div>
  );
}
