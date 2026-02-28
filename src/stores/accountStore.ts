import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';
import type { Account } from '@/types/domain';
import type { PersistedAccounts } from '@/types/persistence';

interface AccountState {
  initialized: boolean;
  accounts: Account[];
  loadAccounts: () => Promise<void>;
  setAccounts: (accounts: Account[]) => Promise<void>;
  updateBalance: (id: string, newCents: number) => Promise<void>;
}

export const useAccountStore = create<AccountState>()((set, get) => ({
  initialized: false,
  accounts: [],

  loadAccounts: async () => {
    const data = await storage.read<PersistedAccounts>('accounts') ?? [];
    set({ accounts: data, initialized: true });
  },

  setAccounts: async (accounts) => {
    if (!get().initialized) return;  // Guard: never write before load completes
    set({ accounts });
    try {
      await storage.write<PersistedAccounts>('accounts', accounts);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        reportPermissionLost();
        return;
      }
      throw e;
    }
  },

  updateBalance: async (id, newCents) => {
    if (!get().initialized) return;
    const updated = get().accounts.map(a =>
      a.id === id ? { ...a, balanceCents: newCents } : a
    );
    set({ accounts: updated });
    try {
      await storage.write<PersistedAccounts>('accounts', updated);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        reportPermissionLost();
        return;
      }
      throw e;
    }
  },
}));
