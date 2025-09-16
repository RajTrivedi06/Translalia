export const flags = {
  // Client-safe: evaluated at build time
  showForceTranslate:
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SHOW_FORCE_TRANSLATE === "true",
} as const;
