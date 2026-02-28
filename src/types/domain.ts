export type AccountRole = 'income-hub' | 'spending' | 'savings' | 'tax' | 'investing';

export interface Account {
  id: string;
  name: string;
  balanceCents: number;   // integer cents — always
  targetCents: number;    // target balance in cents; 0 = no target
  role: AccountRole;
}

export interface FloorItem {
  id: string;
  name: string;
  amountCents: number;    // monthly amount in cents
  priority: number;       // lower = higher priority
  destinationAccountId: string;
  coveredThisMonth: boolean;
  expiryDate?: string;    // ISO date string; undefined = no expiry
  active: boolean;
}

export interface OverflowRatio {
  accountId: string;
  pct: number;            // 0-100; all overflow ratios must sum to 100
}

export interface Settings {
  taxPct: number;         // default 37; 0-100
  taxAccountId: string;
  bufferAccountId: string;
  bufferTargetCents: number;
  overflowRatios: OverflowRatio[];
  floorItems: FloorItem[];
}

export interface AllocationMove {
  destinationAccountId: string;
  amountCents: number;
  rule: string;           // e.g. "tax" | "floor" | "distribute"
  calculation: string;    // e.g. "37% of €2,000 = €740"
  reason: string;         // human-readable explanation
}

export interface AllocationRecord {
  id: string;
  date: string;           // ISO date string
  invoiceAmountCents: number;
  invoiceCurrency: string;
  invoiceEurEquivalentCents: number;
  mode: 'stabilize' | 'distribute';
  moves: AllocationMove[];
}
