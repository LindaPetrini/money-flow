export type AccountRole = 'income-hub' | 'spending' | 'savings' | 'tax' | 'investing';

export interface Account {
  id: string;
  name: string;
  balanceCents: number;   // integer cents — always
  targetCents: number;    // target balance in cents; 0 = no target
  role: AccountRole;
}

export interface OverflowRatio {
  accountId: string;
  pct: number;            // 0-100; must not exceed 100 total (of post-tax income)
}

export interface ConfirmedRecurring {
  merchant: string;
  frequency: 'monthly' | 'yearly';
  chargeAmountCents: number;  // the actual charge amount per occurrence (in cents)
  monthlyAmountCents: number; // monthly equivalent: = chargeAmount if monthly, /12 if yearly
}

export interface Settings {
  taxPct: number;         // default 30; 0-100
  taxAccountId: string;
  overflowRatios: OverflowRatio[];  // how to split post-tax income
  confirmedRecurring: ConfirmedRecurring[];  // user-confirmed recurring expenses
  theme?: 'light' | 'dark' | 'system';
}

export interface AllocationMove {
  destinationAccountId: string;
  amountCents: number;
  rule: string;           // e.g. "tax" | "distribute" | "unallocated"
  calculation: string;    // e.g. "30% of €5,000 = €1,500"
  reason: string;         // human-readable explanation
}

export interface AllocationRecord {
  id: string;
  date: string;           // ISO date string
  invoiceAmountCents: number;
  invoiceCurrency: string;
  invoiceEurEquivalentCents: number;
  mode: 'stabilize' | 'distribute';  // kept for history backward-compat
  moves: AllocationMove[];
  source?: string;        // client/project name
}
