/**
 * Floor item querying and sorting for the allocation engine.
 *
 * Extracted from allocationEngine.ts to keep querying logic isolated and
 * independently testable. The engine calls sortedActiveUncoveredFloors to
 * get the ordered list of floors to fill in Stabilize mode.
 *
 * Both functions are pure: data-in, data-out, no side effects.
 * `today` is a parameter to enable deterministic date-sensitive testing.
 */
import type { FloorItem } from '@/types/domain';
import type { Cents } from '@/lib/cents';
import { addCents } from '@/lib/cents';

/**
 * Returns active, uncovered, non-expired floor items sorted by priority ascending.
 * Lower priority number = higher priority = appears first in the result.
 *
 * Filtering rules:
 * - f.active must be true
 * - f.coveredThisMonth must be false
 * - f.expiryDate must be undefined (no expiry) OR >= today (not yet expired)
 */
export function sortedActiveUncoveredFloors(
  floorItems: FloorItem[],
  today: string = new Date().toISOString().slice(0, 10),
): FloorItem[] {
  return floorItems
    .filter(
      f =>
        f.active &&
        !f.coveredThisMonth &&
        (!f.expiryDate || f.expiryDate >= today),
    )
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Returns the sum of amountCents for all qualifying floor items.
 * Used for transparency reporting (e.g., "€1,400 still needed to stabilize").
 * Applies the same filter rules as sortedActiveUncoveredFloors.
 */
export function totalUncoveredCents(
  floorItems: FloorItem[],
  today: string = new Date().toISOString().slice(0, 10),
): Cents {
  return sortedActiveUncoveredFloors(floorItems, today).reduce(
    (sum, f) => addCents(sum, f.amountCents as Cents),
    0 as Cents,
  );
}
