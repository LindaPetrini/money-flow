import { describe, it, expect } from 'vitest';
import { detectRecurring } from './recurringDetector';
import type { ParsedTransaction } from './csvParser';

// Helper: build a ParsedTransaction (amounts must be negative for expenses)
function tx(date: string, description: string, amountEur: number): ParsedTransaction {
  return { date, description, amountEur };
}

describe('detectRecurring', () => {
  it('detects a monthly recurring expense from 3 months of consistent payments', () => {
    const transactions = [
      tx('2025-01-15', 'Netflix', -12.99),
      tx('2025-02-15', 'Netflix', -12.99),
      tx('2025-03-15', 'Netflix', -12.99),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Netflix');
    expect(result[0].occurrences).toBe(3);
    expect(result[0].confidence).toBe('high');
    expect(result[0].avgAmountEur).toBeCloseTo(12.99, 2);
    expect(result[0].firstSeen).toBe('2025-01-15');
    expect(result[0].lastSeen).toBe('2025-03-15');
  });

  it('assigns medium confidence for exactly 2 occurrences', () => {
    const transactions = [
      tx('2025-01-10', 'Spotify', -9.99),
      tx('2025-02-10', 'Spotify', -9.99),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe('medium');
    expect(result[0].occurrences).toBe(2);
  });

  it('does NOT detect recurring when amount variance exceeds 20%', () => {
    // Low amount (5.00) vs high amount (8.00): variance = 3/6.5 ≈ 46% → excluded
    const transactions = [
      tx('2025-01-20', 'SomeVariableService', -5.00),
      tx('2025-02-20', 'SomeVariableService', -8.00),
      tx('2025-03-20', 'SomeVariableService', -5.00),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(0);
  });

  it('does NOT detect recurring for non-monthly intervals (e.g. weekly)', () => {
    const transactions = [
      tx('2025-03-01', 'WeeklyGym', -10.00),
      tx('2025-03-08', 'WeeklyGym', -10.00),
      tx('2025-03-15', 'WeeklyGym', -10.00),
      tx('2025-03-22', 'WeeklyGym', -10.00),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(0);
  });

  it('normalizeMerchant: groups transactions with store-ID suffixes under the same merchant', () => {
    // "DECATHLON 00000529" and "DECATHLON 00000842" should normalize to "decathlon"
    const transactions = [
      tx('2025-01-05', 'DECATHLON 00000529', -45.00),
      tx('2025-02-05', 'DECATHLON 00000842', -45.00),
      tx('2025-03-05', 'DECATHLON 00000529', -45.00),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(1);
    // Most recent description is used as merchant name
    expect(result[0].merchant).toBe('DECATHLON 00000529');
    expect(result[0].occurrences).toBe(3);
  });

  it('normalizeMerchant: strips trailing hash+number suffixes (#123)', () => {
    // "Starbucks #42 Berlin" and "Starbucks #99 Munich" → same group "starbucks"
    const transactions = [
      tx('2025-01-12', 'Starbucks #42 Berlin', -4.50),
      tx('2025-02-12', 'Starbucks #99 Munich', -4.50),
      tx('2025-03-12', 'Starbucks #12 Hamburg', -4.50),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toBe(3);
  });

  it('does NOT crash and does NOT include zero-amount transactions (NaN guard)', () => {
    // All amounts are 0 → avg is 0 → division by zero would produce NaN without the guard
    const transactions = [
      tx('2025-01-20', 'ZeroService', 0),
      tx('2025-02-20', 'ZeroService', 0),
      tx('2025-03-20', 'ZeroService', 0),
    ];

    let result: ReturnType<typeof detectRecurring>;
    expect(() => {
      result = detectRecurring(transactions);
    }).not.toThrow();

    // Zero-amount items are not expenses (amountEur < 0 filter) so they are excluded
    expect(result!).toHaveLength(0);
  });

  it('does NOT crash when zero-amount expenses are mixed in (negative zero edge case)', () => {
    // Even if someone passes -0, avg would be 0 → NaN without guard
    const transactions = [
      tx('2025-01-20', 'NegZeroService', -0),
      tx('2025-02-20', 'NegZeroService', -0),
      tx('2025-03-20', 'NegZeroService', -0),
    ];

    let result: ReturnType<typeof detectRecurring>;
    expect(() => {
      result = detectRecurring(transactions);
    }).not.toThrow();

    // avg === 0, so the guard skips it — no NaN in the output
    result!.forEach(item => {
      expect(item.avgAmountEur).not.toBeNaN();
    });
  });

  it('does NOT detect a single-occurrence transaction', () => {
    const transactions = [
      tx('2025-02-14', 'OnceOff', -200.00),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(0);
  });

  it('sorts results descending by average amount', () => {
    // Netflix (12.99) and iCloud (2.99) and AdobeCC (54.99) → sorted desc: Adobe, Netflix, iCloud
    const transactions = [
      tx('2025-01-01', 'Netflix', -12.99),
      tx('2025-02-01', 'Netflix', -12.99),
      tx('2025-03-01', 'Netflix', -12.99),

      tx('2025-01-05', 'iCloud', -2.99),
      tx('2025-02-05', 'iCloud', -2.99),
      tx('2025-03-05', 'iCloud', -2.99),

      tx('2025-01-10', 'AdobeCC', -54.99),
      tx('2025-02-10', 'AdobeCC', -54.99),
      tx('2025-03-10', 'AdobeCC', -54.99),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(3);
    expect(result[0].avgAmountEur).toBeCloseTo(54.99, 2); // AdobeCC first (highest)
    expect(result[1].avgAmountEur).toBeCloseTo(12.99, 2); // Netflix second
    expect(result[2].avgAmountEur).toBeCloseTo(2.99, 2);  // iCloud last (lowest)
  });

  it('ignores income (positive amountEur) even if it looks recurring', () => {
    const transactions = [
      tx('2025-01-01', 'ClientInvoice', 1000.00),
      tx('2025-02-01', 'ClientInvoice', 1000.00),
      tx('2025-03-01', 'ClientInvoice', 1000.00),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(0);
  });

  it('handles an empty transaction list without error', () => {
    const result = detectRecurring([]);
    expect(result).toEqual([]);
  });

  it('skips merchants with fewer than 3 characters after normalization', () => {
    // "OK" normalizes to "ok" (2 chars) — should be filtered out
    const transactions = [
      tx('2025-01-15', 'OK', -5.00),
      tx('2025-02-15', 'OK', -5.00),
    ];

    const result = detectRecurring(transactions);

    expect(result).toHaveLength(0);
  });
});
