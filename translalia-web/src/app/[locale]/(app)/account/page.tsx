"use client";

import { ProfileForm } from "@/components/account/ProfileForm";
import { useTranslations } from "next-intl";

export default function AccountPage() {
  const t = useTranslations("Account");

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-sm text-neutral-600">
        {t("description")}
      </p>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <ProfileForm />
      </div>
    </div>
  );
}
