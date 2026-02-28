import type { Account, Settings } from '@/types/domain';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-tax',       name: 'Tax Bucket', balanceCents: 0, targetCents: 0,      role: 'tax' },
  { id: 'acc-everyday',  name: 'Everyday',   balanceCents: 0, targetCents: 300000, role: 'spending' },
  { id: 'acc-fun',       name: 'Fun',        balanceCents: 0, targetCents: 100000, role: 'spending' },
  { id: 'acc-savings',   name: 'Savings',    balanceCents: 0, targetCents: 500000, role: 'savings' },
  { id: 'acc-investing', name: 'Investing',  balanceCents: 0, targetCents: 0,      role: 'investing' },
];

export const DEFAULT_SETTINGS: Settings = {
  taxPct: 37,
  taxAccountId: 'acc-tax',
  bufferAccountId: 'acc-everyday',
  bufferTargetCents: 300000,
  overflowRatios: [
    { accountId: 'acc-everyday',  pct: 40 },
    { accountId: 'acc-fun',       pct: 15 },
    { accountId: 'acc-savings',   pct: 30 },
    { accountId: 'acc-investing', pct: 15 },
  ],
  floorItems: [
    {
      id: 'floor-rent',
      name: 'Rent',
      amountCents: 120000,
      priority: 1,
      destinationAccountId: 'acc-everyday',
      coveredThisMonth: false,
      active: true,
    },
  ],
};
