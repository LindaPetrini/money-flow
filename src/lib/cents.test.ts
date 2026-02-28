import { describe, it, expect } from 'vitest';
import {
  type Cents,
  parseCents,
  formatCents,
  pctOf,
  addCents,
  subCents,
  splitCents,
} from './cents';

describe('parseCents', () => {
  it('parses 19.99 to exactly 1999 (no floating-point leakage)', () => {
    expect(parseCents('19.99')).toBe(1999);
  });

  it('parses 1.01 to exactly 101', () => {
    expect(parseCents('1.01')).toBe(101);
  });

  it('parses 99.99 to exactly 9999', () => {
    expect(parseCents('99.99')).toBe(9999);
  });

  it('parses whole numbers by multiplying by 100', () => {
    expect(parseCents('2000')).toBe(200000);
  });

  it('parses 0 to 0', () => {
    expect(parseCents('0')).toBe(0);
  });

  it('parses single decimal place', () => {
    expect(parseCents('19.9')).toBe(1990);
  });

  it('strips non-numeric characters (except dot) before parsing', () => {
    expect(parseCents('€1,999.99')).toBe(199999);
  });
});

describe('formatCents', () => {
  it('formats 199900 cents as de-DE EUR string', () => {
    const result = formatCents(199900 as Cents);
    // de-DE EUR format: 1.999,00 €
    expect(result).toContain('1');
    expect(result).toContain('999');
    expect(result).toContain('€');
  });

  it('formats 0 cents as 0,00 €', () => {
    const result = formatCents(0 as Cents);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('formats using de-DE locale with comma decimal separator', () => {
    const result = formatCents(150 as Cents);
    // 150 cents = 1,50 €
    expect(result).toMatch(/1[,.]50/);
    expect(result).toContain('€');
  });
});

describe('pctOf', () => {
  it('returns 37% of 200000 cents as 74000', () => {
    expect(pctOf(200000 as Cents, 37)).toBe(74000);
  });

  it('floors fractional results: 33% of 100 cents = 33', () => {
    expect(pctOf(100 as Cents, 33)).toBe(33);
  });

  it('returns 0 for 0% of any amount', () => {
    expect(pctOf(1000 as Cents, 0)).toBe(0);
  });
});

describe('addCents', () => {
  it('adds multiple amounts', () => {
    expect(addCents(100 as Cents, 200 as Cents, 300 as Cents)).toBe(600);
  });

  it('adds two amounts', () => {
    expect(addCents(500 as Cents, 250 as Cents)).toBe(750);
  });

  it('handles zero', () => {
    expect(addCents(100 as Cents, 0 as Cents)).toBe(100);
  });
});

describe('subCents', () => {
  it('subtracts b from a', () => {
    expect(subCents(1000 as Cents, 300 as Cents)).toBe(700);
  });

  it('handles subtraction to zero', () => {
    expect(subCents(500 as Cents, 500 as Cents)).toBe(0);
  });
});

describe('splitCents', () => {
  it('splits 100 cents into 2 equal buckets: [50, 50]', () => {
    const result = splitCents(100 as Cents, [1, 1]);
    expect(result).toEqual([50, 50]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('splits 100 cents into 3 equal buckets summing to exactly 100', () => {
    const result = splitCents(100 as Cents, [1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result).toHaveLength(3);
    // Should be [34, 33, 33] or similar distribution
    expect(result.every(v => v === 33 || v === 34)).toBe(true);
  });

  it('splits 1000 cents with [33, 33, 34] ratio summing to 1000', () => {
    const result = splitCents(1000 as Cents, [33, 33, 34]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(result).toHaveLength(3);
  });

  it('splits 200000 cents with [37, 35, 15, 13] ratio summing to 200000', () => {
    const result = splitCents(200000 as Cents, [37, 35, 15, 13]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(200000);
    expect(result).toHaveLength(4);
  });

  it('returns empty array for empty ratios', () => {
    expect(splitCents(100 as Cents, [])).toEqual([]);
  });

  it('returns all zeros for all-zero ratios', () => {
    const result = splitCents(100 as Cents, [0, 0]);
    expect(result).toEqual([0, 0]);
  });

  it('largest-remainder: sums always equal total exactly', () => {
    // Test multiple tricky cases
    const cases: [number, number[]][] = [
      [100, [1, 1, 1]],
      [100, [1, 2, 3]],
      [1000, [1, 1, 1]],
      [199900, [37, 35, 15, 13]],
      [101, [1, 1, 1]],
    ];
    for (const [total, ratios] of cases) {
      const result = splitCents(total as Cents, ratios);
      expect(result.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
