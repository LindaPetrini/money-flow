import { describe, it, expect } from 'vitest';
import { detectMode } from './modeDetection';
import type { Account, Settings } from '@/types/domain';

// Shared fixture builder helpers
function makeBuffer(balanceCents: number): Account {
  return { id: 'buffer', name: 'Buffer', balanceCents, targetCents: 0, role: 'savings' };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    taxPct: 37,
    taxAccountId: 'tax',
    bufferAccountId: 'buffer',
    bufferTargetCents: 500000,
    overflowRatios: [{ accountId: 'savings', pct: 100 }],
    floorItems: [],
    ...overrides,
  };
}

describe('detectMode', () => {
  describe('buffer condition', () => {
    it('returns stabilize when buffer account is undefined', () => {
      const settings = makeSettings({ floorItems: [] });
      expect(detectMode(undefined, settings, '2026-02-28')).toBe('stabilize');
    });

    it('returns stabilize when buffer balance < bufferTargetCents', () => {
      const buffer = makeBuffer(400000); // below target of 500000
      const settings = makeSettings({ floorItems: [] });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('stabilize');
    });

    it('returns stabilize when buffer balance equals zero and target is positive', () => {
      const buffer = makeBuffer(0);
      const settings = makeSettings({ floorItems: [] });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('stabilize');
    });

    it('returns distribute when buffer is exactly at target and no floors', () => {
      const buffer = makeBuffer(500000); // exactly at target
      const settings = makeSettings({ floorItems: [] });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('distribute');
    });

    it('returns distribute when buffer exceeds target and no floors', () => {
      const buffer = makeBuffer(600000); // above target
      const settings = makeSettings({ floorItems: [] });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('distribute');
    });
  });

  describe('floor item condition', () => {
    it('returns stabilize when any active floor item is uncovered', () => {
      const buffer = makeBuffer(600000); // funded
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Rent', amountCents: 120000, priority: 1,
            destinationAccountId: 'checking', coveredThisMonth: false,
            active: true },
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('stabilize');
    });

    it('returns distribute when all active floor items are covered', () => {
      const buffer = makeBuffer(600000);
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Rent', amountCents: 120000, priority: 1,
            destinationAccountId: 'checking', coveredThisMonth: true,
            active: true },
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('distribute');
    });

    it('ignores inactive floor items (active: false)', () => {
      const buffer = makeBuffer(600000);
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Rent', amountCents: 120000, priority: 1,
            destinationAccountId: 'checking', coveredThisMonth: false,
            active: false }, // inactive — should not trigger stabilize
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('distribute');
    });

    it('ignores expired floor items (expiryDate < today)', () => {
      const buffer = makeBuffer(600000);
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Old subscription', amountCents: 5000, priority: 2,
            destinationAccountId: 'checking', coveredThisMonth: false,
            active: true, expiryDate: '2026-01-31' }, // expired
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('distribute');
    });

    it('includes floor item with expiryDate equal to today', () => {
      const buffer = makeBuffer(600000);
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Expiring today', amountCents: 5000, priority: 2,
            destinationAccountId: 'checking', coveredThisMonth: false,
            active: true, expiryDate: '2026-02-28' }, // expires today — still active
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('stabilize');
    });

    it('includes floor item with no expiryDate', () => {
      const buffer = makeBuffer(600000);
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Ongoing', amountCents: 50000, priority: 1,
            destinationAccountId: 'checking', coveredThisMonth: false,
            active: true }, // no expiryDate — never expires
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('stabilize');
    });
  });

  describe('buffer + floor interaction', () => {
    it('returns stabilize when buffer underfunded even if all floors covered (edge case 4)', () => {
      const buffer = makeBuffer(300000); // below target of 500000
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Rent', amountCents: 120000, priority: 1,
            destinationAccountId: 'checking', coveredThisMonth: true,
            active: true },
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('stabilize');
    });

    it('returns distribute only when buffer funded AND all floors covered', () => {
      const buffer = makeBuffer(600000);
      const settings = makeSettings({
        floorItems: [
          { id: 'f1', name: 'Rent', amountCents: 120000, priority: 1,
            destinationAccountId: 'checking', coveredThisMonth: true,
            active: true },
          { id: 'f2', name: 'Utilities', amountCents: 20000, priority: 2,
            destinationAccountId: 'checking', coveredThisMonth: true,
            active: true },
        ],
      });
      expect(detectMode(buffer, settings, '2026-02-28')).toBe('distribute');
    });
  });
});
