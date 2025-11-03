export function isEnhancerEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_ENHANCER === "1";
}
export function isTranslatorEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR === "1";
}
export function isSidebarLayoutEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT === "1";
}
export function inProd() {
  return process.env.NODE_ENV === "production";
}
export function inDev() {
  return process.env.NODE_ENV !== "production";
}
