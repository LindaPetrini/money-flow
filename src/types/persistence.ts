import type { Account, Settings, AllocationRecord } from './domain';

// In v1 the persistence shapes are identical to domain shapes.
// These aliases exist to allow them to diverge in future without touching domain.ts.
export type PersistedAccounts = Account[];
export type PersistedSettings = Settings;
export type PersistedHistory = AllocationRecord[];
