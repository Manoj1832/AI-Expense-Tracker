/**
 * Note Extractor
 * Extracts a clean merchant/item note by removing common stop words, currency symbols, and category names.
 */

const STOPWORDS = /\b(spent|paid|bought|for|on|of|bill|gave|to|rs\.?|inr|₹|amount|rupees|rupee)\b/gi;

export function extractNote(rest: string, category: string): string {
  if (!rest) return '';
  
  let note = rest
    .replace(STOPWORDS, ' ')
    .replace(new RegExp(`\\b${category}\\b`, 'gi'), ' ')
    .replace(/[^\w\s]/g, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
    
  // Capitalize first letter
  if (note.length > 0) {
    note = note.charAt(0).toUpperCase() + note.slice(1);
  }
  
  return note || 'Expense';
}
