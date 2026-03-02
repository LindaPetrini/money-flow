import type { Account, Settings, AllocationRecord } from './domain';

// Persistence shapes mirror domain shapes.
// These aliases allow them to diverge in future without touching domain.ts.
export type PersistedAccounts = Account[];
export type PersistedSettings = Settings;
export type PersistedHistory = AllocationRecord[];
