import { describe, it, expect } from 'vitest';
import type { Cents } from '@/lib/cents';
import { computeAllocation } from './allocationEngine';
import type { Account, Settings, FloorItem } from '@/types/domain';

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeAccount(id: string, balanceCents: number, role: string = 'savings'): Account {
  return { id, name: id, balanceCents, targetCents: 0, role: role as Account['role'] };
}

function makeFloor(id: string, amountCents: number, priority: number, overrides: Partial<FloorItem> = {}): FloorItem {
  return {
    id,
    name: id,
    amountCents,
    priority,
    destinationAccountId: `acct-${id}`,
    coveredThisMonth: false,
    active: true,
    ...overrides,
  };
}

// Base settings — buffer funded, no floors, 2 overflow buckets
function baseSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    taxPct: 37,
    taxAccountId: 'tax',
    bufferAccountId: 'buffer',
    bufferTargetCents: 500000,
    overflowRatios: [
      { accountId: 'savings', pct: 50 },
      { accountId: 'invest', pct: 50 },
    ],
    floorItems: [],
    ...overrides,
  };
}

// Buffer funded at exactly target
const fundedBuffer = makeAccount('buffer', 500000);
// Buffer below target
const emptyBuffer = makeAccount('buffer', 0);
// Tax account
const taxAccount = makeAccount('tax', 0, 'tax');

const TODAY = '2026-02-28';

// ─── Tax extraction (ALLOC-04) ───────────────────────────────────────────────

describe('computeAllocation — tax extraction', () => {
  it('first move is always tax', () => {
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    expect(result.moves[0].rule).toBe('tax');
  });

  it('tax amount uses pctOf (Math.floor): 37% of 200000 = 74000', () => {
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    expect(result.moves[0].amountCents).toBe(74000);
  });

  it('tax move destination is taxAccountId from settings', () => {
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    expect(result.moves[0].destinationAccountId).toBe('tax');
  });

  it('tax move has non-empty calculation, rule, and reason strings', () => {
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    const taxMove = result.moves[0];
    expect(taxMove.calculation).toBeTruthy();
    expect(taxMove.rule).toBe('tax');
    expect(taxMove.reason).toBeTruthy();
    // calculation should contain the percentage
    expect(taxMove.calculation).toContain('37');
  });
});

// ─── Edge case 1: Invoice < tax → remaining = 0 ──────────────────────────────

describe('edge case 1: invoice smaller than tax threshold', () => {
  it('returns only a tax move when invoice covers only tax', () => {
    // 500 cents at 37% tax = 185 cents tax, remaining = 315 cents
    // Use an extreme case: 100 cents at 37% = 37 cents tax, remaining = 63 cents
    // For remaining=0 we need invoice <= tax amount, but pctOf floors
    // Use: 1 cent invoice — 37% of 1 = 0 (floors), tax=0, so this won't trigger
    // Better: use a very small invoice vs large tax
    // Invoice 200 cents, 37% = 74 cents tax. remaining=126. Not zero.
    // To get remaining=0 after tax: invoice must equal pctOf(invoice, taxPct)
    // Since pctOf floors, the cleanest way is taxPct=100 for test:
    const settings = baseSettings({ taxPct: 100 }); // 100% tax
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(50000 as Cents, accounts, settings, TODAY);
    // 100% of 50000 = 50000, remaining = 0
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].rule).toBe('tax');
    expect(result.moves[0].amountCents).toBe(50000);
  });

  it('returns only tax move for invoice smaller than tax, no floor or distribute moves', () => {
    // taxPct=100 with floors defined — still only 1 move
    const settings = baseSettings({
      taxPct: 100,
      floorItems: [makeFloor('rent', 120000, 1)],
    });
    const accounts = [emptyBuffer, taxAccount];
    const result = computeAllocation(10000 as Cents, accounts, settings, TODAY);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].rule).toBe('tax');
  });
});

// ─── Edge case 2: Stabilize — partial floor fill by priority ─────────────────

