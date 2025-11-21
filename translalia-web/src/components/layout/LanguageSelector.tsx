"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useProfile } from "@/hooks/useProfile";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const LOCALES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "hi", name: "हिन्दी" },
  { code: "ar", name: "العربية" },
  { code: "zh", name: "中文" },
] as const;

export function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSupabaseUser();
  const { profile } = useProfile(user);

  // Sync locale with user profile on mount
  useEffect(() => {
    if (profile?.locale && profile.locale !== locale) {
      // Redirect to the same pathname with the profile locale
      router.replace(pathname, { locale: profile.locale as any });
    }
  }, [profile?.locale, locale, router, pathname]);

  const handleChange = (newLocale: string) => {
    // Use next-intl's router to navigate to the same pathname with new locale
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
