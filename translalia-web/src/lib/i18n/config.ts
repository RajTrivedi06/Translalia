// src/lib/i18n/config.ts
export function getDefaultUiLang() {
  return process.env.NEXT_PUBLIC_UI_LANG_DEFAULT ?? "en";
}
