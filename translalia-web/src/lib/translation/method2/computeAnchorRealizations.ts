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
export function computeAnchorRealizations(
  variantText: string,
  anchors: Anchor[],
  targetLanguage: string
): Record<string, string> {
  const realizations: Record<string, string> = {};
  const stopwords = pickStopwords(targetLanguage);
  
  // Tokenize variant text (preserve original for substring extraction)
  const variantLower = variantText.toLowerCase();
  const words = variantText.split(/\s+/);
  
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
        
        // Find word boundaries around this match
        // Look backwards to find start of word/phrase
        let start = index;
        while (start > 0 && /\S/.test(variantText[start - 1])) {
          start--;
        }
        
        // Look forwards to find end of word/phrase
        let end = index + term.length;
        while (end < variantText.length && /\S/.test(variantText[end])) {
          end++;
        }
        
        // Expand to include up to 2 words before and after (for meaningful phrase)
        const beforeText = variantText.slice(0, start);
        const afterText = variantText.slice(end);
        const beforeWords = beforeText.trim().split(/\s+/);
        const afterWords = afterText.trim().split(/\s+/);
        
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
