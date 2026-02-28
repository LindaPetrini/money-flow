import { fsaDriver } from '@/lib/storage/storage';
import { useAccountStore } from '@/stores/accountStore';
import { useAllocationStore } from '@/stores/allocationStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface AppProps {
  needsFsaPrompt: boolean;
  storageMode: 'fsa' | 'idb';
}

export default function App({ needsFsaPrompt, storageMode }: AppProps) {
  const accounts = useAccountStore(s => s.accounts);

  const handleGrantAccess = async () => {
    if (!fsaDriver) return;
    await fsaDriver.requestPermission();
    // Re-load stores now that FSA is active
    await Promise.all([
      useAccountStore.getState().loadAccounts(),
      useAllocationStore.getState().loadHistory(),
      useSettingsStore.getState().loadSettings(),
    ]);
    // Force re-render — simple approach for Phase 1
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-2xl font-semibold mb-4">Money Flow</h1>

      <p className="text-sm text-muted-foreground mb-4">
        Storage: {storageMode === 'fsa' ? 'File System (FSA)' : 'Browser (IndexedDB)'}
        {storageMode === 'idb' && ' — your data is browser-local'}
      </p>

      {needsFsaPrompt && (
        <button
          onClick={handleGrantAccess}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm mb-4"
        >
          Grant access to your data folder
        </button>
      )}

      <p className="text-sm text-muted-foreground">
        Accounts loaded: {accounts.length}
      </p>
    </div>
  );
}
