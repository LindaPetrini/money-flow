import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAccountStore } from '@/stores/accountStore';

export function TaxSection() {
  const settings = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const accounts = useAccountStore(s => s.accounts);

  const [taxPctStr, setTaxPctStr] = useState(() => String(settings.taxPct));
  const [taxAccountId, setTaxAccountId] = useState(() => settings.taxAccountId);
  const [saved, setSaved] = useState(false);

  const taxPctNum = parseFloat(taxPctStr);
  const taxPctValid = !isNaN(taxPctNum) && taxPctNum >= 0 && taxPctNum <= 100;

  const handleSave = async () => {
    if (!taxPctValid) return;
    await updateSettings({ taxPct: taxPctNum, taxAccountId });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Tax rate</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Percentage taken off every invoice before distributing to your accounts.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-28">Tax percentage</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={taxPctStr}
              onChange={e => setTaxPctStr(e.target.value)}
              className="text-sm border border-border rounded px-2 py-1.5 bg-background w-20 text-right"
            />
            <span className="text-sm text-muted-foreground">%</span>
            {!taxPctValid && (
              <span className="text-xs text-destructive">Must be 0–100</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-28">Tax account</span>
            <select
              value={taxAccountId}
              onChange={e => setTaxAccountId(e.target.value)}
              className="text-sm border border-border rounded px-2 py-1.5 bg-background"
            >
              <option value="">— none —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!taxPctValid}
        className={[
          'px-4 py-2 rounded text-sm font-medium transition-colors',
          taxPctValid
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        ].join(' ')}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
