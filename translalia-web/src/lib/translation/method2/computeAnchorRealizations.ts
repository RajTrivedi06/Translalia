/**
 * ISS-011: Local Anchor Realization Computation
 * 
 * Computes anchor_realizations locally by finding substrings in variant text
 * that correspond to anchor concepts, instead of relying on model output.
 * 
 * This reduces token bloat (~60-150 tokens per call) and eliminates
 * stopword-only realization failures that trigger regens.
 */

import type { Anchor } from "@/lib/ai/anchorsValidation";
import { normalizeForContainment, containsNormalized, tokenize } from "@/lib/ai/textNormalize";
import { pickStopwords } from "@/lib/ai/stopwords";
import { segmentText } from "@/lib/text/segmentText";

/**
 * Compute anchor realizations locally by finding substrings in variant text.
 * 
 * Algorithm (conservative):
 * 1. For each anchor, extract keywords from concept_en (filter stopwords)
 * 2. Find substrings in variant text that contain those keywords
 * 3. Expand to include nearby words to form a meaningful phrase
 * 4. Return the exact substring as it appears in variant text (preserve casing)
 * 
 * @param variantText - The translated variant text
 * @param anchors - Array of anchors with id, concept_en, source_tokens
 * @param targetLanguage - Target language hint for stopword filtering
 * @returns Record of anchor_id -> realization string (may be incomplete if no match found)
 */
/**
 * Widen [matchStart, matchEnd) out to the enclosing token boundaries.
 *
 * Uses the shared segmenter so this works for unspaced scripts. For Latin the
 * segment boundaries are the whitespace boundaries, so the result is identical
 * to the walk it replaces. If the offsets fall outside every segment (possible
 * when the match lands on punctuation), the input range is returned unchanged.
 */
function tokenBoundsAround(
  text: string,
  matchStart: number,
  matchEnd: number
): { start: number; end: number } {
  let start = matchStart;
  let end = matchEnd;

  for (const seg of segmentText(text)) {
    if (seg.start <= matchStart && seg.end > matchStart) {
      start = Math.min(start, seg.start);
    }
    if (seg.start < matchEnd && seg.end >= matchEnd) {
      end = Math.max(end, seg.end);
    }
  }

  return { start, end };
}

export function computeAnchorRealizations(
  variantText: string,
  anchors: Anchor[],
  targetLanguage: string
): Record<string, string> {
  const realizations: Record<string, string> = {};
  const stopwords = pickStopwords(targetLanguage);
  
  // Lowercased copy for case-insensitive search; the original is preserved so
  // extracted realizations keep their casing.
  const variantLower = variantText.toLowerCase();

  for (const anchor of anchors) {
    const anchorId = anchor.id;
    
    // Extract keywords from concept_en (split on spaces, filter stopwords)
    const conceptWords = anchor.concept_en
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0 && !stopwords.has(t));
    
    // If no keywords, try using source_tokens as fallback
    const searchTerms = conceptWords.length > 0 
      ? conceptWords 
      : anchor.source_tokens.map((t) => t.toLowerCase()).filter((t) => t.length > 0);
    
    if (searchTerms.length === 0) {
      // No searchable terms - skip this anchor
      continue;
    }
    
    // Strategy: Find substring containing search terms, expand to meaningful phrase
    let bestMatch: string | null = null;
    
    // Try each search term
    for (const term of searchTerms) {
      // Find all occurrences of this term in variant text (case-insensitive)
      let searchIndex = 0;
      
      while (true) {
        const index = variantLower.indexOf(term, searchIndex);
        if (index === -1) break;
        
        // Find token boundaries around this match.
        //
        // The whitespace walk this replaces (`while (/\S/.test(...))`) had no
        // stopping condition in space-free text: it ran to both ends of the
        // line, so `start`/`end` became 0 and `variantText.length` and the
        // resulting candidate was then discarded by the 50-char cap. Using the
        // shared segmenter gives real boundaries for both spaced and unspaced
        // scripts, and reduces to the identical result for Latin (segment
        // boundaries there ARE whitespace boundaries).
        const { start, end } = tokenBoundsAround(
          variantText,
          index,
          index + term.length
        );

        // Expand to include up to 2 tokens before and after (for meaningful
        // phrase). Segmented, not whitespace-split: in space-free text a
        // whitespace split returns the entire prefix as a single "word", so
        // widening the window by one token swallowed the whole line — the same
        // failure as the boundary walk above, one step later.
        //
        // The `.filter(Boolean)` also fixes a second bug that affected Latin:
        // `"".trim().split(/\s+/)` returns `[""]`, length 1 rather than 0, so
        // an empty before/after context reported one phantom word and the
        // expansion loop indexed a token that was not there.
        const beforeText = variantText.slice(0, start);
        const afterText = variantText.slice(end);
        const beforeWords = segmentText(beforeText)
          .filter((s) => s.wordLike)
          .map((s) => s.text)
          .filter(Boolean);
        const afterWords = segmentText(afterText)
          .filter((s) => s.wordLike)
          .map((s) => s.text)
          .filter(Boolean);
        
        // Try expanding window (0-2 words before, 0-2 words after)
        for (let beforeCount = 0; beforeCount <= 2; beforeCount++) {
          for (let afterCount = 0; afterCount <= 2; afterCount++) {
            // Calculate new boundaries
            const beforeWordCount = Math.min(beforeCount, beforeWords.length);
            const afterWordCount = Math.min(afterCount, afterWords.length);
            
            // Find start position
            let newStart = start;
            if (beforeWordCount > 0) {
              const beforeStartText = beforeWords.slice(-beforeWordCount).join(" ");
              const beforeStartIndex = variantText.lastIndexOf(beforeStartText, start);
              if (beforeStartIndex !== -1) {
                newStart = beforeStartIndex;
              }
            }
            
            // Find end position
            let newEnd = end;
            if (afterWordCount > 0) {
              const afterEndText = afterWords.slice(0, afterWordCount).join(" ");
              const afterEndIndex = variantText.indexOf(afterEndText, end);
              if (afterEndIndex !== -1) {
                newEnd = afterEndIndex + afterEndText.length;
              }
            }
            
            if (newStart >= 0 && newEnd > newStart && newEnd <= variantText.length) {
              const candidate = variantText.slice(newStart, newEnd).trim();
              
              // Check if candidate is meaningful (not stopword-only, >= 2 chars)
              const candidateTokens = tokenize(candidate);
              const hasNonStopword = candidateTokens.some((t) => !stopwords.has(t.toLowerCase()));
              
              if (hasNonStopword && candidate.length >= 2) {
                // Prefer longer matches (but not too long - max 50 chars)
                if (candidate.length <= 50 && (!bestMatch || candidate.length > bestMatch.length)) {
                  bestMatch = candidate;
                }
              }
            }
          }
        }
        
        searchIndex = index + 1;
      }
    }
    
    // Fallback: Simple substring match if expansion failed
    if (!bestMatch) {
      for (const term of searchTerms) {
        const index = variantLower.indexOf(term);
        if (index !== -1) {
          // Extract a small window around the match
          const windowSize = 20;
          const start = Math.max(0, index - windowSize);
          const end = Math.min(variantText.length, index + term.length + windowSize);
          const candidate = variantText.slice(start, end).trim();
          
          // Check if meaningful
          const candidateTokens = tokenize(candidate);
          const hasNonStopword = candidateTokens.some((t) => !stopwords.has(t.toLowerCase()));
          
          if (hasNonStopword && candidate.length >= 2 && candidate.length <= 50) {
            bestMatch = candidate;
            break; // Use first match
          }
        }
      }
    }
    
    if (bestMatch) {
      realizations[anchorId] = bestMatch;
    }
    // If no match found, omit this anchor (don't invent text)
  }
  
  return realizations;
}

