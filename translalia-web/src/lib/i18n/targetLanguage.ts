export type TLInfo = {
  target: string;
  dialect?: string;
  translanguaging?: boolean;
};

export function extractTL(fields: Record<string, unknown> | undefined): TLInfo {
  const f = fields || {};
  const pick = (...keys: string[]) =>
    keys
      .map((k) => (f as Record<string, unknown>)[k])
      .find((v) => typeof v === "string" && (v as string).trim());

  const target =
    (pick(
      "TARGET_LANGUAGE",
      "target_language",
      "LANGUAGE",
      "language",
      "Target Language"
    ) as string | undefined) ||
    "English (diaspora; keep marked words verbatim)";

  const dialect = pick(
    "DIALECT",
    "dialect",
    "Target Dialect",
    "target_dialect"
  ) as string | undefined;

  const translanguaging = String(
    (f as Record<string, unknown>)["TRANSLANGUAGING"] ??
      (f as Record<string, unknown>)["translanguaging"] ??
      ""
  )
    .toLowerCase()
    .startsWith("y");

  return { target, dialect, translanguaging };
}
