import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addCents, formatCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';
import type { AllocationResult as AllocationResultType } from '@/domain/allocationEngine';
import type { Account } from '@/types/domain';

interface AllocationResultProps {
  result: AllocationResultType;
  invoiceAmountCents: number;
  invoiceCurrency: string;
  invoiceEurEquivalentCents: number;
  accounts: Account[];
  onDone: () => void;
  onCancel: () => void;
}

export function AllocationResult({
  result,
  invoiceAmountCents,
  invoiceCurrency,
  invoiceEurEquivalentCents,
  accounts,
  onDone,
  onCancel,
}: AllocationResultProps) {
  const modeLabel = result.mode === 'stabilize' ? 'Stabilize' : 'Distribute';
  const modeBadgeClass =
    result.mode === 'stabilize'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';

  const totalMoved = addCents(...(result.moves.map(m => m.amountCents) as Cents[]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Allocation Result</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${modeBadgeClass}`}>
          {modeLabel}
        </span>
      </div>

      {/* Invoice summary */}
      <p className="text-sm text-muted-foreground">
        {formatCents(invoiceAmountCents as Cents)} ({invoiceCurrency}) &rarr;{' '}
        {formatCents(invoiceEurEquivalentCents as Cents)} EUR equivalent
      </p>

      {/* Move list */}
      <div className="space-y-3">
        {result.moves.map((move, index) => {
          const accountName =
            (accounts.find(a => a.id === move.destinationAccountId)?.name ??
            move.destinationAccountId) || '(unallocated)';

          return (
            <Card key={index} className="py-4">
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
      </div>

      {/* Total check */}
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Total allocated</span>
        <span className="font-semibold tabular-nums">{formatCents(totalMoved)}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Button onClick={onDone} className="flex-1">
          Done
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
