// Matching against the admin-managed blocked_words list.
//
// Whole-word, case-insensitive: "ass" blocks "ass" / "Ass!" but not "class" or "pass";
// "hell" blocks "hell" but not "hello". Multi-word entries ("shut up") match as a phrase.
// A "word" boundary is anything that isn't a letter or digit (any language), so punctuation,
// spaces and emoji all count as separators.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if `content` contains any of `words` as a whole word or phrase. */
export function containsBlockedWord(content: string, words: string[]): boolean {
  return words.some(raw => {
    const word = raw.trim();
    if (!word) return false;
    // Whitespace inside a phrase matches any run of whitespace in the message
    const pattern = escapeRegExp(word).replace(/\s+/g, '\\s+');
    return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'iu').test(content);
  });
}
