import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';
import type { MerchantEntry } from '@/types/domain';
import type { PersistedMerchants } from '@/types/persistence';

interface MerchantState {
  initialized: boolean;
  merchants: MerchantEntry[];
  loadMerchants: () => Promise<void>;
  upsertMerchant: (entry: MerchantEntry) => Promise<void>;
  lookupMerchant: (merchantName: string) => MerchantEntry | undefined;
}

export const useMerchantStore = create<MerchantState>()((set, get) => ({
  initialized: false,
  merchants: [],

  loadMerchants: async () => {
    const data = await storage.read<PersistedMerchants>('merchants') ?? [];
    set({ merchants: data, initialized: true });
  },

  upsertMerchant: async (entry) => {
    if (!get().initialized) return;  // Guard: never write before load completes
    const existing = get().merchants;
    const idx = existing.findIndex(m => m.merchantName === entry.merchantName);
    const updated = idx >= 0
      ? existing.map((m, i) => i === idx ? entry : m)
      : [...existing, entry];
    set({ merchants: updated });
    try {
      await storage.write<PersistedMerchants>('merchants', updated);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        reportPermissionLost();
        return;
      }
      throw e;
    }
  },

  lookupMerchant: (merchantName) => {
    return get().merchants.find(m => m.merchantName === merchantName);
  },
}));
