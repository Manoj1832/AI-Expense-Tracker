/**
 * Clause Splitter
 * Splits free-form text on conjunctions, commas, newlines, or semicolons
 * and filters out clauses that don't contain any numerical digits (potential amount).
 */
export function splitClauses(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/,|\band\b|\n|;/gi)
    .map(c => c.trim())
    .filter(c => c.length > 2 && /\d/.test(c));
}
