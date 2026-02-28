/**
 * Integer cents arithmetic library.
 *
 * All money math in the app must use these functions.
 * No raw * 100 or / 100 operations should appear outside this file.
 */

/**
 * Branded type to catch raw number leakage at compile time.
 * Use `parseCents(string)` to create values, not `n as Cents`.
 */
export type Cents = number & { readonly __brand: 'Cents' };

/**
 * Parse a string representation of a monetary amount into integer cents.
 * Strips all non-numeric-except-dot characters before parsing.
 * Uses Math.round to avoid floating-point leakage (e.g., '19.99' -> 1999, not 1998.9999...).
 */
export function parseCents(input: string): Cents {
  const cleaned = input.replace(/[^0-9.]/g, '');
  return Math.round(parseFloat(cleaned) * 100) as Cents;
}

/**
 * Format an integer cents value as a human-readable currency string.
 * Defaults to de-DE locale with EUR currency.
 */
export function formatCents(cents: Cents, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/**
 * Calculate a percentage of an amount, using Math.floor (conservative).
 * Remainder is the caller's responsibility (use splitCents for fair distribution).
 */
export function pctOf(amount: Cents, pct: number): Cents {
  return Math.floor((amount * pct) / 100) as Cents;
}

/**
 * Add any number of Cents values together.
 */
export function addCents(...amounts: Cents[]): Cents {
  return amounts.reduce((sum, a) => sum + a, 0) as Cents;
}

/**
 * Subtract b from a.
 */
export function subCents(a: Cents, b: Cents): Cents {
  return (a - b) as Cents;
}

/**
 * Split a total amount into buckets according to ratios using the
 * LARGEST-REMAINDER ALGORITHM — bucket totals always equal total exactly.
 *
 * Algorithm:
 * 1. Compute exact float share for each bucket
 * 2. Floor all shares
 * 3. Distribute remainder cents to buckets with largest fractional remainders
 *
 * @param total - Total amount in cents to split
 * @param ratios - Array of ratio weights (any positive numbers, need not sum to 100)
 * @returns Array of Cents values that sum exactly to total
 */
export function splitCents(total: Cents, ratios: number[]): Cents[] {
  if (ratios.length === 0) return [];

  const sum = ratios.reduce((a, b) => a + b, 0);

  // Handle all-zero ratios
  if (sum === 0) {
    return ratios.map(() => 0 as Cents);
  }

  // Step 1: Compute exact float shares
  const floats = ratios.map(r => (r / sum) * total);

  // Step 2: Floor all shares
  const floored = floats.map(f => Math.floor(f));

  // Step 3: Compute remainder
  const flooredSum = floored.reduce((a, b) => a + b, 0);
  const remainder = total - flooredSum;

  // Step 4: Sort indices by descending fractional remainder
  const fractions = floats.map((f, i) => ({ index: i, fraction: f - floored[i] }));
  fractions.sort((a, b) => b.fraction - a.fraction);

  // Step 5: Add 1 to the top `remainder` indices
  const result = [...floored];
  for (let i = 0; i < remainder; i++) {
    result[fractions[i].index] += 1;
  }

  return result.map(v => v as Cents);
}
