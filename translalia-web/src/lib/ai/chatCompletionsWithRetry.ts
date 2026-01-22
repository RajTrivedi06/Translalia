/**
 * ISS-012: Safe Chat Completions Call with Retry-on-Unsupported-Param
 * 
 * Wraps OpenAI chat.completions.create with automatic retry if unsupported
 * parameters are detected. This ensures tuning never bricks the pipeline.
 */

import OpenAI from "openai";
import {
  isUnsupportedParamError,
  extractRejectedParam,
  type SamplingParams,
} from "./buildSamplingParams";
import {
  buildStopSequences,
  isLikelyTruncationError,
  type ResponseFormatType,
} from "./buildStopSequences";

type ChatCompletionCreateParams = Parameters<
  OpenAI["chat"]["completions"]["create"]
>[0];

// Extract non-streaming ChatCompletion type
type ChatCompletion = Extract<
  Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>,
  { choices: unknown[] }
>;

/**
 * Call chat.completions.create with automatic retry on unsupported parameter errors
 * and parse-failure fallback for stop sequence truncation.
 * 
 * Strategy:
 * 1. Attempt request with provided params (including sampling params and stop sequences)
 * 2. If OpenAI throws an error that looks like "unsupported parameter":
 *    - Log which param was rejected
 *    - Retry immediately with sampling params removed
 * 3. If error is not param-related, do not mask it (rethrow)
 * 
 * ISS-013: Parse-failure fallback:
 * - If JSON parsing fails and error suggests truncation (likely from stop sequences):
 *    - Log parse failure with stop sequences
 *    - Retry the SAME request once with stop sequences removed
 *    - If retry also fails, surface the error normally
 * 
 * ISS-017: OpenAI call tracking:
 * - Increments openaiCalls counters if instrumentation provided
 * - Tracks duration and token usage
 * 
 * ISS-018: Raw output logging:
 * - Logs raw JSON output (truncated) when DEBUG_MAIN_GEN_OUTPUT or DEBUG_REGEN_OUTPUT enabled
 * 
 * @param openai - OpenAI client instance
 * @param params - Chat completion parameters
 * @param parseCallback - Optional callback to parse the response (for fallback retry)
 * @param instrumentation - Optional instrumentation object for tracking calls
 * @param callKind - Kind of call ("mainGen" | "regen" | "recipe") for tracking
 * @param metadata - Optional metadata for logging (threadId, lineIndex, stanzaIndex)
 * @returns Chat completion result
 */
