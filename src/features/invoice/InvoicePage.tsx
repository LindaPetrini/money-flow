import { useState } from 'react';
import { computeAllocation } from '@/domain/allocationEngine';
import type { AllocationResult } from '@/domain/allocationEngine';
import { useAccountStore } from '@/stores/accountStore';
import { useAllocationStore } from '@/stores/allocationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AllocationRecord } from '@/types/domain';
import type { Cents } from '@/lib/cents';
import { InvoiceForm } from './InvoiceForm';
import { AllocationResult as AllocationResultView } from './AllocationResult';

type PageState =
  | { phase: 'entry' }
  | {
      phase: 'result';
      result: AllocationResult;
      invoiceAmountCents: number;
      invoiceCurrency: string;
      invoiceEurEquivalentCents: number;
      source: string;
    };

export function InvoicePage() {
  const [state, setState] = useState<PageState>({ phase: 'entry' });

  const accounts = useAccountStore(s => s.accounts);
  const setAccounts = useAccountStore(s => s.setAccounts);
  const initialized = useAccountStore(s => s.initialized);
  const settings = useSettingsStore(s => s.settings);
  const settingsInitialized = useSettingsStore(s => s.initialized);
  const appendAllocation = useAllocationStore(s => s.appendAllocation);

  if (!initialized || !settingsInitialized) {
    return <p>Loading...</p>;
  }

  const handleFormSubmit = (data: {
    amountCents: number;
    currency: string;
    eurEquivalentCents: number;
    source: string;
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeAllocation(
      data.eurEquivalentCents as Cents,
      accounts,
      settings,
      today,
    );
    setState({
      phase: 'result',
      result,
      invoiceAmountCents: data.amountCents,
      invoiceCurrency: data.currency,
      invoiceEurEquivalentCents: data.eurEquivalentCents,
      source: data.source,
    });
  };

  const handleDone = async () => {
    if (state.phase !== 'result') return;

    // 1. Apply all balance changes atomically — build updated accounts array in one pass
    const updatedAccounts = accounts.map(account => {
      const movesForAccount = state.result.moves.filter(
        m => m.destinationAccountId === account.id,
      );
      const totalForAccount = movesForAccount.reduce(
        (sum, m) => sum + m.amountCents,
        0,
      );
      return totalForAccount > 0
        ? { ...account, balanceCents: account.balanceCents + totalForAccount }
        : account;
    });

    // 2. Collect floorItemIds from floor moves to mark covered
    const coveredFloorItemIds = state.result.moves
      .filter(m => m.rule === 'floor' && m.floorItemId !== undefined)
      .map(m => m.floorItemId as string);

    // 3. Build AllocationRecord
    const record: AllocationRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      invoiceAmountCents: state.invoiceAmountCents,
      invoiceCurrency: state.invoiceCurrency,
      invoiceEurEquivalentCents: state.invoiceEurEquivalentCents,
      mode: state.result.mode,
      moves: state.result.moves,
      source: state.source,
    };

    // 4. Commit everything — setAccounts writes to storage atomically
    await setAccounts(updatedAccounts);
    await appendAllocation(record);

    // 5. Mark covered floor items in settings
    if (coveredFloorItemIds.length > 0) {
      const { settings: currentSettings, updateSettings } = useSettingsStore.getState();
      await updateSettings({
        floorItems: currentSettings.floorItems.map(f =>
          coveredFloorItemIds.includes(f.id)
            ? { ...f, coveredThisMonth: true }
            : f,
        ),
      });
    }

    // 6. Return to entry state
    setState({ phase: 'entry' });
  };

  const handleCancel = () => {
    setState({ phase: 'entry' });
  };

  if (state.phase === 'entry') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold mb-6">New Invoice</h1>
        <InvoiceForm onSubmit={handleFormSubmit} />
      </div>
    );
  }

  // phase === 'result'
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <AllocationResultView
        result={state.result}
        invoiceAmountCents={state.invoiceAmountCents}
        invoiceCurrency={state.invoiceCurrency}
        invoiceEurEquivalentCents={state.invoiceEurEquivalentCents}
        accounts={accounts}
        onDone={handleDone}
        onCancel={handleCancel}
      />
    </div>
  );
}
