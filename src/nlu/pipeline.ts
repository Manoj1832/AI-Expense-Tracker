import { splitClauses } from './clauseSplitter';
import { extractAmount, extractDate } from './amountDateExtractor';
import { classify } from './categoryClassifier';
import { extractNote } from './noteExtractor';

export interface ParsedExpense {
  amount: number;
  category: string;
  predicted: string;
  confidence: number;
  note: string;
  expense_date: string;
  raw_text: string;
  source: 'voice' | 'text';
}

/**
 * NLU Pipeline Orchestrator
 * Splits inputs into clauses, extracts amounts and dates, runs category classification,
 * cleans note strings, and returns structured transaction items. Runs fully offline on-device.
 */
export async function parseExpenses(raw: string, source: 'voice' | 'text'): Promise<ParsedExpense[]> {
  const results: ParsedExpense[] = [];
  const clauses = splitClauses(raw);
  
  for (const clause of clauses) {
    const { amount, rest: r1 } = extractAmount(clause);
    if (amount === null || isNaN(amount)) continue;
    
    const { date, rest: r2 } = extractDate(r1);
    const { category, predicted, confidence } = await classify(r2);
    const note = extractNote(r2, category);
    
    results.push({
      amount,
      category,
      predicted,
      confidence,
      note,
      expense_date: date,
      raw_text: clause,
      source,
    });
  }
  
  return results;
}
