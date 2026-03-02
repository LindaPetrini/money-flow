import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_ACCOUNTS, DEFAULT_SETTINGS } from '@/lib/defaultConfig';

/**
 * Seed stores with defaults only if storage is empty (first run).
 * Must be called AFTER all stores have been loaded (initialized=true).
 * Is idempotent: calling it again on a populated store is a no-op.
 */
export async function seedIfEmpty(): Promise<void> {
  const { accounts, setAccounts } = useAccountStore.getState();
  const { settings, updateSettings } = useSettingsStore.getState();

  // Seed accounts if none exist
  if (accounts.length === 0) {
    await setAccounts(DEFAULT_ACCOUNTS);
  }

  // Seed settings if overflowRatios is empty (proxy for unconfigured state)
  if (settings.overflowRatios.length === 0) {
    await updateSettings(DEFAULT_SETTINGS);
  }
}
