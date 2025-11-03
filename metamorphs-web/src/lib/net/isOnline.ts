export function assertOnline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const e = new Error("You’re offline — try again when back online.");
    (e as Error & { offline?: boolean }).offline = true;
    throw e;
  }
}
