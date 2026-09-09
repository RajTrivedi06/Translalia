const numberFormat = new Intl.NumberFormat("en-GB");

export function n(value: number): string {
  return numberFormat.format(value);
}

/** Whole-number percent. Callers decide whether a percent is appropriate at all. */
export function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

/** "7 of 9 lines" under 20 items, "34%" above, per the small-n rule. */
export function ratio(numerator: number, denominator: number, noun: string): string {
  if (denominator < 20) return `${n(numerator)} of ${n(denominator)} ${noun}`;
  return pct(numerator, denominator);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatWeek(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    new Date(`${isoDate}T00:00:00Z`)
  );
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, "hour")} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} ${plural(days, "day")} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
