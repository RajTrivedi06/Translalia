/**
 * source_language_variety is free text typed by translators ("Español
 * rioplatense", "literary italian from about 1900", "19th-century italian
 * philosophical lyric"). Counting distinct strings would report hundreds of
 * "languages". This maps each value to a language name by keyword; anything
 * unmatched is bucketed as "Other" and shown as such rather than hidden.
 */
const LANGUAGE_KEYWORDS: Array<[name: string, pattern: RegExp]> = [
  ["English", /\benglish\b|\binglés\b/],
  ["Spanish", /\bspanish\b|\bespañol\b|\bespanol\b|\bcastellano\b|\bcastilian\b/],
  ["Italian", /\bitalian\b|\bitaliano\b/],
  ["Portuguese", /\bportuguese\b|\bportuguês\b|\bportugues\b/],
  ["French", /\bfrench\b|\bfrançais\b|\bfrancais\b/],
  ["German", /\bgerman\b|\bdeutsch\b/],
  ["Hindi", /\bhindi\b|\bhindustani\b/],
  ["Urdu", /\burdu\b/],
  ["Bengali", /\bbengali\b|\bbangla\b/],
  ["Tamil", /\btamil\b/],
  ["Telugu", /\btelugu\b/],
  ["Malayalam", /\bmalayalam\b/],
  ["Kannada", /\bkannada\b/],
  ["Marathi", /\bmarathi\b/],
  ["Gujarati", /\bgujarati\b/],
  ["Punjabi", /\bpunjabi\b|\bpanjabi\b/],
  ["Sanskrit", /\bsanskrit\b/],
  ["Japanese", /\bjapanese\b|\b日本語\b/],
  ["Chinese", /\bchinese\b|\bmandarin\b|\bcantonese\b|中文|汉语|漢語/],
  ["Korean", /\bkorean\b/],
  ["Arabic", /\barabic\b|\bعربي\b/],
  ["Hebrew", /\bhebrew\b/],
  ["Persian", /\bpersian\b|\bfarsi\b/],
  ["Turkish", /\bturkish\b|\btürkçe\b/],
  ["Greek", /\bgreek\b/],
  ["Latin", /\blatin\b/],
  ["Russian", /\brussian\b/],
  ["Ukrainian", /\bukrainian\b/],
  ["Polish", /\bpolish\b/],
  ["Czech", /\bczech\b/],
  ["Hungarian", /\bhungarian\b/],
  ["Romanian", /\bromanian\b/],
  ["Dutch", /\bdutch\b/],
  ["Swedish", /\bswedish\b/],
  ["Danish", /\bdanish\b/],
  ["Norwegian", /\bnorwegian\b/],
  ["Finnish", /\bfinnish\b/],
  ["Catalan", /\bcatalan\b|\bcatalà\b/],
  ["Galician", /\bgalician\b|\bgalego\b/],
  ["Basque", /\bbasque\b|\beuskara\b/],
  ["Irish", /\birish\b|\bgaelic\b/],
  ["Welsh", /\bwelsh\b/],
  ["Vietnamese", /\bvietnamese\b/],
  ["Thai", /\bthai\b/],
  ["Indonesian", /\bindonesian\b|\bbahasa\b/],
  ["Filipino", /\bfilipino\b|\btagalog\b/],
  ["Swahili", /\bswahili\b/],
  ["Yoruba", /\byor[uù]b[aá]\b/],
  ["Zulu", /\bzulu\b|\bisizulu\b/],
  ["Haitian Creole", /\bhaitian\b|\bkreyòl\b|\bkreyol\b/],
  ["Scots", /\bscots\b/],
  ["Maithili", /\bmaithili\b|\bmaithli\b/],
  ["Bhojpuri", /\bbhojpuri\b/],
  ["Friulian", /\bfriulian\b|\bfriuli\b/],
  ["Nahuatl", /\bnahuatl\b/],
  ["Quechua", /\bquechua\b/],
  ["Guaraní", /\bguaran[ií]\b/],
];

export const OTHER = "Other";

export function languageNameFor(freeText: string): string {
  const text = freeText.toLowerCase();
  for (const [name, pattern] of LANGUAGE_KEYWORDS) {
    if (pattern.test(text)) return name;
  }
  return OTHER;
}

export interface LanguageCount {
  name: string;
  poems: number;
}

/** Poems per language, top N by count, the rest folded into "Other". */
export function aggregateLanguages(
  rows: Array<{ source: string; poems_finished: number; poems_started: number }>,
  metric: "poems_finished" | "poems_started",
  top = 10
): { languages: LanguageCount[]; distinct: number } {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = languageNameFor(row.source);
    totals.set(name, (totals.get(name) ?? 0) + row[metric]);
  }
  const named = [...totals.entries()]
    .filter(([name, poems]) => name !== OTHER && poems > 0)
    .sort((a, b) => b[1] - a[1]);
  const other = totals.get(OTHER) ?? 0;
  const head = named.slice(0, top).map(([name, poems]) => ({ name, poems }));
  const tailSum = named.slice(top).reduce((sum, [, poems]) => sum + poems, 0) + other;
  const languages = tailSum > 0 ? [...head, { name: OTHER, poems: tailSum }] : head;
  return { languages, distinct: named.length };
}
