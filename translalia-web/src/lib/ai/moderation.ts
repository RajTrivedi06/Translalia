import { getOpenAI } from "./openai";

type ModerationResultSubset = {
  flagged?: boolean;
  categories?: Record<string, unknown>;
};

export async function moderateText(text: string) {
  const client = getOpenAI();
  const res = await client.moderations.create({
    model: "omni-moderation-latest",
    input: text.slice(0, 20000),
  });
  const results = (res as unknown as { results?: ModerationResultSubset[] })
    .results;
  const first = Array.isArray(results) ? results[0] : undefined;
  const flagged = !!first?.flagged;
  const categories: Record<string, unknown> = first?.categories ?? {};
  return { flagged, categories };
}
