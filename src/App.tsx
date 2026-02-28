import { useState } from 'react';
import { fsaDriver } from '@/lib/storage/storage';
import { useStorageError } from '@/lib/storage/StorageErrorContext';
import Dashboard from '@/features/dashboard/Dashboard';
import { InvoicePage } from '@/features/invoice/InvoicePage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

interface AppProps {
  needsFsaPrompt: boolean;
  storageMode: 'fsa' | 'idb';
}

const THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' } as const;
type ThemeValue = 'light' | 'dark' | 'system';

export default function App({ needsFsaPrompt, storageMode }: AppProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoice' | 'history' | 'settings'>('dashboard');
  const { permissionLost } = useStorageError();
  const isFirstRun = needsFsaPrompt;
  const theme = useSettingsStore(s => s.settings.theme ?? 'system');
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const [idbNoticeDismissed, setIdbNoticeDismissed] = useState(
    () => localStorage.getItem('idb_notice_dismissed') === '1'
  );

  const handleGrantAccess = async () => {
    if (!fsaDriver) return;
    await fsaDriver.requestPermission();
    window.location.reload();
  };

  const handleReGrantAccess = async () => {
    if (!fsaDriver) return;
    await fsaDriver.requestPermission();
    window.location.reload();
  };

  const handleDismissIdbNotice = () => {
    localStorage.setItem('idb_notice_dismissed', '1');
    setIdbNoticeDismissed(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Permission-lost overlay — blocking, no dismiss */}
      {permissionLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-8 max-w-sm w-full mx-4 shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Storage access lost</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Money Flow lost access to your data folder (e.g. the tab was backgrounded).
              Click below to re-grant access.
            </p>
            <Button onClick={handleReGrantAccess} className="w-full">
              Re-grant access
            </Button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">Money Flow</span>
        <button
          type="button"
          onClick={() => void updateSettings({ theme: THEME_CYCLE[theme] as ThemeValue })}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          aria-label={`Current theme: ${theme}. Click to switch.`}
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" />
            : theme === 'light' ? <Sun className="h-4 w-4" />
            : <Monitor className="h-4 w-4" />}
        </button>
      </header>

      {/* IDB notice banner — shown only on true Firefox/Safari (fsaDriver === null), dismissible */}
      {storageMode === 'idb' && fsaDriver === null && !idbNoticeDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-amber-800">
            Your data is stored in this browser only — it won't appear in other browsers or devices.
            Use Chrome or Edge to enable file storage.
          </span>
          <button
            onClick={handleDismissIdbNotice}
            className="ml-4 text-amber-600 hover:text-amber-800 font-medium flex-shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Returning-visit reconnect banner — permission lapsed but user has existing data */}
      {needsFsaPrompt && !isFirstRun && (
        <div className="bg-muted px-4 py-2 text-sm flex items-center gap-3">
          <span className="text-muted-foreground">Click to reconnect your data folder</span>
          <button
            onClick={handleGrantAccess}
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Tab navigation — always rendered (even during first-run, for visual consistency) */}
      <nav className="border-b border-border px-4 flex gap-6">
        {(['dashboard', 'invoice', 'history', 'settings'] as const).map(tab => (
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

      {/* Tab content — replaced by onboarding card on first run */}
      <main>
        {isFirstRun ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="pt-6 text-center">
                <h1 className="text-2xl font-semibold mb-3">Welcome to Money Flow</h1>
                <p className="text-muted-foreground mb-6">
                  Money Flow stores your data as JSON files in a folder you choose.
                  This keeps everything private and portable.
                </p>
                <Button onClick={handleGrantAccess} className="w-full">
                  Choose data folder
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'invoice' && <InvoicePage />}
            {activeTab === 'history' && <HistoryPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </>
        )}
      </main>
    </div>
  );
}
