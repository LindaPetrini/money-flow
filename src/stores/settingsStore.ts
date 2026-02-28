import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';
import type { Settings } from '@/types/domain';
import type { PersistedSettings } from '@/types/persistence';

const DEFAULT_SETTINGS: Settings = {
  taxPct: 37,
  taxAccountId: '',
  bufferAccountId: '',
  bufferTargetCents: 0,
  overflowRatios: [],
  floorItems: [],
  theme: 'system' as const,
};

function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia != null &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  try { localStorage.setItem('mf_theme', theme); } catch (_) {}
}

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
    applyTheme(data.theme ?? 'system');
  },

  updateSettings: async (patch) => {
    if (!get().initialized) return;  // Guard
    const updated = { ...get().settings, ...patch };
    set({ settings: updated });
    if (patch.theme !== undefined) {
      applyTheme(updated.theme ?? 'system');
    }
    try {
      await storage.write<PersistedSettings>('settings', updated);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        reportPermissionLost();
        return;
      }
      throw e;
    }
  },
}));
