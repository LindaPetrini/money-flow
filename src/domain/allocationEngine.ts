/**
 * Allocation Engine — three-stage pipeline.
 *
 * Stage 1: Extract tax using pctOf (Math.floor, conservative).
 *          Residual cents from flooring stay in `remaining`.
 *          If remaining <= 0 after tax, return early.
 *
 * Stage 2: Fill accounts toward their targetCents (if set and balance < target).
 *          If total gap <= remaining: fill all targets exactly.
 *          If total gap > remaining: fill pro-rata (splitCents across gaps).
 *
 * Stage 3: Distribute remaining across overflow ratios (post-tax splits).
 *          Uses splitCents (largest-remainder) — guaranteed to sum exactly.
 *          Empty overflowRatios: return single unallocated move.
 *
 * Purity contract: No React, no Zustand, no DOM access.
 */
import { pctOf, subCents, formatCents, splitCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';
import type { Account, Settings, AllocationMove } from '@/types/domain';

export interface AllocationResult {
  mode: 'distribute';
  moves: AllocationMove[];
}

/**
 * Compute full allocation for an invoice amount.
 *
 * @param invoiceEurCents - Invoice amount in EUR cents
 * @param accounts - All accounts (used to read targetCents and current balanceCents)
 * @param settings - App settings (taxPct, taxAccountId, overflowRatios)
 */
export function computeAllocation(
  invoiceEurCents: Cents,
  accounts: Account[],
  settings: Settings,
): AllocationResult {
  const moves: AllocationMove[] = [];

  // ── Stage 1: Tax extraction ──────────────────────────────────────────────
  const taxAmount = pctOf(invoiceEurCents, settings.taxPct);
  moves.push({
    destinationAccountId: settings.taxAccountId,
    amountCents: taxAmount as number,
    rule: 'tax',
    calculation: `${settings.taxPct}% of ${formatCents(invoiceEurCents)} = ${formatCents(taxAmount)}`,
    reason: `Tax withholding (${settings.taxPct}%)`,
  });

  let remaining = subCents(invoiceEurCents, taxAmount);

  // Edge case: invoice too small to leave anything after tax
  if (remaining <= 0) {
    return { mode: 'distribute', moves };
  }

  // ── Stage 2: Fill accounts toward their targets ──────────────────────────
  const targetMoves = fillTargets(remaining, accounts, settings);
  if (targetMoves.length > 0) {
    const filledTotal = targetMoves.reduce((sum, m) => sum + m.amountCents, 0);
    moves.push(...targetMoves);
    remaining = subCents(remaining, filledTotal as Cents);
  }

  if (remaining <= 0) {
    return { mode: 'distribute', moves };
  }

  // ── Stage 3: Distribute remainder ────────────────────────────────────────
  const stageMoves = distribute(remaining, settings);
  moves.push(...stageMoves);

  return { mode: 'distribute', moves };
}

/**
 * Fill accounts that are below their target balance (pro-rata if not enough to fill all).
 * Only considers accounts that are in overflowRatios (i.e. user-managed accounts).
 * Tax account is skipped.
 */
function fillTargets(remaining: Cents, accounts: Account[], settings: Settings): AllocationMove[] {
  const accountMap = new Map(accounts.map(a => [a.id, a]));

  // Find accounts with an unmet target, excluding tax account
  const candidates = settings.overflowRatios
    .map(r => accountMap.get(r.accountId))
    .filter((a): a is Account =>
      a !== undefined &&
      a.id !== settings.taxAccountId &&
      a.targetCents > 0 &&
      a.balanceCents < a.targetCents,
    );

  if (candidates.length === 0) return [];

  const gaps = candidates.map(a => a.targetCents - a.balanceCents);
  const totalGap = gaps.reduce((sum, g) => sum + g, 0) as Cents;
  const amountToFill = Math.min(remaining as number, totalGap as number) as Cents;

  const fills = totalGap <= remaining
    ? gaps  // exact fill
    : splitCents(amountToFill, gaps).map(n => n as number); // pro-rata

  return candidates.map((a, i) => {
    const fill = fills[i];
    const isPro = totalGap > remaining;
    return {
      destinationAccountId: a.id,
      amountCents: fill,
      rule: 'fill-target',
      calculation: isPro
        ? `${formatCents(fill as Cents)} toward target (pro-rata, ${formatCents(totalGap)} needed)`
        : `Fill to target: ${formatCents(a.balanceCents as Cents)} → ${formatCents(a.targetCents as Cents)}`,
      reason: isPro
        ? `${a.name}: partial fill toward target (not enough to fill all targets)`
        : `${a.name}: fill to target`,
    };
  });
}

function distribute(remaining: Cents, settings: Settings): AllocationMove[] {
  const { overflowRatios } = settings;

  if (overflowRatios.length === 0) {
    return [
      {
        destinationAccountId: '',
        amountCents: remaining as number,
        rule: 'unallocated',
        calculation: `${formatCents(remaining)} — no splits configured`,
        reason: 'No budget splits configured. Go to Settings → Budget Splits to set them up.',
      },
    ];
  }

  const ratioWeights = overflowRatios.map(r => r.pct);
  const totalPct = ratioWeights.reduce((s, p) => s + p, 0);

  // If ratios sum to < 100%, only distribute the covered portion.
  // splitCents always distributes 100% of its input, so we must pass only the
  // portion we want distributed; the rest is unallocated.
  const toDistribute = totalPct >= 100
    ? remaining
    : Math.round(((remaining as number) * totalPct) / 100) as Cents;
  const leftover = (remaining as number) - (toDistribute as number);

  const splits = splitCents(toDistribute, ratioWeights);

  const moves: AllocationMove[] = overflowRatios.map((ratio, i) => ({
    destinationAccountId: ratio.accountId,
    amountCents: splits[i] as number,
    rule: 'distribute',
    calculation: `${ratio.pct}% of ${formatCents(remaining)} = ${formatCents(splits[i])}`,
    reason: `Budget split (${ratio.pct}% of post-tax)`,
  }));

  // If ratios sum to less than 100%, the leftover stays in income hub (unallocated)
  if (leftover > 0) {
    const unallocatedPct = (100 - totalPct).toFixed(1);
    moves.push({
      destinationAccountId: '',
      amountCents: leftover,
      rule: 'unallocated',
      calculation: `${formatCents(leftover as Cents)} — ${unallocatedPct}% unallocated`,
      reason: 'Unallocated remainder — stays in income account',
    });
  }

  return moves;
}
