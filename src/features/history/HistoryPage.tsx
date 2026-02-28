import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAllocationStore } from '@/stores/allocationStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addCents, formatCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';

function formatHistoryDate(isoDate: string): string {
  // Split to avoid UTC midnight shift (new Date("YYYY-MM-DD") parses as UTC)
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function HistoryPage() {
  const history = useAllocationStore(s => s.history);
  const accounts = useAccountStore(s => s.accounts);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleNewMonth = async () => {
    const confirmed = window.confirm(
      'Reset floor coverage for new month? This marks all floor items as uncovered. Account balances and history are unchanged.'
    );
    if (!confirmed) return;
    const { settings, updateSettings } = useSettingsStore.getState();
    await updateSettings({
      floorItems: settings.floorItems.map(f => ({ ...f, coveredThisMonth: false })),
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Page header with New Month button — always visible */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">History</h1>
        <Button variant="outline" size="sm" onClick={() => void handleNewMonth()}>
          New Month
        </Button>
      </div>

      {/* Empty state */}
      {history.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No allocations yet. Process an invoice to get started.
        </p>
      )}

      {/* Accordion list */}
      {history.length > 0 && (
        <div className="space-y-2">
          {history.map((record) => {
            const isOpen = expandedId === record.id;
            const modeLabel = record.mode === 'stabilize' ? 'Stabilize' : 'Distribute';
            const modeBadgeClass =
              record.mode === 'stabilize'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800';
            const total =
              record.moves.length > 0
                ? addCents(...(record.moves.map(m => m.amountCents) as [Cents, ...Cents[]]))
                : (0 as Cents);

            return (
              <div key={record.id} className="rounded-lg border border-border">
                {/* Collapsed row — always visible, click to toggle */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
                  onClick={() => setExpandedId(isOpen ? null : record.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium">
                      {formatHistoryDate(record.date)}
                    </span>
                    {record.source && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={record.source}>
                        {record.source}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${modeBadgeClass}`}
                    >
                      {modeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatCents(record.invoiceAmountCents as Cents)} {record.invoiceCurrency}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {record.moves.length} move{record.moves.length === 1 ? '' : 's'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded content — move cards */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                    {/* Invoice summary */}
                    <p className="text-xs text-muted-foreground mb-2">
                      {formatCents(record.invoiceAmountCents as Cents)} {record.invoiceCurrency}
                      {' → '}
                      {formatCents(record.invoiceEurEquivalentCents as Cents)} EUR equivalent
                    </p>

                    {/* Individual move cards */}
                    {record.moves.map((move, i) => {
                      const accountName =
                        accounts.find(a => a.id === move.destinationAccountId)?.name ??
                        move.destinationAccountId ??
                        '(unallocated)';
                      return (
                        <Card key={i} className="py-4">
                          <CardContent className="px-4 space-y-1">
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="font-medium text-sm">{accountName}</span>
                              <span className="font-semibold text-sm tabular-nums">
                                {formatCents(move.amountCents as Cents)}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/80">{move.calculation}</p>
                            <p className="text-xs text-muted-foreground">{move.reason}</p>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {/* Total allocated footer */}
                    <div className="flex items-center justify-between border-t pt-2 text-sm">
                      <span className="text-muted-foreground">Total allocated</span>
                      <span className="font-semibold tabular-nums">{formatCents(total)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
