import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAccountStore } from '@/stores/accountStore';
import { parseCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';

export function TaxBufferSection() {
  const settings = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const accounts = useAccountStore(s => s.accounts);

  const [taxPctStr, setTaxPctStr] = useState(() => String(settings.taxPct));
  const [taxAccountId, setTaxAccountId] = useState(() => settings.taxAccountId);
  const [bufferTargetStr, setBufferTargetStr] = useState(
    () => (settings.bufferTargetCents / 100).toFixed(2)
  );
  const [bufferAccountId, setBufferAccountId] = useState(() => settings.bufferAccountId);

  const taxPctNum = parseFloat(taxPctStr);
  const taxPctValid = !isNaN(taxPctNum) && taxPctNum >= 0 && taxPctNum <= 100;

  const handleSave = async () => {
    if (!taxPctValid) return;
    await updateSettings({
      taxPct: taxPctNum,
      taxAccountId,
      bufferTargetCents: parseCents(bufferTargetStr) as number as Cents,
      bufferAccountId,
    });
  };

  return (
    <div className="space-y-8">
      {/* Tax Settings */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Tax Settings</h2>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground w-32">Tax percentage</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={taxPctStr}
            onChange={e => setTaxPctStr(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1 bg-background w-24"
          />
          <span className="text-sm text-muted-foreground">%</span>
          {!taxPctValid && (
            <span className="text-xs text-destructive">Must be 0–100</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground w-32">Tax account</span>
          <select
            value={taxAccountId}
            onChange={e => setTaxAccountId(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1 bg-background"
          >
            <option value="">— none —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Buffer Settings */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Buffer Settings</h2>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground w-32">Buffer target</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={bufferTargetStr}
            onChange={e => setBufferTargetStr(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1 bg-background w-24"
          />
          <span className="text-sm text-muted-foreground">€ (minimum balance in income-hub account)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground w-32">Buffer account</span>
          <select
            value={bufferAccountId}
            onChange={e => setBufferAccountId(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1 bg-background"
          >
            <option value="">— none —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!taxPctValid}
        className={[
          'px-4 py-2 rounded text-sm font-medium',
          taxPctValid
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        ].join(' ')}
      >
        Save
      </button>
    </div>
  );
}
