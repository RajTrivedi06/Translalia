export function countSyllables(text: string): number {
  if (!text || !text.trim()) return 0;

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  let totalSyllables = 0;

  for (const word of words) {
    // Words with 3 or fewer characters = 1 syllable
    if (word.length <= 3) {
      totalSyllables += 1;
      continue;
    }

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    let syllableCount = vowelGroups ? vowelGroups.length : 1;

    // Adjust for silent 'e' at the end
    if (word.endsWith("e") && syllableCount > 1) {
      syllableCount--;
    }

    // Ensure at least 1 syllable
    totalSyllables += Math.max(syllableCount, 1);
  }

  return totalSyllables;
}
