import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { detectMode } from '@/domain/modeDetection';
import { AccountCard } from './AccountCard';
import { ModeBadge } from './ModeBadge';

export default function Dashboard() {
  const accounts = useAccountStore(s => s.accounts);
  const initialized = useAccountStore(s => s.initialized);
  const settings = useSettingsStore(s => s.settings);
  const settingsInitialized = useSettingsStore(s => s.initialized);
  const updateBalance = useAccountStore(s => s.updateBalance);

  if (!initialized || !settingsInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const bufferAccount = accounts.find(a => a.id === settings.bufferAccountId);
  const mode = detectMode(bufferAccount, settings, today);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <ModeBadge mode={mode} />
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No accounts configured. Run the app again to initialize defaults.
        </p>
      ) : (
        <div className="grid gap-3">
          {accounts.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              onBalanceChange={updateBalance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
