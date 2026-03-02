import { useState, useRef } from 'react';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAllocationStore } from '@/stores/allocationStore';
import { computeAllocation } from '@/domain/allocationEngine';
import type { AllocationResult } from '@/domain/allocationEngine';
import { formatCents, parseCents, addCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';
import type { AllocationRecord } from '@/types/domain';
import { AccountCard } from './AccountCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AppTab } from '@/App';

interface DashboardProps {
  onNavigate: (tab: AppTab) => void;
}

type InvoicePhase =
  | { phase: 'entry' }
  | {
      phase: 'result';
      result: AllocationResult;
      invoiceAmountCents: number;
      invoiceCurrency: string;
      invoiceEurEquivalentCents: number;
      source: string;
    };

export default function Dashboard({ onNavigate }: DashboardProps) {
  const accounts = useAccountStore(s => s.accounts);
  const initialized = useAccountStore(s => s.initialized);
  const settings = useSettingsStore(s => s.settings);
  const settingsInitialized = useSettingsStore(s => s.initialized);
  const updateBalance = useAccountStore(s => s.updateBalance);
  const appendAllocation = useAllocationStore(s => s.appendAllocation);
  const history = useAllocationStore(s => s.history);

  // Invoice state
  const [invoicePhase, setInvoicePhase] = useState<InvoicePhase>({ phase: 'entry' });
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nonEur, setNonEur] = useState(false);
  const [origCurrency, setOrigCurrency] = useState('USD');
  const [origAmount, setOrigAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  // Track which move indices have been checked off (balance already updated)
  const [checkedMoves, setCheckedMoves] = useState<Set<number>>(new Set());

  if (!initialized || !settingsInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // ── Invoice handlers ──────────────────────────────────────────────────────

  const handleCalculate = () => {
    const eurCents = parseCents(nonEur ? amount : amount);
    if (!eurCents || eurCents <= 0) {
      setAmountError('Enter a valid amount');
      amountRef.current?.focus();
      return;
    }
    setAmountError('');

    let invoiceAmountCents: number;
    let invoiceCurrency: string;
    let invoiceEurEquivalentCents: number;

    if (nonEur) {
      const origCents = parseCents(origAmount);
      invoiceAmountCents = origCents || eurCents;
      invoiceCurrency = origCurrency.trim().toUpperCase() || 'USD';
      invoiceEurEquivalentCents = eurCents;
    } else {
      invoiceAmountCents = eurCents;
      invoiceCurrency = 'EUR';
      invoiceEurEquivalentCents = eurCents;
    }

    const result = computeAllocation(invoiceEurEquivalentCents as Cents, accounts, settings);
    setCheckedMoves(new Set());
    setInvoicePhase({
      phase: 'result',
      result,
      invoiceAmountCents,
      invoiceCurrency,
      invoiceEurEquivalentCents,
      source: source.trim(),
    });
  };

  // Toggle a move checkbox — immediately updates the account balance
  const handleCheckMove = async (originalIndex: number, isChecked: boolean) => {
    if (invoicePhase.phase !== 'result') return;
    const move = invoicePhase.result.moves[originalIndex];
    if (!move.destinationAccountId || move.amountCents <= 0) return;

    // Use getState() to get fresh balance, not stale closure value
    const currentAccounts = useAccountStore.getState().accounts;
    const account = currentAccounts.find(a => a.id === move.destinationAccountId);
    if (!account) return;

    if (isChecked) {
      await updateBalance(move.destinationAccountId, account.balanceCents + move.amountCents);
      setCheckedMoves(prev => new Set([...prev, originalIndex]));
    } else {
      await updateBalance(move.destinationAccountId, account.balanceCents - move.amountCents);
      setCheckedMoves(prev => { const s = new Set(prev); s.delete(originalIndex); return s; });
    }
  };

  const handleDone = async () => {
    if (invoicePhase.phase !== 'result') return;

    // Apply any unchecked moves that haven't been balanced yet
    for (let i = 0; i < invoicePhase.result.moves.length; i++) {
      if (!checkedMoves.has(i)) {
        const move = invoicePhase.result.moves[i];
        if (move.destinationAccountId && move.amountCents > 0) {
          const currentAccounts = useAccountStore.getState().accounts;
          const account = currentAccounts.find(a => a.id === move.destinationAccountId);
          if (account) {
            await updateBalance(move.destinationAccountId, account.balanceCents + move.amountCents);
          }
        }
      }
    }

    const record: AllocationRecord = {
      id: crypto.randomUUID(),
      date: invoiceDate || new Date().toISOString().slice(0, 10),
      invoiceAmountCents: invoicePhase.invoiceAmountCents,
      invoiceCurrency: invoicePhase.invoiceCurrency,
      invoiceEurEquivalentCents: invoicePhase.invoiceEurEquivalentCents,
      mode: 'distribute',
      moves: invoicePhase.result.moves,
      source: invoicePhase.source,
    };

    await appendAllocation(record);

    // Reset form
    setAmount('');
    setSource('');
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setOrigAmount('');
    setNonEur(false);
    setCheckedMoves(new Set());
    setInvoicePhase({ phase: 'entry' });
  };

  const handleCancel = () => {
    // Undo any balance changes from checked moves
    if (invoicePhase.phase === 'result') {
      void (async () => {
        for (const idx of checkedMoves) {
          const move = invoicePhase.result.moves[idx];
          if (move.destinationAccountId && move.amountCents > 0) {
            const currentAccounts = useAccountStore.getState().accounts;
            const account = currentAccounts.find(a => a.id === move.destinationAccountId);
            if (account) {
              await updateBalance(move.destinationAccountId, account.balanceCents - move.amountCents);
            }
          }
        }
      })();
    }
    setCheckedMoves(new Set());
    setInvoicePhase({ phase: 'entry' });
  };

  // ── Monthly summary ───────────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const thisMonthRecords = history.filter(r => r.date.startsWith(currentMonth));
  const totalInvoicedCents = thisMonthRecords.reduce(
    (sum, r) => sum + r.invoiceEurEquivalentCents, 0
  ) as Cents;

  const perAccount: Record<string, number> = {};
  for (const record of thisMonthRecords) {
    for (const move of record.moves) {
      perAccount[move.destinationAccountId] =
        (perAccount[move.destinationAccountId] ?? 0) + move.amountCents;
    }
  }
  const perAccountEntries = Object.entries(perAccount).sort((a, b) => b[1] - a[1]);
  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? id;

  const needsSetup = settings.overflowRatios.length === 0;

  // Keep moves in engine order (tax first)
  const getSortedMoves = (result: AllocationResult) =>
    result.moves.map((move, originalIndex) => ({ move, originalIndex }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ── Invoice Panel ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-4">
          {invoicePhase.phase === 'entry' ? (
            <>
              <p className="font-semibold text-base">Got paid?</p>

              {/* Amount row */}
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <div className="flex items-center rounded-md border border-border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <span className="px-3 text-sm text-muted-foreground bg-muted border-r border-border h-9 flex items-center select-none">
                      {nonEur ? 'EUR equiv.' : '€'}
                    </span>
                    <input
                      ref={amountRef}
                      type="text"
                      inputMode="decimal"
                      placeholder={nonEur ? 'EUR equivalent' : '5000'}
                      value={amount}
                      onChange={e => { setAmount(e.target.value); setAmountError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleCalculate()}
                      className="flex-1 px-3 h-9 text-sm bg-background outline-none"
                      autoFocus
                    />
                  </div>
                  {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
                </div>
                <Button onClick={handleCalculate} className="h-9 shrink-0">
                  Calculate
                </Button>
              </div>

              {/* Source + date row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="From (client / project — optional)"
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCalculate()}
                  className="flex-1 px-3 h-9 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="px-2 h-9 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring text-muted-foreground"
                />
              </div>

              {/* Non-EUR toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setNonEur(v => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  {nonEur ? 'Paid in EUR' : 'Paid in a different currency?'}
                </button>

                {nonEur && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Original amount"
                      value={origAmount}
                      onChange={e => setOrigAmount(e.target.value)}
                      className="flex-1 px-3 h-9 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      placeholder="USD"
                      value={origCurrency}
                      onChange={e => setOrigCurrency(e.target.value)}
                      className="w-16 px-2 h-9 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring uppercase"
                      maxLength={3}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Result view */
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-base">
                  {invoicePhase.invoiceCurrency !== 'EUR'
                    ? `${formatCents(invoicePhase.invoiceAmountCents as Cents)} ${invoicePhase.invoiceCurrency} → ${formatCents(invoicePhase.invoiceEurEquivalentCents as Cents)} EUR`
                    : formatCents(invoicePhase.invoiceAmountCents as Cents)}
                  {invoicePhase.source && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      from {invoicePhase.source}
                    </span>
                  )}
                </p>
              </div>

              <p className="text-xs text-muted-foreground -mt-1">
                {invoiceDate !== new Date().toISOString().slice(0, 10) && (
                  <span className="mr-2">Recorded for {invoiceDate}.</span>
                )}
                Check off each transfer as you complete it.
              </p>

              <div className="space-y-2">
                {getSortedMoves(invoicePhase.result).map(({ move, originalIndex }) => {
                  const name = move.destinationAccountId
                    ? (accountName(move.destinationAccountId) || move.destinationAccountId)
                    : '(unallocated)';
                  const isChecked = checkedMoves.has(originalIndex);
                  return (
                    <label
                      key={originalIndex}
                      className={`flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                          : 'border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => void handleCheckMove(originalIndex, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-green-600"
                      />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className={`text-sm font-medium ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                            {name}
                          </span>
                          <span className={`text-sm font-semibold tabular-nums shrink-0 ${isChecked ? 'text-muted-foreground' : ''}`}>
                            {formatCents(move.amountCents as Cents)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{move.calculation}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">
                  {formatCents(
                    addCents(...(invoicePhase.result.moves.map(m => m.amountCents) as Cents[]))
                  )}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => void handleDone()}
                  className="flex-1"
                  variant={checkedMoves.size === invoicePhase.result.moves.length ? 'default' : 'outline'}
                >
                  {checkedMoves.size === invoicePhase.result.moves.length
                    ? 'Save allocation'
                    : `Save allocation (${checkedMoves.size}/${invoicePhase.result.moves.length} done)`}
                </Button>
                <Button variant="ghost" onClick={handleCancel} className="shrink-0">
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Setup banner */}
      {needsSetup && invoicePhase.phase === 'entry' && (
        <div className="flex items-start justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3 text-sm">
          <div className="text-amber-800 dark:text-amber-200">
            <span className="font-medium">Budget splits not configured.</span>
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              Analyze your bank transactions or set percentages manually.
            </span>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="shrink-0 text-amber-800 dark:text-amber-200 underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-100 whitespace-nowrap"
          >
            Settings →
          </button>
        </div>
      )}

      {/* Account cards */}
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts configured.</p>
      ) : (
        <div className="grid gap-3">
          {[...accounts]
            .sort((a, b) => {
              if (a.role === 'tax') return 1;
              if (b.role === 'tax') return -1;
              return 0;
            })
            .map(account => (
            <AccountCard
              key={account.id}
              account={account}
              onBalanceChange={updateBalance}
            />
          ))}
        </div>
      )}

      {/* This Month summary */}
      <div className="rounded-md border border-border bg-card text-card-foreground">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{monthLabel}</h2>
        </div>

        {thisMonthRecords.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No invoices recorded this month yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Total invoiced</span>
              <span className="font-medium tabular-nums">{formatCents(totalInvoicedCents)}</span>
            </div>
            {perAccountEntries.map(([id, cents]) => (
              <div key={id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-muted-foreground">{accountName(id)}</span>
                <span className="tabular-nums">{formatCents(cents as Cents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
