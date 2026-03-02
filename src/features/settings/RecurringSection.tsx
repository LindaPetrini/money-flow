import { useSettingsStore } from '@/stores/settingsStore';
import { formatCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';

export function RecurringSection() {
  const settings = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);

  const items = settings.confirmedRecurring ?? [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No committed expenses saved yet. Analyze a CSV in the "Analyze CSV" tab and save recurring items there.
      </p>
    );
  }

  const totalMonthlyCents = items.reduce((sum, r) => sum + r.monthlyAmountCents, 0);

  const handleDelete = async (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    await updateSettings({ confirmedRecurring: updated });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border divide-y divide-border">
        {items.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{r.merchant}</p>
              <span className="text-xs text-muted-foreground capitalize">{r.frequency}</span>
            </div>
            <div className="text-right tabular-nums shrink-0">
              <p className="font-medium">
                {r.frequency === 'yearly'
                  ? `${formatCents(r.chargeAmountCents as Cents)}/yr`
                  : `${formatCents(r.chargeAmountCents as Cents)}/mo`}
              </p>
              {r.frequency === 'yearly' && (
                <p className="text-xs text-muted-foreground">
                  ≈{formatCents(r.monthlyAmountCents as Cents)}/mo
                </p>
              )}
            </div>
            <button
              onClick={() => void handleDelete(i)}
              className="text-xs text-destructive hover:underline shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm pt-1 border-t border-border">
        <span className="text-muted-foreground">Total monthly committed</span>
        <span className="font-semibold tabular-nums">
          {formatCents(totalMonthlyCents as Cents)}/mo
        </span>
      </div>
    </div>
  );
}
