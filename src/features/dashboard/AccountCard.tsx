import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCents, parseCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';
import type { Account } from '@/types/domain';

type Status = 'at-target' | 'near-target' | 'below-target';

function getStatus(account: Account): Status {
  if (account.targetCents === 0) return 'at-target'; // no target = always "ok"
  if (account.balanceCents >= account.targetCents) return 'at-target';
  if (account.balanceCents >= account.targetCents * 0.8) return 'near-target';
  return 'below-target';
}

const STATUS_DOT_CLASSES: Record<Status, string> = {
  'at-target': 'bg-green-500',
  'near-target': 'bg-yellow-400',
  'below-target': 'bg-red-500',
};

interface AccountCardProps {
  account: Account;
  onBalanceChange: (id: string, newCents: number) => Promise<void>;
}

export function AccountCard({ account, onBalanceChange }: AccountCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const status = getStatus(account);
  const dotClass = STATUS_DOT_CLASSES[status];

  function startEditing() {
    // Pre-fill with raw decimal representation (e.g. "1500.00")
    setEditValue((account.balanceCents / 100).toFixed(2));
    setEditing(true);
  }

  async function commitEdit() {
    const newCents = parseCents(editValue);
    setEditing(false);
    await onBalanceChange(account.id, newCents);
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  function handleBlur() {
    void commitEdit();
  }

  const roleLabel = account.role.replace(/-/g, ' ');

  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between">
          {/* Left: status dot + name */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', dotClass)}
              aria-label={status}
            />
            <span className="truncate text-sm font-medium">{account.name}</span>
          </div>

          {/* Right: role badge (muted) */}
          <span className="ml-2 shrink-0 text-xs text-muted-foreground capitalize">
            {roleLabel}
          </span>
        </div>

        {/* Balance row */}
        <div className="mt-1.5 pl-4">
          {editing ? (
            <div className="flex flex-col gap-0.5">
              <input
                type="text"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                autoFocus
                className="w-32 rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Edit balance"
              />
              <span className="text-xs text-muted-foreground">
                Press Enter to save, Esc to cancel
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="cursor-pointer rounded px-1 py-0.5 text-sm font-semibold tabular-nums hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
              title="Click to edit balance"
            >
              {formatCents(account.balanceCents as Cents)}
            </button>
          )}

          {/* Target (omit if 0) */}
          {account.targetCents > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Target: {formatCents(account.targetCents as Cents)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
