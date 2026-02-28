/**
 * Allocation Engine — three-stage financial allocation pipeline.
 *
 * Stage 1: Extract tax using pctOf (Math.floor, conservative).
 *          Residual cents from flooring stay in `remaining` — this is correct.
 *          If remaining <= 0 after tax, return early (edge case 1).
 *
 * Stage 2: Detect mode via detectMode().
 *          Buffer deficit is for MODE DETECTION only — no buffer top-up move is
 *          generated in v1. Buffer top-up is a future enhancement.
 *
 * Stage 3: Branch.
 *          Stabilize: greedy fill of active uncovered floors by priority.
 *          Distribute: splitCents across overflow ratios (largest-remainder).
 *          Empty overflowRatios: return single unallocated-surplus move (edge case 5).
 *
 * Purity contract: No React imports, no Zustand imports, no window/document/localStorage.
 * Stores call this engine; the engine never calls stores.
 */
import { pctOf, subCents, formatCents, splitCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';
import type { Account, Settings, AllocationMove } from '@/types/domain';
import { detectMode } from './modeDetection';
import { sortedActiveUncoveredFloors } from './floorCalculator';

export interface AllocationResult {
  mode: 'stabilize' | 'distribute';
  moves: AllocationMove[];
}

/**
 * Compute full allocation for an invoice amount.
 *
 * @param invoiceEurCents - Invoice amount in EUR cents (use EUR equivalent, not original currency)
 * @param accounts - All user accounts (used for buffer lookup and account name display)
 * @param settings - App settings (taxPct, bufferAccountId, bufferTargetCents, overflowRatios, floorItems)
 * @param today - ISO date string for expiry comparisons; defaults to current date
 */
export function computeAllocation(
  invoiceEurCents: Cents,
  accounts: Account[],
  settings: Settings,
  today: string = new Date().toISOString().slice(0, 10),
): AllocationResult {
  const moves: AllocationMove[] = [];

  // ── Stage 1: Tax extraction ──────────────────────────────────────────────
  // pctOf uses Math.floor (conservative). Residual cents flow to next stage.
  const taxAmount = pctOf(invoiceEurCents, settings.taxPct);
  moves.push({
    destinationAccountId: settings.taxAccountId,
    amountCents: taxAmount as number,
    rule: 'tax',
    calculation: `${settings.taxPct}% of ${formatCents(invoiceEurCents)} = ${formatCents(taxAmount)}`,
    reason: `Tax withholding (${settings.taxPct}% rule)`,
  });

  let remaining = subCents(invoiceEurCents, taxAmount);

  // Edge case 1: invoice too small to leave anything after tax — return early
  if (remaining <= 0) {
    const bufferAccount = accounts.find(a => a.id === settings.bufferAccountId);
    const mode = detectMode(bufferAccount, settings, today);
    return { mode, moves };
  }

  // ── Stage 2: Mode detection ──────────────────────────────────────────────
  const bufferAccount = accounts.find(a => a.id === settings.bufferAccountId);
  const mode = detectMode(bufferAccount, settings, today);

  // ── Stage 3: Branch ──────────────────────────────────────────────────────
  if (mode === 'stabilize') {
    const stageMoves = stabilize(remaining, settings, today);
    moves.push(...stageMoves);
  } else {
    const stageMoves = distribute(remaining, settings);
    moves.push(...stageMoves);
  }

  return { mode, moves };
}

/**
 * Stabilize branch: greedy fill of active uncovered floors by priority.
 * Allocates Math.min(remaining, floorItem.amountCents) to each floor in order.
 * Stops when remaining reaches 0 or all qualifying floors are processed.
 *
 * NOTE: The engine generates the move with the actual amount transferred.
 * Marking coveredThisMonth is a side effect performed by settingsStore.confirmAllocation —
 * never by the engine itself.
 */
function stabilize(
  remaining: Cents,
  settings: Settings,
  today: string,
): AllocationMove[] {
  const moves: AllocationMove[] = [];
  const floors = sortedActiveUncoveredFloors(settings.floorItems, today);

  for (const floor of floors) {
    if (remaining <= 0) break;

    const allocation = Math.min(remaining, floor.amountCents) as Cents;
    const isPartial = allocation < floor.amountCents;

    moves.push({
      destinationAccountId: floor.destinationAccountId,
      amountCents: allocation as number,
      rule: 'floor',
      calculation: `Floor "${floor.name}": ${formatCents(allocation)} of ${formatCents(floor.amountCents as Cents)}`,
      reason: `Priority ${floor.priority} floor item — ${isPartial ? 'partial (invoice exhausted)' : 'fully funded'}`,
    });

    remaining = subCents(remaining, allocation);
  }

  return moves;
}

/**
 * Distribute branch: split remaining cents across overflow ratios.
 * Uses splitCents (largest-remainder) — guaranteed to sum exactly to `remaining`.
 *
 * Edge case 5: empty overflowRatios → return a single unallocated-surplus move.
 * Do NOT silently drop the remaining cents.
 */
function distribute(
  remaining: Cents,
  settings: Settings,
): AllocationMove[] {
  const { overflowRatios } = settings;

  // Edge case 5: no overflow ratios configured yet
  if (overflowRatios.length === 0) {
    return [
      {
        destinationAccountId: '',
        amountCents: remaining as number,
        rule: 'unallocated',
        calculation: `${formatCents(remaining)} — no overflow ratios configured`,
        reason: 'Surplus unallocated: configure overflow ratios to distribute this amount',
      },
    ];
  }

  const ratioWeights = overflowRatios.map(r => r.pct);
  const splits = splitCents(remaining, ratioWeights);

  return overflowRatios.map((ratio, i) => ({
    destinationAccountId: ratio.accountId,
    amountCents: splits[i] as number,
    rule: 'distribute',
    calculation: `${ratio.pct}% of ${formatCents(remaining)} = ${formatCents(splits[i])}`,
    reason: `Surplus distribution (${ratio.pct}% overflow ratio)`,
  }));
}
