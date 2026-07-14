/**
 * Amount and Date Extractor
 * Matches amounts with currency prefixes and relative date phrases.
 */

const AMOUNT_RE = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand)?\b/i;

export function extractAmount(clause: string): { amount: number | null; rest: string } {
  const m = clause.match(AMOUNT_RE);
  if (!m) return { amount: null, rest: clause };
  
  let amount = parseFloat(m[1]);
  if (m[2]) {
    amount *= 1000;
  }
  
  // Replace the matched amount and surrounding currency symbol with a space
  const rest = clause.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
  return { amount, rest };
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function extractDate(clause: string): { date: string; rest: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  
  let rest = clause;
  let date = iso(today);

  if (/\byesterday\b/i.test(clause)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    date = iso(d);
    rest = clause.replace(/\byesterday\b/i, ' ');
  } else if (/\btoday\b/i.test(clause)) {
    rest = clause.replace(/\btoday\b/i, ' ');
  } else {
    const m = clause.match(/\blast\s+(\w+day)\b/i);
    if (m) {
      const target = DAYS.indexOf(m[1].toLowerCase());
      if (target >= 0) {
        const d = new Date(today);
        const diff = ((d.getDay() - target + 7) % 7) || 7;
        d.setDate(d.getDate() - diff);
        date = iso(d);
        rest = clause.replace(m[0], ' ');
      }
    }
  }
  
  return { date, rest: rest.replace(/\s+/g, ' ').trim() };
}