/**
 * Compare model-provided realizations with locally-computed ones.
 * 
 * @param modelRealizations - Realizations from model output
 * @param localRealizations - Realizations computed locally
 * @param anchors - Array of anchors
 * @returns Comparison result with counts and mismatches
 */
export function compareRealizations(
  modelRealizations: Record<string, string> | undefined | null,
  localRealizations: Record<string, string>,
  anchors: Anchor[]
): {
  anchorCount: number;
  modelCount: number;
  localCount: number;
  matches: number;
  mismatches: Array<{ anchorId: string; model: string; local: string | null }>;
  modelStopwordOnly: number;
  localStopwordOnly: number;
} {
  const anchorIds = anchors.map((a) => a.id);
  const model = modelRealizations || {};
  const local = localRealizations;
  
  const matches: number = anchorIds.filter((id) => {
    const modelVal = model[id];
    const localVal = local[id];
    if (!modelVal || !localVal) return false;
    // Consider a match if they're similar (normalized comparison)
    return containsNormalized(modelVal, localVal) || containsNormalized(localVal, modelVal);
  }).length;
  
  const mismatches: Array<{ anchorId: string; model: string; local: string | null }> = [];
  const stopwords = pickStopwords("en"); // Default to English for stopword check
  
  let modelStopwordOnly = 0;
  let localStopwordOnly = 0;
  
  for (const anchorId of anchorIds) {
    const modelVal = model[anchorId];
    const localVal = local[anchorId];
    
    if (modelVal) {
      const tokens = tokenize(modelVal);
      const isStopwordOnly = tokens.length > 0 && tokens.every((t) => stopwords.has(t.toLowerCase()));
      if (isStopwordOnly) modelStopwordOnly++;
    }
    
    if (localVal) {
      const tokens = tokenize(localVal);
      const isStopwordOnly = tokens.length > 0 && tokens.every((t) => stopwords.has(t.toLowerCase()));
      if (isStopwordOnly) localStopwordOnly++;
    }
    
    if (modelVal && (!localVal || !containsNormalized(modelVal, localVal))) {
      mismatches.push({
        anchorId,
        model: modelVal,
        local: localVal || null,
      });
    }
  }
  
  return {
    anchorCount: anchorIds.length,
    modelCount: Object.keys(model).length,
    localCount: Object.keys(local).length,
    matches,
    mismatches,
    modelStopwordOnly,
    localStopwordOnly,
  };
}
