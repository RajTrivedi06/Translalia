/**
 * @deprecated This file is DEPRECATED and should not be used.
 *
 * Use next-intl for all i18n functionality:
 * - For translations: useTranslations("Namespace") in client components
 * - For routing: Link, useRouter, usePathname from "@/i18n/routing"
 * - For locale detection: useLocale() from "next-intl"
 *
 * Messages are stored in /messages/*.json files.
 * See src/i18n/routing.ts for the canonical i18n configuration.
 */
export function getDefaultUiLang() {
  return process.env.NEXT_PUBLIC_UI_LANG_DEFAULT ?? "en";
}
