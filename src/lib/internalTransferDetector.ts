/**
 * internalTransferDetector.ts — Pure TypeScript module for detecting Revolut internal transfers.
 *
 * Italian Revolut exports ALL products in one CSV file. The `Prodotto` column identifies
 * the sub-account. This module detects when money moves between sub-accounts (Attuale,
 * Deposito, Risparmi, Pocket) and groups related transactions into TransferChains.
 *
 * The detection is conservative: when uncertain, it includes the chain so the user
 * can confirm rather than silently drop transactions.
 *
 * This module is pure TypeScript (no React imports) — testable in Vitest/Node.
 */

import type { RichTransaction } from './csvParser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransferChain {
  id: string;
  explanation: string;       // human-readable: "Withdrew €1,200 from Savings to pay Marta D'Elia"
  transactions: RichTransaction[];  // all transactions in this chain
  suggestedAction: 'exclude_all' | 'keep_external';
  // exclude_all: pure internal (savings deposit, self top-up) — exclude everything
  // keep_external: savings funded an external payment — keep the external payment, exclude the rest
  externalTx?: RichTransaction;  // the real expense to keep (for keep_external chains)
  confirmed: boolean;        // user confirmed this interpretation
  requiresReview: boolean;   // false = auto-confirm silently; true = show to user for confirmation
  correctionNote?: string;   // optional user note if they say interpretation is wrong
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Are two revolut_timestamp strings within N seconds of each other?
 * Handles 'YYYY-MM-DD HH:MM:SS' format.
 */
function withinSeconds(a: string, b: string, n: number): boolean {
  const da = new Date(a.replace(' ', 'T')).getTime();
  const db = new Date(b.replace(' ', 'T')).getTime();
  return Math.abs(da - db) <= n * 1000;
}

