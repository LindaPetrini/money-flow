import type { Account, Settings } from '@/types/domain';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-tax',       name: 'Tax',        balanceCents: 0, targetCents: 0, role: 'tax' },
  { id: 'acc-everyday',  name: 'Essentials', balanceCents: 0, targetCents: 0, role: 'spending' },
  { id: 'acc-fun',       name: 'Fun',        balanceCents: 0, targetCents: 0, role: 'spending' },
  { id: 'acc-savings',   name: 'Savings',    balanceCents: 0, targetCents: 0, role: 'savings' },
  { id: 'acc-investing', name: 'Investing',  balanceCents: 0, targetCents: 0, role: 'investing' },
];

export const DEFAULT_SETTINGS: Settings = {
  taxPct: 30,
  taxAccountId: 'acc-tax',
  overflowRatios: [
    { accountId: 'acc-everyday',  pct: 60 },
    { accountId: 'acc-fun',       pct: 20 },
    { accountId: 'acc-savings',   pct: 10 },
    { accountId: 'acc-investing', pct: 10 },
  ],
  confirmedRecurring: [],
};
