/**
 * Mode detection for the allocation engine.
 *
 * Determines whether the engine should run in Stabilize or Distribute mode.
 * Stabilize: buffer underfunded OR any active uncovered floor item exists.
 * Distribute: buffer funded AND all active, non-expired floor items are covered.
 *
 * This function is pure — no side effects, no browser globals.
 * `today` is a parameter to enable deterministic testing.
 *
 * NOTE: Buffer deficit does NOT generate its own allocation move in Stabilize mode.
 * The buffer balance is used for MODE DETECTION only. Buffer top-up is a future
 * enhancement — for v1, Stabilize mode covers floor items only.
 */
import type { Account, Settings } from '@/types/domain';

export function detectMode(
  bufferAccount: Account | undefined,
  settings: Settings,
  today: string = new Date().toISOString().slice(0, 10),
): 'stabilize' | 'distribute' {
  // Condition 1: Buffer unfunded → Stabilize
  if (!bufferAccount || bufferAccount.balanceCents < settings.bufferTargetCents) {
    return 'stabilize';
  }

  // Condition 2: Any active, non-expired, uncovered floor item → Stabilize
  const hasUncoveredFloor = settings.floorItems.some(
    f =>
      f.active &&
      !f.coveredThisMonth &&
      (!f.expiryDate || f.expiryDate >= today),
  );

  return hasUncoveredFloor ? 'stabilize' : 'distribute';
}