describe('edge case 2: stabilize mode — partial floor fill by priority', () => {
  it('mode is stabilize when floors are uncovered', () => {
    const settings = baseSettings({
      floorItems: [makeFloor('rent', 120000, 1)],
    });
    const accounts = [fundedBuffer, taxAccount, makeAccount('acct-rent', 0)];
    const result = computeAllocation(200000 as Cents, accounts, settings, TODAY);
    expect(result.mode).toBe('stabilize');
  });

  it('generates floor moves in priority order (priority 1 before priority 2)', () => {
    const settings = baseSettings({
      floorItems: [
        makeFloor('utilities', 20000, 2),  // lower priority
        makeFloor('rent', 120000, 1),      // higher priority
      ],
    });
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(250000 as Cents, accounts, settings, TODAY);
    const floorMoves = result.moves.filter(m => m.rule === 'floor');
    expect(floorMoves[0].destinationAccountId).toBe('acct-rent');
    expect(floorMoves[1].destinationAccountId).toBe('acct-utilities');
  });

  it('stops generating floor moves when remaining reaches 0', () => {
    // Invoice 200k, 37% tax = 74k, remaining = 126k
    // Floor 1: rent = 120k (funded, remaining = 6k)
    // Floor 2: utilities = 20k (partially funded, only 6k remains)
    // Floor 3: phone = 5k — not reached because remaining = 0 after partial utilities
    const settings = baseSettings({
      floorItems: [
        makeFloor('rent', 120000, 1),
        makeFloor('utilities', 20000, 2),
        makeFloor('phone', 5000, 3),
      ],
    });
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, settings, TODAY);
    const floorMoves = result.moves.filter(m => m.rule === 'floor');
    // rent: 120000, utilities: 6000 (partial), phone: 0 (not reached)
    expect(floorMoves).toHaveLength(2);
    expect(floorMoves[0].amountCents).toBe(120000); // rent fully funded
    expect(floorMoves[1].amountCents).toBe(6000);   // utilities partial
  });

  it('floor moves have non-empty calculation and reason', () => {
    const settings = baseSettings({
      floorItems: [makeFloor('rent', 120000, 1)],
    });
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(300000 as Cents, accounts, settings, TODAY);
    const floorMove = result.moves.find(m => m.rule === 'floor');
    expect(floorMove).toBeDefined();
    expect(floorMove!.calculation).toBeTruthy();
    expect(floorMove!.reason).toBeTruthy();
  });
});

// ─── Edge case 3: Distribute — splits sum exactly ────────────────────────────

describe('edge case 3: distribute mode — splits sum exactly to remaining', () => {
  it('mode is distribute when buffer funded and no uncovered floors', () => {
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    expect(result.mode).toBe('distribute');
  });

  it('distribute moves sum exactly to post-tax remaining', () => {
    // 200000 invoice, 37% tax = 74000, remaining = 126000
    // split 50/50 → 63000 + 63000 = 126000 exactly
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    const distMoves = result.moves.filter(m => m.rule === 'distribute');
    const distSum = distMoves.reduce((sum, m) => sum + m.amountCents, 0);
    expect(distSum).toBe(126000);
  });

  it('distribute handles odd cent counts exactly (largest-remainder)', () => {
    // 100001 cents, 37% tax = 37000 (floor), remaining = 63001
    // split 3 ways [33, 33, 34] or similar — must sum to 63001
    const settings = baseSettings({
      overflowRatios: [
        { accountId: 'a', pct: 33 },
        { accountId: 'b', pct: 33 },
        { accountId: 'c', pct: 34 },
      ],
    });
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(100001 as Cents, accounts, settings, TODAY);
    const distMoves = result.moves.filter(m => m.rule === 'distribute');
    const distSum = distMoves.reduce((sum, m) => sum + m.amountCents, 0);
    const taxAmount = result.moves[0].amountCents;
    expect(distSum).toBe(100001 - taxAmount);
  });

  it('distribute moves have non-empty calculation and reason', () => {
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    const distMoves = result.moves.filter(m => m.rule === 'distribute');
    for (const move of distMoves) {
      expect(move.calculation).toBeTruthy();
      expect(move.reason).toBeTruthy();
      expect(move.calculation).toContain('%');
    }
  });
});

// ─── Edge case 4: Buffer unfunded overrides all-floors-covered ───────────────

