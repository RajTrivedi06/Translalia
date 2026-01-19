/**
 * Returns the correct token limit parameter based on model.
 * - GPT-5 models use `max_completion_tokens`
 * - GPT-4 and earlier use `max_tokens`
 */
export function getTokenLimitParam(
  model: string,
  maxTokens: number
): { max_tokens?: number; max_completion_tokens?: number } {
  const isGpt5 = model.startsWith("gpt-5");
  
  return isGpt5
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
}
