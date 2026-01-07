import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

async function loadMessages(locale: string): Promise<Messages> {
  try {
    // Dynamic import with proper path resolution
    let messages;

    switch (locale) {
      case "en":
        messages = (await import("../../messages/en.json")).default;
        break;
      case "es":
        messages = (await import("../../messages/es.json")).default;
        break;
      case "es-AR":
        messages = (await import("../../messages/es-AR.json")).default;
        break;
      case "hi":
        messages = (await import("../../messages/hi.json")).default;
        break;
      case "ar":
        messages = (await import("../../messages/ar.json")).default;
        break;
      case "zh":
        messages = (await import("../../messages/zh.json")).default;
        break;
      case "ta":
        messages = (await import("../../messages/ta.json")).default;
        break;
      case "te":
        messages = (await import("../../messages/te.json")).default;
        break;
      case "ml":
        messages = (await import("../../messages/ml.json")).default;
        break;
      default:
        messages = (await import("../../messages/en.json")).default;
    }

    console.log(`[i18n] Successfully loaded messages for locale "${locale}"`, {
      keysCount: Object.keys(messages || {}).length,
      topLevelKeys: Object.keys(messages || {}),
    });

    return messages as Messages;
  } catch (error) {
    console.error(`[i18n] Failed to import messages for locale "${locale}":`, error);
    throw error;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  try {
    const messages = await loadMessages(locale);

    // Ensure messages is an object and not empty
    if (
      !messages ||
      typeof messages !== "object" ||
      Object.keys(messages).length === 0
    ) {
      console.error(
        `[i18n] Messages file for locale "${locale}" is empty or invalid`
      );
      const fallbackMessages = await loadMessages(routing.defaultLocale);
      return {
        locale: routing.defaultLocale,
        messages: fallbackMessages,
      };
    }

    return {
      locale,
      messages,
    };
  } catch (error) {
    console.error(
      `[i18n] Failed to load messages for locale "${locale}":`,
      error
    );
    // Fallback to English messages
    const fallbackMessages = await loadMessages(routing.defaultLocale);
    return {
      locale: routing.defaultLocale,
      messages: fallbackMessages,
    };
  }
});