describe('edge case 4: buffer unfunded forces stabilize even if all floors covered', () => {
  it('returns stabilize mode when buffer is below target despite covered floors', () => {
    const settings = baseSettings({
      floorItems: [
        makeFloor('rent', 120000, 1, { coveredThisMonth: true }),
      ],
    });
    const accounts = [emptyBuffer, taxAccount]; // buffer not funded
    const result = computeAllocation(200000 as Cents, accounts, settings, TODAY);
    expect(result.mode).toBe('stabilize');
  });

  it('generates no floor moves when all floors covered (but still in stabilize due to buffer)', () => {
    const settings = baseSettings({
      floorItems: [
        makeFloor('rent', 120000, 1, { coveredThisMonth: true }),
      ],
    });
    const accounts = [emptyBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, settings, TODAY);
    const floorMoves = result.moves.filter(m => m.rule === 'floor');
    // No uncovered floors → no floor moves (buffer deficit is for detection only, no buffer move)
    expect(floorMoves).toHaveLength(0);
  });
});

// ─── Edge case 5: Empty overflowRatios in Distribute mode ────────────────────

describe('edge case 5: distribute mode with empty overflowRatios', () => {
  it('returns an unallocated-surplus move instead of silently dropping cents', () => {
    const settings = baseSettings({ overflowRatios: [] }); // no ratios configured
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, settings, TODAY);
    // Should NOT silently drop the 126000 remaining cents
    const allMovesCents = result.moves.reduce((sum, m) => sum + m.amountCents, 0);
    expect(allMovesCents).toBe(200000);
    // The unallocated move should exist
    const unallocated = result.moves.find(m => m.rule === 'unallocated');
    expect(unallocated).toBeDefined();
    expect(unallocated!.amountCents).toBe(126000); // 200000 - 74000 tax
  });
});

// ─── Edge case 6: Expired floor items excluded ───────────────────────────────

describe('edge case 6: expired floor items excluded from stabilize processing', () => {
  it('excludes floor items with expiryDate before today', () => {
    const expiredFloor = makeFloor('old-sub', 50000, 1, { expiryDate: '2026-01-31' });
    const activeFloor = makeFloor('rent', 120000, 2);
    const settings = baseSettings({ floorItems: [expiredFloor, activeFloor] });
    const accounts = [emptyBuffer, taxAccount]; // stabilize mode
    const result = computeAllocation(300000 as Cents, accounts, settings, TODAY);
    const floorMoves = result.moves.filter(m => m.rule === 'floor');
    // Only rent should appear — expired old-sub excluded
    const destIds = floorMoves.map(m => m.destinationAccountId);
    expect(destIds).not.toContain('acct-old-sub');
    expect(destIds).toContain('acct-rent');
  });

  it('includes floor items with expiryDate equal to today', () => {
    const expirestoday = makeFloor('subscription', 20000, 1, { expiryDate: TODAY });
    const settings = baseSettings({ floorItems: [expirestoday] });
    const accounts = [emptyBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, settings, TODAY);
    const floorMoves = result.moves.filter(m => m.rule === 'floor');
    expect(floorMoves).toHaveLength(1);
    expect(floorMoves[0].destinationAccountId).toBe('acct-subscription');
  });
});

// ─── AllocationResult shape ──────────────────────────────────────────────────

describe('AllocationResult structure', () => {
  it('result has mode and moves fields', () => {
    const accounts = [fundedBuffer, taxAccount];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings(), TODAY);
    expect(result).toHaveProperty('mode');
    expect(result).toHaveProperty('moves');
    expect(Array.isArray(result.moves)).toBe(true);
  });

  it('every move has destinationAccountId, amountCents, rule, calculation, reason', () => {
    const settings = baseSettings({
      floorItems: [makeFloor('rent', 60000, 1)],
    });
    const accounts = [emptyBuffer, taxAccount];
    const result = computeAllocation(300000 as Cents, accounts, settings, TODAY);
    for (const move of result.moves) {
      expect(move.destinationAccountId).toBeTruthy();
      expect(typeof move.amountCents).toBe('number');
      expect(move.rule).toBeTruthy();
      expect(move.calculation).toBeTruthy();
      expect(move.reason).toBeTruthy();
    }
  });
});
