import { describe, it, expect } from 'vitest';
import type { Cents } from '@/lib/cents';
import { computeAllocation } from './allocationEngine';
import type { Account, Settings } from '@/types/domain';

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeAccount(id: string, balanceCents = 0, role: Account['role'] = 'savings'): Account {
  return { id, name: id, balanceCents, targetCents: 0, role };
}

function baseSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    taxPct: 30,
    taxAccountId: 'tax',
    overflowRatios: [
      { accountId: 'essentials', pct: 60 },
      { accountId: 'fun', pct: 20 },
      { accountId: 'savings', pct: 10 },
      { accountId: 'investing', pct: 10 },
    ],
    confirmedRecurring: [],
    ...overrides,
  };
}

const taxAccount = makeAccount('tax', 0, 'tax');
const accounts = [taxAccount, makeAccount('essentials'), makeAccount('fun'), makeAccount('savings'), makeAccount('investing')];

// ─── Tax extraction ──────────────────────────────────────────────────────────

describe('computeAllocation — tax extraction', () => {
  it('first move is always tax', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    expect(result.moves[0].rule).toBe('tax');
  });

  it('tax amount uses pctOf (Math.floor): 30% of 200000 = 60000', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    expect(result.moves[0].amountCents).toBe(60000);
  });

  it('tax move destination is taxAccountId from settings', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    expect(result.moves[0].destinationAccountId).toBe('tax');
  });

  it('tax move has non-empty calculation containing the percentage', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    const taxMove = result.moves[0];
    expect(taxMove.calculation).toContain('30');
    expect(taxMove.rule).toBe('tax');
    expect(taxMove.reason).toBeTruthy();
  });
});

// ─── Edge case: post-tax <= 0 ────────────────────────────────────────────────

describe('edge case: post-tax amount zero or negative', () => {
  it('returns only a tax move when taxPct = 100', () => {
    const settings = baseSettings({ taxPct: 100 });
    const result = computeAllocation(50000 as Cents, accounts, settings);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].rule).toBe('tax');
    expect(result.moves[0].amountCents).toBe(50000);
  });
});

// ─── Distribute mode — always ────────────────────────────────────────────────

describe('computeAllocation — distribute (always)', () => {
  it('mode is always distribute', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    expect(result.mode).toBe('distribute');
  });

  it('distribute moves sum exactly to post-tax remaining', () => {
    // 200000, 30% tax = 60000, remaining = 140000
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    const distMoves = result.moves.filter(m => m.rule === 'distribute');
    const distSum = distMoves.reduce((sum, m) => sum + m.amountCents, 0);
    expect(distSum).toBe(140000);
  });

  it('distribute handles odd cent counts exactly (largest-remainder)', () => {
    const settings = baseSettings({
      overflowRatios: [
        { accountId: 'a', pct: 33 },
        { accountId: 'b', pct: 33 },
        { accountId: 'c', pct: 34 },
      ],
    });
    const result = computeAllocation(100001 as Cents, [taxAccount], settings);
    const distMoves = result.moves.filter(m => m.rule === 'distribute');
    const taxAmount = result.moves[0].amountCents;
    const distSum = distMoves.reduce((sum, m) => sum + m.amountCents, 0);
    expect(distSum).toBe(100001 - taxAmount);
  });

  it('distribute moves have non-empty calculation and reason with %', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    const distMoves = result.moves.filter(m => m.rule === 'distribute');
    for (const move of distMoves) {
      expect(move.calculation).toContain('%');
      expect(move.reason).toBeTruthy();
    }
  });
});

// ─── Edge case: empty overflowRatios ────────────────────────────────────────

describe('edge case: empty overflowRatios', () => {
  it('returns an unallocated move instead of silently dropping cents', () => {
    const settings = baseSettings({ overflowRatios: [] });
    const result = computeAllocation(200000 as Cents, [taxAccount], settings);
    const allMovesCents = result.moves.reduce((sum, m) => sum + m.amountCents, 0);
    expect(allMovesCents).toBe(200000);
    const unallocated = result.moves.find(m => m.rule === 'unallocated');
    expect(unallocated).toBeDefined();
    expect(unallocated!.amountCents).toBe(140000); // 200000 - 60000 tax
  });
});

// ─── AllocationResult shape ──────────────────────────────────────────────────

describe('AllocationResult structure', () => {
  it('result has mode and moves fields', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    expect(result).toHaveProperty('mode');
    expect(result).toHaveProperty('moves');
    expect(Array.isArray(result.moves)).toBe(true);
  });

  it('every move has required fields', () => {
    const result = computeAllocation(200000 as Cents, accounts, baseSettings());
    for (const move of result.moves) {
      expect(typeof move.amountCents).toBe('number');
      expect(move.rule).toBeTruthy();
      expect(move.calculation).toBeTruthy();
      expect(move.reason).toBeTruthy();
    }
  });
});
