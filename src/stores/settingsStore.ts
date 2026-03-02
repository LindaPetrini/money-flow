import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';
import type { Settings } from '@/types/domain';
import type { PersistedSettings } from '@/types/persistence';

const FALLBACK_SETTINGS: Settings = {
  taxPct: 30,
  taxAccountId: '',
  overflowRatios: [],
  confirmedRecurring: [],
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
  settings: FALLBACK_SETTINGS,

  loadSettings: async () => {
    const raw = await storage.read<Record<string, unknown>>('settings');
    // Migrate: strip legacy fields (bufferAccountId, bufferTargetCents, floorItems)
    // that may exist in older stored data. Type-safe cast after strip.
    const data: Settings = raw
      ? {
          taxPct: typeof raw.taxPct === 'number' ? raw.taxPct : FALLBACK_SETTINGS.taxPct,
          taxAccountId: typeof raw.taxAccountId === 'string' ? raw.taxAccountId : '',
          overflowRatios: Array.isArray(raw.overflowRatios) ? raw.overflowRatios as Settings['overflowRatios'] : [],
          confirmedRecurring: Array.isArray(raw.confirmedRecurring) ? raw.confirmedRecurring as Settings['confirmedRecurring'] : [],
          theme: (raw.theme as Settings['theme']) ?? 'system',
        }
      : FALLBACK_SETTINGS;
    set({ settings: data, initialized: true });
    applyTheme(data.theme ?? 'system');
  },

  updateSettings: async (patch) => {
    if (!get().initialized) return;
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
