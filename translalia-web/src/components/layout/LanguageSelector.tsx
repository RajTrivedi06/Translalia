"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  SUPPORTED_LANGUAGES,
  getLangFromCookie,
  setLangCookie,
} from "@/lib/i18n/minimal";
import { useRouter } from "next/navigation";

export function LanguageSelector() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    setLanguage(getLangFromCookie());
  }, []);

  const handleChange = (newLang: string) => {
    setLanguage(newLang);
    setLangCookie(newLang);
    router.refresh(); // Reload to apply new lang and dir
  };

  return (
    <Select value={language} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