export async function chatCompletionsWithRetry(
  openai: OpenAI,
  params: ChatCompletionCreateParams,
  parseCallback?: (text: string) => unknown,
  instrumentation?: {
    openaiCalls: { mainGen: number; regen: number; recipe: number };
    openaiDurations: { mainGen: number[]; regen: number[]; recipe: number[] };
    openaiTokens: { mainGen: { prompt: number; completion: number }[]; regen: { prompt: number; completion: number }[]; recipe: { prompt: number; completion: number }[] };
  },
  callKind?: "mainGen" | "regen" | "recipe",
  metadata?: { threadId?: string; lineIndex?: number; stanzaIndex?: number }
): Promise<ChatCompletion> {
  const debugSampling = process.env.DEBUG_SAMPLING === "1";
  const model = params.model || "unknown";
  const callStartTime = Date.now();
  
  // Track whether we've already tracked instrumentation (from retry paths)
  let instrumentationTracked = false;
  
  // ISS-017: Increment call counter if instrumentation provided
  if (instrumentation && callKind) {
    instrumentation.openaiCalls[callKind]++;
  }
  
  // Ensure non-streaming (we don't support streaming in this wrapper)
  const nonStreamingParams: ChatCompletionCreateParams = {
    ...params,
    stream: false,
  };
  
  // ISS-013: Determine response format type for stop sequences
  const responseFormatType: ResponseFormatType =
    nonStreamingParams.response_format?.type === "json_object"
      ? "json_object"
      : nonStreamingParams.response_format?.type === "json_schema"
      ? "json_schema"
      : "none";
  
  // ISS-013: Build stop sequences (only if enabled and JSON format)
  const stopSequences = buildStopSequences(model, responseFormatType);
  if (stopSequences) {
    nonStreamingParams.stop = stopSequences;
  }
  
  // Extract sampling params for logging
  const samplingParams: SamplingParams = {};
  if (typeof params.temperature === "number") {
    samplingParams.temperature = params.temperature;
  }
  if (typeof params.top_p === "number") {
    samplingParams.top_p = params.top_p;
  }
  if (typeof params.presence_penalty === "number") {
    samplingParams.presence_penalty = params.presence_penalty;
  }
  if (typeof params.frequency_penalty === "number") {
    samplingParams.frequency_penalty = params.frequency_penalty;
  }
  if (typeof params.seed === "number") {
    samplingParams.seed = params.seed;
  }
  
  const debugStopSequences = process.env.DEBUG_STOP_SEQUENCES === "1";
  const debugRawCompletion = process.env.DEBUG_RAW_COMPLETION === "1";
  
  try {
    // First attempt: with all params (including sampling and stop sequences)
    const result = await openai.chat.completions.create(nonStreamingParams);
    
    // Type assertion: we know it's non-streaming because stream=false
    const completion = result as ChatCompletion;
    
    // ISS-013: Log stop sequences if debug enabled
    if (debugStopSequences) {
      const stopApplied = stopSequences ? JSON.stringify(stopSequences) : "none";
      const tokenCount = getCompletionTokenCount(completion);
      console.log(
        `[stop] model=${model} stops=${stopApplied} completion_tokens=${tokenCount ?? "unknown"}`
      );
    }
    
    // ISS-013: If parse callback provided, try parsing to detect truncation
    if (parseCallback && stopSequences) {
      const text = completion.choices[0]?.message?.content ?? "";
      try {
        parseCallback(text);
      } catch (parseError) {
        // ISS-018: Log raw output on parse failure if DEBUG_OUTPUT_ON_PARSE_FAIL enabled
        const debugOnParseFail = process.env.DEBUG_OUTPUT_ON_PARSE_FAIL === "1";
        if (debugOnParseFail && text) {
          const maxChars = parseInt(process.env.DEBUG_OUTPUT_MAX_CHARS || "8000", 10);
          const truncated = text.length > maxChars ? text.slice(0, maxChars) + "..." : text;
          const sanitizedThreadId = metadata?.threadId ? `${metadata.threadId.slice(0, 8)}...` : undefined;
          
          console.log(`[RAW_OUTPUT] parse_failed`, {
            kind: callKind,
            model,
            charCount: text.length,
            tokenEstimate: Math.ceil(text.length / 4),
            threadId: sanitizedThreadId,
            stanzaIndex: metadata?.stanzaIndex,
            lineIndex: metadata?.lineIndex,
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            content: truncated,
          });
        }
        
        // Check if this looks like truncation from stop sequences
        if (isLikelyTruncationError(parseError, text)) {
          if (debugStopSequences || debugRawCompletion) {
            console.warn(
              `[stop] parse_failed_with_stop=true model=${model} retrying_without_stops`
            );
            if (debugRawCompletion) {
              console.log(`[stop] truncated_text_preview`, {
                textLength: text.length,
                textPreview: text.length > 400
                  ? `${text.slice(0, 200)}...${text.slice(-200)}`
                  : text,
              });
            }
          }
          
          // Retry without stop sequences
          const retryParams: ChatCompletionCreateParams = {
            ...nonStreamingParams,
            stop: undefined,
          };
          
          try {
            const retryResult = await openai.chat.completions.create(retryParams);
            const retryCompletion = retryResult as ChatCompletion;
            
            // ISS-017: Track retry call duration and tokens (same logical call, just retried)
            if (instrumentation && callKind) {
              const callDuration = Date.now() - callStartTime;
              instrumentation.openaiDurations[callKind].push(callDuration);
              
              // Track token usage from retry completion
              if (retryCompletion.usage) {
                instrumentation.openaiTokens[callKind].push({
                  prompt: retryCompletion.usage.prompt_tokens ?? 0,
                  completion: retryCompletion.usage.completion_tokens ?? 0,
                });
              }
              instrumentationTracked = true;
            }

            // Verify retry parses successfully
            const retryText = retryCompletion.choices[0]?.message?.content ?? "";
            try {
              parseCallback(retryText);
              
              // Success: log fallback recovery
              if (debugStopSequences) {
                const retryTokenCount = getCompletionTokenCount(retryCompletion);
                console.log(
                  `[stop] fallback_recovery_success model=${model} completion_tokens=${retryTokenCount ?? "unknown"}`
                );
              }
              
              // ISS-018: Log raw output for retry completion if enabled
              const retryRawContent = retryCompletion.choices[0]?.message?.content ?? "";
              if (retryRawContent) {
                const debugMainGen = process.env.DEBUG_MAIN_GEN_OUTPUT === "1";
                const debugRegen = process.env.DEBUG_REGEN_OUTPUT === "1";
                const shouldLog = (callKind === "mainGen" && debugMainGen) || (callKind === "regen" && debugRegen);
                
                if (shouldLog) {
                  const maxChars = parseInt(process.env.DEBUG_OUTPUT_MAX_CHARS || "8000", 10);
                  const truncated = retryRawContent.length > maxChars ? retryRawContent.slice(0, maxChars) + "..." : retryRawContent;
                  const sanitizedThreadId = metadata?.threadId ? `${metadata.threadId.slice(0, 8)}...` : undefined;
                  
                  const logData: Record<string, unknown> = {
                    kind: callKind,
                    model,
                    charCount: retryRawContent.length,
                    tokenEstimate: Math.ceil(retryRawContent.length / 4),
                    threadId: sanitizedThreadId,
                    stanzaIndex: metadata?.stanzaIndex,
                    lineIndex: metadata?.lineIndex,
                    content: truncated,
                    note: "retry_after_stop_sequence_removal",
                  };
                  
                  try {
                    const parsed = JSON.parse(retryRawContent);
                    if (typeof parsed === "object" && parsed !== null) {
                      logData.topLevelKeys = Object.keys(parsed);
                    }
                  } catch {
                    // Not JSON, ignore
                  }
                  
                  console.log(`[RAW_OUTPUT] ${callKind}`, logData);
                }
              }
              
              return retryCompletion;
            } catch (retryParseError) {
              // Retry also failed - not a stop sequence issue
              if (debugStopSequences) {
                console.error(
                  `[stop] fallback_retry_also_failed model=${model}`,
                  retryParseError
                );
              }
              // Return original result (caller will handle parse error)
              // Track original completion since retry failed
              if (instrumentation && callKind && !instrumentationTracked) {
                const callDuration = Date.now() - callStartTime;
                instrumentation.openaiDurations[callKind].push(callDuration);
                if (completion.usage) {
                  instrumentation.openaiTokens[callKind].push({
                    prompt: completion.usage.prompt_tokens ?? 0,
                    completion: completion.usage.completion_tokens ?? 0,
                  });
                }
                instrumentationTracked = true;
              }
              return completion;
            }
          } catch (retryError: unknown) {
            // Retry request failed - return original result
            if (debugStopSequences) {
              console.error(
                `[stop] fallback_retry_request_failed model=${model}`,
                retryError
              );
            }
            // Track original completion since retry request failed
            if (instrumentation && callKind && !instrumentationTracked) {
              const callDuration = Date.now() - callStartTime;
              instrumentation.openaiDurations[callKind].push(callDuration);
              if (completion.usage) {
                instrumentation.openaiTokens[callKind].push({
                  prompt: completion.usage.prompt_tokens ?? 0,
                  completion: completion.usage.completion_tokens ?? 0,
                });
              }
              instrumentationTracked = true;
            }
            return result as ChatCompletion;
          }
        }
        // Not a truncation error - return original result
      }
    }
    
    // ISS-017: Track duration and tokens for successful completion
    // (Only if we didn't already track from retry - retry paths track their own)
    if (instrumentation && callKind && !instrumentationTracked) {
      const callDuration = Date.now() - callStartTime;
      instrumentation.openaiDurations[callKind].push(callDuration);
      
      if (completion.usage) {
        instrumentation.openaiTokens[callKind].push({
          prompt: completion.usage.prompt_tokens ?? 0,
          completion: completion.usage.completion_tokens ?? 0,
        });
      }
    }
    
    // Success: log what was applied
    if (debugSampling) {
      const appliedParams = Object.keys(samplingParams).length > 0
        ? JSON.stringify(samplingParams)
        : "{}";
      console.log(
        `[sampling] model=${model} applied=${appliedParams} fallback=false`
      );
    }
    
    // ISS-018: Raw output logging (gated by debug flags)
    const rawContent = completion.choices[0]?.message?.content ?? "";
    if (rawContent) {
      const debugMainGen = process.env.DEBUG_MAIN_GEN_OUTPUT === "1";
      const debugRegen = process.env.DEBUG_REGEN_OUTPUT === "1";
      const shouldLog = (callKind === "mainGen" && debugMainGen) || (callKind === "regen" && debugRegen);
      
      if (shouldLog) {
        const maxChars = parseInt(process.env.DEBUG_OUTPUT_MAX_CHARS || "8000", 10);
        const truncated = rawContent.length > maxChars ? rawContent.slice(0, maxChars) + "..." : rawContent;
        const charCount = rawContent.length;
        const tokenEstimate = Math.ceil(charCount / 4); // Heuristic: ~4 chars per token
        
        // Sanitize metadata for logging (avoid PII)
        const sanitizedThreadId = metadata?.threadId ? `${metadata.threadId.slice(0, 8)}...` : undefined;
        
        const logData: Record<string, unknown> = {
          kind: callKind,
          model,
          charCount,
          tokenEstimate,
          threadId: sanitizedThreadId,
          stanzaIndex: metadata?.stanzaIndex,
          lineIndex: metadata?.lineIndex,
          content: truncated,
        };
        
        // If JSON, try to extract top-level keys
        try {
          const parsed = JSON.parse(rawContent);
          if (typeof parsed === "object" && parsed !== null) {
            logData.topLevelKeys = Object.keys(parsed);
          }
        } catch {
          // Not JSON, ignore
        }
        
        console.log(`[RAW_OUTPUT] ${callKind}`, logData);
      }
    }
    
    // Return completion (already cast above)
    return completion;
  } catch (error: unknown) {
    // Check if this is an unsupported parameter error
    if (isUnsupportedParamError(error)) {
      const rejectedParam = extractRejectedParam(error);
      
      // Log the rejection
      if (debugSampling || process.env.NODE_ENV !== "production") {
        console.warn(
          `[sampling] param rejected for model=${model}: ${rejectedParam || "unknown"}`
        );
      }
      
      // Retry without sampling params
      const retryParams: ChatCompletionCreateParams = {
        ...nonStreamingParams,
        temperature: undefined,
        top_p: undefined,
        presence_penalty: undefined,
        frequency_penalty: undefined,
        seed: undefined,
      };
      
      try {
        const retryResult = await openai.chat.completions.create(retryParams);
        
        // Log fallback success
        if (debugSampling) {
          const appliedParams = "{}";
          const reason = rejectedParam
            ? `unsupported_param(${rejectedParam})`
            : "unsupported_param(unknown)";
          console.log(
            `[sampling] model=${model} applied=${appliedParams} fallback=true reason=${reason}`
          );
        }
        
        // Type assertion: we know it's non-streaming because stream=false
        return retryResult as ChatCompletion;
      } catch (retryError: unknown) {
        // If retry also fails, it's not a param issue - rethrow original error
        // (but log that we tried fallback)
        if (debugSampling || process.env.NODE_ENV !== "production") {
          console.error(
            `[sampling] fallback retry also failed for model=${model}`,
            retryError
          );
        }
        throw error; // Rethrow original error, not retry error
      }
    }
    
    // Not a param error - rethrow as-is
    throw error;
  }
}

/**
 * Extract completion token count from result (for instrumentation).
 * 
 * @param result - Chat completion result
 * @returns Token count, or null if not available
 */
export function getCompletionTokenCount(
  result: ChatCompletion
): number | null {
  return result.usage?.completion_tokens ?? null;
}
