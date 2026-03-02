/**
 * Algorithmic recurring expense detector.
 *
 * Groups transactions by normalized merchant name and detects monthly patterns.
 * No AI required — uses date intervals + amount stability heuristics.
 */
import type { ParsedTransaction } from '@/lib/csvParser';

export interface RecurringExpense {
  merchant: string;          // canonical merchant name (most recent occurrence)
  avgAmountEur: number;
  occurrences: number;
  confidence: 'high' | 'medium'; // high = 3+ occurrences with consistent intervals
  firstSeen: string;         // ISO date
  lastSeen: string;          // ISO date
}

/** Normalize merchant name for grouping (strip store IDs, trailing numbers, etc.) */
function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*#\d+.*$/, '')        // strip "#123 SomeCity" suffixes
    .replace(/\s+\d{4,}.*$/, '')      // strip long number sequences ("SumUp  *A G  BAR 123456" → "sumup  *a g  bar")
    .replace(/\s+\d+$/, '')           // strip trailing short numbers
    .replace(/\s+0\d{3,}/, '')        // strip store codes like "DECATHLON 00000529"
    .replace(/[*]/g, ' ')             // replace * with space
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();
}

function daysBetween(isoA: string, isoB: string): number {
  return (new Date(isoB).getTime() - new Date(isoA).getTime()) / 86_400_000;
}

/**
 * Detect recurring expenses from a list of transactions.
 * Only looks at expenses (negative amounts). Returns results sorted by amount desc.
 */
export function detectRecurring(transactions: ParsedTransaction[]): RecurringExpense[] {
  // Only expenses
  const expenses = transactions.filter(t => t.amountEur < 0);

  // Group by normalized merchant name
  const byMerchant = new Map<string, ParsedTransaction[]>();
  for (const tx of expenses) {
    const key = normalizeMerchant(tx.description);
    if (!key || key.length < 3) continue;
    const group = byMerchant.get(key) ?? [];
    group.push(tx);
    byMerchant.set(key, group);
  }

  const recurring: RecurringExpense[] = [];

  for (const [, txs] of byMerchant) {
    if (txs.length < 2) continue;

    // Sort by date
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

    // Check intervals — at least 60% must be in the "monthly" range (20–45 days)
    let monthlyIntervals = 0;
    for (let i = 1; i < sorted.length; i++) {
      const days = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (days >= 20 && days <= 45) monthlyIntervals++;
    }
    const isMonthly = sorted.length >= 3
      ? monthlyIntervals >= Math.floor((sorted.length - 1) * 0.6)
      : monthlyIntervals >= 1; // 2 occurrences: just need the 1 interval to be monthly

    if (!isMonthly) continue;

    // Check amount stability: variance <= 20%
    const amounts = sorted.map(t => Math.abs(t.amountEur));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avg === 0) continue;
    const maxVariance = Math.max(...amounts.map(a => Math.abs(a - avg) / avg));
    if (maxVariance > 0.2) continue;

    recurring.push({
      merchant: sorted[sorted.length - 1].description, // most recent name
      avgAmountEur: avg,
      occurrences: sorted.length,
      confidence: sorted.length >= 3 ? 'high' : 'medium',
      firstSeen: sorted[0].date,
      lastSeen: sorted[sorted.length - 1].date,
    });
  }

  return recurring.sort((a, b) => b.avgAmountEur - a.avgAmountEur);
}
