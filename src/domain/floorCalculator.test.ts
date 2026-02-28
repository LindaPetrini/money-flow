import { describe, it, expect } from 'vitest';
import type { Cents } from '@/lib/cents';
import { sortedActiveUncoveredFloors, totalUncoveredCents } from './floorCalculator';
import type { FloorItem } from '@/types/domain';

// Fixture factory
function makeFloor(overrides: Partial<FloorItem> & { id: string }): FloorItem {
  return {
    name: 'Test Floor',
    amountCents: 100000,
    priority: 1,
    destinationAccountId: 'checking',
    coveredThisMonth: false,
    active: true,
    ...overrides,
  };
}

const TODAY = '2026-02-28';

describe('sortedActiveUncoveredFloors', () => {
  it('returns empty array when floorItems is empty', () => {
    expect(sortedActiveUncoveredFloors([], TODAY)).toEqual([]);
  });

  it('returns single qualifying item unchanged', () => {
    const floor = makeFloor({ id: 'f1', priority: 1 });
    const result = sortedActiveUncoveredFloors([floor], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('excludes items where active is false', () => {
    const active = makeFloor({ id: 'f1', active: true });
    const inactive = makeFloor({ id: 'f2', active: false });
    const result = sortedActiveUncoveredFloors([active, inactive], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('excludes items where coveredThisMonth is true', () => {
    const uncovered = makeFloor({ id: 'f1', coveredThisMonth: false });
    const covered = makeFloor({ id: 'f2', coveredThisMonth: true });
    const result = sortedActiveUncoveredFloors([uncovered, covered], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('excludes items where expiryDate < today (edge case 6: expired floor)', () => {
    const valid = makeFloor({ id: 'f1' });
    const expired = makeFloor({ id: 'f2', expiryDate: '2026-01-31' });
    const result = sortedActiveUncoveredFloors([valid, expired], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('includes items where expiryDate equals today (boundary: expires today = still active)', () => {
    const expirestoday = makeFloor({ id: 'f1', expiryDate: '2026-02-28' });
    const result = sortedActiveUncoveredFloors([expirestoday], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('includes items where expiryDate is in the future', () => {
    const future = makeFloor({ id: 'f1', expiryDate: '2026-12-31' });
    const result = sortedActiveUncoveredFloors([future], TODAY);
    expect(result).toHaveLength(1);
  });

  it('includes items with no expiryDate (undefined = never expires)', () => {
    const noExpiry = makeFloor({ id: 'f1' }); // no expiryDate field
    const result = sortedActiveUncoveredFloors([noExpiry], TODAY);
    expect(result).toHaveLength(1);
  });

  it('sorts by priority ascending: lower number = higher priority = first', () => {
    const low = makeFloor({ id: 'low', priority: 3 });
    const high = makeFloor({ id: 'high', priority: 1 });
    const mid = makeFloor({ id: 'mid', priority: 2 });
    const result = sortedActiveUncoveredFloors([low, mid, high], TODAY);
    expect(result.map(f => f.id)).toEqual(['high', 'mid', 'low']);
  });

  it('does not mutate the original array order', () => {
    const floors: FloorItem[] = [
      makeFloor({ id: 'f3', priority: 3 }),
      makeFloor({ id: 'f1', priority: 1 }),
      makeFloor({ id: 'f2', priority: 2 }),
    ];
    const originalOrder = floors.map(f => f.id);
    sortedActiveUncoveredFloors(floors, TODAY);
    expect(floors.map(f => f.id)).toEqual(originalOrder);
  });

  it('applies all three filters together: excludes inactive, covered, and expired', () => {
    const valid = makeFloor({ id: 'valid' });
    const inactive = makeFloor({ id: 'inactive', active: false });
    const covered = makeFloor({ id: 'covered', coveredThisMonth: true });
    const expired = makeFloor({ id: 'expired', expiryDate: '2025-12-31' });
    const result = sortedActiveUncoveredFloors([valid, inactive, covered, expired], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('valid');
  });
});

describe('totalUncoveredCents', () => {
  it('returns 0 for empty array', () => {
    expect(totalUncoveredCents([], TODAY)).toBe(0);
  });

  it('sums amountCents of all qualifying floor items', () => {
    const f1 = makeFloor({ id: 'f1', amountCents: 120000 });
    const f2 = makeFloor({ id: 'f2', amountCents: 20000 });
    expect(totalUncoveredCents([f1, f2], TODAY)).toBe(140000);
  });

  it('excludes covered items from the sum', () => {
    const uncovered = makeFloor({ id: 'f1', amountCents: 120000 });
    const covered = makeFloor({ id: 'f2', amountCents: 50000, coveredThisMonth: true });
    expect(totalUncoveredCents([uncovered, covered], TODAY)).toBe(120000);
  });

  it('excludes expired items from the sum', () => {
    const valid = makeFloor({ id: 'f1', amountCents: 100000 });
    const expired = makeFloor({ id: 'f2', amountCents: 50000, expiryDate: '2025-06-01' });
    expect(totalUncoveredCents([valid, expired], TODAY)).toBe(100000);
  });

  it('returns 0 when all items are excluded', () => {
    const covered = makeFloor({ id: 'f1', amountCents: 100000, coveredThisMonth: true });
    const inactive = makeFloor({ id: 'f2', amountCents: 50000, active: false });
    expect(totalUncoveredCents([covered, inactive], TODAY)).toBe(0);
  });
});
