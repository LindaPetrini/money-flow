import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import type { Settings } from '@/types/domain';
import type { PersistedSettings } from '@/types/persistence';

const DEFAULT_SETTINGS: Settings = {
  taxPct: 37,
  taxAccountId: '',
  bufferAccountId: '',
  bufferTargetCents: 0,
  overflowRatios: [],
  floorItems: [],
};

interface SettingsState {
  initialized: boolean;
  settings: Settings;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  initialized: false,
  settings: DEFAULT_SETTINGS,

  loadSettings: async () => {
    const data = await storage.read<PersistedSettings>('settings') ?? DEFAULT_SETTINGS;
    set({ settings: data, initialized: true });
  },

  updateSettings: async (patch) => {
    if (!get().initialized) return;  // Guard
    const updated = { ...get().settings, ...patch };
    set({ settings: updated });
    await storage.write<PersistedSettings>('settings', updated);
  },
}));
