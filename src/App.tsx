import { useState } from 'react';
import { fsaDriver } from '@/lib/storage/storage';
import { useStorageError } from '@/lib/storage/StorageErrorContext';
import Dashboard from '@/features/dashboard/Dashboard';
import { HistoryPage } from '@/features/history/HistoryPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAccountStore } from '@/stores/accountStore';

export type AppTab = 'dashboard' | 'history' | 'settings';

interface AppProps {
  needsFsaPrompt: boolean;
  storageMode: 'fsa' | 'idb';
}

const THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' } as const;
type ThemeValue = 'light' | 'dark' | 'system';

export default function App({ needsFsaPrompt, storageMode }: AppProps) {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const { permissionLost } = useStorageError();
  const theme = useSettingsStore(s => s.settings.theme ?? 'system');
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const accountsInitialized = useAccountStore(s => s.initialized);
  const settingsInitialized = useSettingsStore(s => s.initialized);
  const storesReady = accountsInitialized && settingsInitialized;
  const [idbNoticeDismissed, setIdbNoticeDismissed] = useState(
    () => localStorage.getItem('idb_notice_dismissed') === '1'
  );

  const handleGrantAccess = async () => {
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
      {/* Permission-lost overlay */}
      {permissionLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-8 max-w-sm w-full mx-4 shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Storage access lost</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Money Flow lost access to your data folder. Click below to re-grant access.
            </p>
            <Button onClick={handleGrantAccess} className="w-full">
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

      {/* IDB notice banner */}
      {storageMode === 'idb' && fsaDriver === null && !idbNoticeDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-amber-800">
            Data is stored in this browser only. Use Chrome or Edge to enable file storage.
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

      {/* Reconnect banner */}
      {needsFsaPrompt && (
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

      {/* Tab navigation */}
      <nav className="border-b border-border px-4 flex gap-6">
        {(['dashboard', 'history', 'settings'] as const).map(tab => (
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
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main>
        {needsFsaPrompt ? (
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
        ) : !storesReady ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
            {activeTab === 'history' && <HistoryPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </>
        )}
      </main>
    </div>
  );
}