/** Format a euro amount for display: "€1,200.00" */
function fmtEur(amount: number): string {
  return `€${Math.abs(amount).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Friendly product name for display */
function productName(product: string): string {
  switch (product) {
    case 'Deposito': return 'Savings (Instant Access)';
    case 'Risparmi': return 'Birthday Savings';
    case 'Attuale': return 'Current Account';
    default: return product || 'Unknown';
  }
}

/** Check if a description matches "To <owner name>" pattern */
function isSelfTransfer(description: string, ownerNames: Set<string>): boolean {
  const m = description.match(/^to (.+)$/i);
  return !!m && ownerNames.has(m[1].trim().toLowerCase());
}

/** Generate a unique chain ID */
let chainIdCounter = 0;
function newChainId(): string {
  chainIdCounter += 1;
  return `chain-${chainIdCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

/**
 * Detect internal Revolut transfer chains from a list of RichTransactions.
 *
 * Returns an array of TransferChain objects. Each chain groups related transactions
 * that represent an internal movement of money rather than real spending.
 *
 * Transactions that are NOT part of any chain are NOT included here — they will
 * be passed to the AI analysis normally.
 *
 * @param txns - All rich transactions from parseRevolutAllTransactions
 * @returns Detected transfer chains (may be empty)
 */
export function detectInternalTransfers(txns: RichTransaction[]): TransferChain[] {
  // Reset counter for deterministic IDs in tests
  chainIdCounter = 0;

  const chains: TransferChain[] = [];
  // Track which transaction indices have been consumed into a chain
  const consumed = new Set<number>();

  // -------------------------------------------------------------------------
  // Pattern 4: Self transfers OUT (to own other bank)
  // Attuale payment with "To <name>" pattern (case-insensitive)
  // Detection before savings patterns so we don't double-count.
  // -------------------------------------------------------------------------
  // Build a name pattern from incoming transfers (Ricarica "Pagamento da <name>")
  const ownerNames = new Set<string>();
  for (const tx of txns) {
    if (tx.revolut_tipo === 'Ricarica' && tx.revolut_product === 'Attuale') {
      const match = tx.description.match(/pagamento da (.+)/i);
      if (match) ownerNames.add(match[1].trim().toLowerCase());
    }
  }

  for (let i = 0; i < txns.length; i++) {
    if (consumed.has(i)) continue;
    const tx = txns[i];
    const toMatch = tx.description.match(/^to (.+)$/i);
    if (
      tx.revolut_product === 'Attuale' &&
      toMatch &&
      ownerNames.has(toMatch[1].trim().toLowerCase())
    ) {
      consumed.add(i);
      chains.push({
        id: newChainId(),
        explanation: `Transfer to own account: "${tx.description}" ${fmtEur(tx.amountEur)}`,
        transactions: [tx],
        suggestedAction: 'exclude_all',
        requiresReview: false,
          confirmed: true,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pattern 3: Self top-ups from own bank (Ricarica from "Pagamento da <name>")
  // -------------------------------------------------------------------------
  for (let i = 0; i < txns.length; i++) {
    if (consumed.has(i)) continue;
    const tx = txns[i];
    if (
      tx.revolut_tipo === 'Ricarica' &&
      tx.revolut_product === 'Attuale' &&
      /pagamento da/i.test(tx.description)
    ) {
      consumed.add(i);
      chains.push({
        id: newChainId(),
        explanation: `Top-up from own account: "${tx.description}"`,
        transactions: [tx],
        suggestedAction: 'exclude_all',
        requiresReview: false,
          confirmed: true,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pattern 5: Balance migration
  // -------------------------------------------------------------------------
  for (let i = 0; i < txns.length; i++) {
    if (consumed.has(i)) continue;
    const tx = txns[i];
    if (/balance migration/i.test(tx.description)) {
      consumed.add(i);
      chains.push({
        id: newChainId(),
        explanation: `Revolut internal balance migration (account restructuring)`,
        transactions: [tx],
        suggestedAction: 'exclude_all',
        requiresReview: false,
          confirmed: true,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pattern 6: Pocket/sub-product withdrawals
  // -------------------------------------------------------------------------
  for (let i = 0; i < txns.length; i++) {
    if (consumed.has(i)) continue;
    const tx = txns[i];
    if (
      /prelievo da pocket/i.test(tx.description) ||
      (/prelievo/i.test(tx.description) && tx.revolut_product && tx.revolut_product !== 'Attuale')
    ) {
      consumed.add(i);
      chains.push({
        id: newChainId(),
        explanation: `Revolut Pocket withdrawal: "${tx.description}"`,
        transactions: [tx],
        suggestedAction: 'exclude_all',
        requiresReview: false,
          confirmed: true,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pattern 1: Pure savings deposits (Attuale -X + Deposito/Risparmi +X within 10s)
  // -------------------------------------------------------------------------
  for (let i = 0; i < txns.length; i++) {
    if (consumed.has(i)) continue;
    const source = txns[i];

    // Must be: Attuale negative (money leaving current account → savings)
    if (source.revolut_product !== 'Attuale') continue;
    if (source.amountEur >= 0) continue;
    if (!source.revolut_timestamp) continue;

    // Look for matching positive in Deposito or Risparmi within 10s
    for (let j = 0; j < txns.length; j++) {
      if (i === j || consumed.has(j)) continue;
      const dest = txns[j];

      if (
        (dest.revolut_product === 'Deposito' || dest.revolut_product === 'Risparmi') &&
        dest.amountEur > 0 &&
        dest.revolut_timestamp &&
        withinSeconds(source.revolut_timestamp, dest.revolut_timestamp, 10) &&
        Math.abs(Math.abs(source.amountEur) - Math.abs(dest.amountEur)) < 0.01
      ) {
        consumed.add(i);
        consumed.add(j);
        chains.push({
          id: newChainId(),
          explanation: `Deposited ${fmtEur(source.amountEur)} into ${productName(dest.revolut_product)}`,
          transactions: [source, dest],
          suggestedAction: 'exclude_all',
          requiresReview: false,
          confirmed: true,
        });
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pattern 2: Savings-funded external payment
  // Step A: Deposito/Risparmi -X + Attuale +X within 10s (savings withdrawal)
  // Step B: Attuale -Y (to external party) within 60s of step A
  // -------------------------------------------------------------------------
  for (let i = 0; i < txns.length; i++) {
    if (consumed.has(i)) continue;
    const savingsDebit = txns[i];

    // Must be: Deposito or Risparmi negative (withdrawal from savings)
    if (
      savingsDebit.revolut_product !== 'Deposito' &&
      savingsDebit.revolut_product !== 'Risparmi'
    ) continue;
    if (savingsDebit.amountEur >= 0) continue;
    if (!savingsDebit.revolut_timestamp) continue;

    // Step A: Find Attuale positive matching the savings debit (within 10s)
    let attualeCredit: RichTransaction | undefined;
    let attualeCreditIdx = -1;
    for (let j = 0; j < txns.length; j++) {
      if (j === i || consumed.has(j)) continue;
      const candidate = txns[j];
      if (
        candidate.revolut_product === 'Attuale' &&
        candidate.amountEur > 0 &&
        candidate.revolut_timestamp &&
        withinSeconds(savingsDebit.revolut_timestamp, candidate.revolut_timestamp, 10) &&
        Math.abs(Math.abs(savingsDebit.amountEur) - Math.abs(candidate.amountEur)) < 0.01
      ) {
        attualeCredit = candidate;
        attualeCreditIdx = j;
        break;
      }
    }

    if (!attualeCredit) continue;

    // Step B: Find Attuale negative (external payment) within 60s of savings debit
    let externalPayment: RichTransaction | undefined;
    let externalPaymentIdx = -1;
    for (let k = 0; k < txns.length; k++) {
      if (k === i || k === attualeCreditIdx || consumed.has(k)) continue;
      const candidate = txns[k];
      if (
        candidate.revolut_product === 'Attuale' &&
        candidate.amountEur < 0 &&
        candidate.revolut_timestamp &&
        withinSeconds(savingsDebit.revolut_timestamp, candidate.revolut_timestamp, 60) &&
        // Must NOT be another self-transfer pattern
        !isSelfTransfer(candidate.description, ownerNames) &&
        !/pagamento da/i.test(candidate.description)
      ) {
        externalPayment = candidate;
        externalPaymentIdx = k;
        break;
      }
    }

    if (externalPayment && externalPaymentIdx >= 0) {
      // Savings withdrawal → funded an external payment
      consumed.add(i);
      consumed.add(attualeCreditIdx);
      consumed.add(externalPaymentIdx);
      chains.push({
        id: newChainId(),
        explanation: `Withdrew ${fmtEur(savingsDebit.amountEur)} from ${productName(savingsDebit.revolut_product)} to pay "${externalPayment.description}"`,
        transactions: [savingsDebit, attualeCredit, externalPayment],
        suggestedAction: 'keep_external',
        externalTx: externalPayment,
        requiresReview: true,
          confirmed: false,
      });
    } else {
      // Plain savings withdrawal with no matching external payment within 60s
      consumed.add(i);
      consumed.add(attualeCreditIdx);
      chains.push({
        id: newChainId(),
        explanation: `Withdrew ${fmtEur(savingsDebit.amountEur)} from ${productName(savingsDebit.revolut_product)} to Current Account`,
        transactions: [savingsDebit, attualeCredit],
        suggestedAction: 'exclude_all',
        requiresReview: false,
          confirmed: true,
      });
    }
  }

  return chains;
}

// ---------------------------------------------------------------------------
// Helper: Build exclusion key set from confirmed chains
// ---------------------------------------------------------------------------

/**
 * Build a Set of exclusion keys from confirmed TransferChains.
 * Key format: `${date}|${description}|${Math.round(amount)}`
 *
 * For 'exclude_all' chains: all transactions are excluded.
 * For 'keep_external' chains: all transactions EXCEPT externalTx are excluded.
 *
 * @param chains - Confirmed transfer chains (confirmed === true)
 * @returns Set of exclusion keys
 */
export function buildExclusionKeys(chains: TransferChain[]): Set<string> {
  const keys = new Set<string>();

  for (const chain of chains) {
    if (!chain.confirmed) continue;

    for (const tx of chain.transactions) {
      // For keep_external chains: skip the external transaction (it's real spending)
      if (chain.suggestedAction === 'keep_external' && chain.externalTx) {
        if (
          tx.date === chain.externalTx.date &&
          tx.description === chain.externalTx.description &&
          Math.round(tx.amountEur) === Math.round(chain.externalTx.amountEur)
        ) {
          continue; // Keep this one — it's real spending
        }
      }

      keys.add(`${tx.date}|${tx.description}|${Math.round(tx.amountEur)}`);
    }
  }

  return keys;
}
