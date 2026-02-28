import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAccountStore } from '@/stores/accountStore';
import type { OverflowRatio } from '@/types/domain';

export function OverflowRatiosSection() {
  const settings = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const accounts = useAccountStore(s => s.accounts);

  const [localRatios, setLocalRatios] = useState<Array<{ accountId: string; pctStr: string }>>(
    () => settings.overflowRatios.map(r => ({ accountId: r.accountId, pctStr: String(r.pct) }))
  );
  const [dirty, setDirty] = useState(false);

  // Sync from store when not dirty
  useEffect(() => {
    if (!dirty) {
      setLocalRatios(
        settings.overflowRatios.map(r => ({
          accountId: r.accountId,
          pctStr: String(r.pct),
        }))
      );
    }
  }, [settings.overflowRatios, dirty]);

  const total = localRatios.reduce((sum, r) => {
    const n = parseFloat(r.pctStr);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const isValid = Math.round(total) === 100;

  const handlePctChange = (index: number, value: string) => {
    setLocalRatios(prev => prev.map((r, i) => i === index ? { ...r, pctStr: value } : r));
    setDirty(true);
  };

  const handleDelete = (index: number) => {
    setLocalRatios(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleAdd = (accountId: string) => {
    if (!accountId) return;
    setLocalRatios(prev => [...prev, { accountId, pctStr: '0' }]);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!isValid) return;
    const ratios: OverflowRatio[] = localRatios.map(r => ({
      accountId: r.accountId,
      pct: parseFloat(r.pctStr) || 0,
    }));
    await updateSettings({ overflowRatios: ratios });
    setDirty(false);
  };

  const handleRevert = () => {
    setLocalRatios(
      settings.overflowRatios.map(r => ({ accountId: r.accountId, pctStr: String(r.pct) }))
    );
    setDirty(false);
  };

  const accountsNotInRatios = accounts.filter(
    a => !localRatios.some(r => r.accountId === a.id)
  );

  if (accounts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No accounts configured — add accounts in the Accounts tab first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localRatios.length === 0 && (
        <div className="text-sm text-muted-foreground">No ratios configured. Add an account below.</div>
      )}

      {localRatios.map((row, i) => {
        const account = accounts.find(a => a.id === row.accountId);
        return (
          <div key={row.accountId} className="flex items-center gap-3">
            <span className="text-sm flex-1">{account?.name ?? row.accountId}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={row.pctStr}
              onChange={e => handlePctChange(i, e.target.value)}
              className="text-sm border border-border rounded px-2 py-1 bg-background w-24"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <button
              onClick={() => handleDelete(i)}
              className="text-sm text-destructive hover:underline"
            >
              Remove
            </button>
          </div>
        );
      })}

      {/* Running total */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground">Total:</span>
        <span className={`text-sm font-semibold ${isValid ? 'text-green-600' : 'text-destructive'}`}>
          {total.toFixed(2)}%
        </span>
        {!isValid && (
          <span className="text-xs text-destructive">Must equal exactly 100%</span>
        )}
      </div>

      {/* Add account dropdown */}
      {accountsNotInRatios.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Add account:</span>
          <select
            defaultValue=""
            onChange={e => { handleAdd(e.target.value); e.target.value = ''; }}
            className="text-sm border border-border rounded px-2 py-1 bg-background"
          >
            <option value="" disabled>Select account...</option>
            {accountsNotInRatios.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!isValid}
          className={[
            'px-4 py-2 rounded text-sm font-medium',
            isValid
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          ].join(' ')}
        >
          Save ratios
        </button>
        <button
          onClick={handleRevert}
          className="px-4 py-2 rounded text-sm font-medium border border-border hover:bg-muted"
        >
          Revert
        </button>
      </div>
    </div>
  );
}
