export function assertOnline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const err: Error & { offline: boolean } = new Error(
      "You’re offline — try again when back online."
    );
    err.offline = true;
    throw err;
  }
}
