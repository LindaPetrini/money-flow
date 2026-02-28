import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';
import type { AllocationRecord } from '@/types/domain';
import type { PersistedHistory } from '@/types/persistence';

interface AllocationState {
  initialized: boolean;
  history: AllocationRecord[];
  loadHistory: () => Promise<void>;
  appendAllocation: (record: AllocationRecord) => Promise<void>;
}

export const useAllocationStore = create<AllocationState>()((set, get) => ({
  initialized: false,
  history: [],

  loadHistory: async () => {
    const data = await storage.read<PersistedHistory>('history') ?? [];
    set({ history: data, initialized: true });
  },

  appendAllocation: async (record) => {
    if (!get().initialized) return;  // Guard
    const updated = [record, ...get().history];  // most recent first
    set({ history: updated });
    try {
      await storage.write<PersistedHistory>('history', updated);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        reportPermissionLost();
        return;
      }
      throw e;
    }
  },
}));
