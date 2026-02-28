import { useState } from 'react';
import { fsaDriver } from '@/lib/storage/storage';
import { useAccountStore } from '@/stores/accountStore';
import { useAllocationStore } from '@/stores/allocationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import Dashboard from '@/features/dashboard/Dashboard';
import { InvoicePage } from '@/features/invoice/InvoicePage';
import { HistoryPage } from '@/features/history/HistoryPage';

interface AppProps {
  needsFsaPrompt: boolean;
  storageMode: 'fsa' | 'idb';
}

export default function App({ needsFsaPrompt, storageMode }: AppProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoice' | 'history'>('dashboard');

  const handleGrantAccess = async () => {
    if (!fsaDriver) return;
    await fsaDriver.requestPermission();
    await Promise.all([
      useAccountStore.getState().loadAccounts(),
      useAllocationStore.getState().loadHistory(),
      useSettingsStore.getState().loadSettings(),
    ]);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">Money Flow</span>
        <span className="text-xs text-muted-foreground">
          {storageMode === 'idb' ? 'Browser storage (data is browser-local)' : 'File storage'}
        </span>
      </header>

      {/* FSA prompt — shown above tabs when permission needed */}
      {needsFsaPrompt && (
        <div className="bg-muted px-4 py-2 text-sm flex items-center gap-3">
          <span className="text-muted-foreground">Grant folder access to use file storage:</span>
          <button
            onClick={handleGrantAccess}
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium"
          >
            Grant access
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <nav className="border-b border-border px-4 flex gap-6">
        {(['dashboard', 'invoice', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'py-3 text-sm capitalize transition-colors',
              activeTab === tab
                ? 'font-semibold border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab === 'invoice' ? 'New Invoice' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'invoice' && <InvoicePage />}
        {activeTab === 'history' && <HistoryPage />}
      </main>
    </div>
  );
}
