import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
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
    await storage.write<PersistedAccounts>('accounts', accounts);
  },

  updateBalance: async (id, newCents) => {
    if (!get().initialized) return;
    const updated = get().accounts.map(a =>
      a.id === id ? { ...a, balanceCents: newCents } : a
    );
    set({ accounts: updated });
    await storage.write<PersistedAccounts>('accounts', updated);
  },
}));
