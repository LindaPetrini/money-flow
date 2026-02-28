import { useAllocationStore } from '@/stores/allocationStore';

export function HistoryPage() {
  const history = useAllocationStore(s => s.history);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-4">History</h1>
      <p className="text-muted-foreground">
        {history.length === 0
          ? 'No allocations yet. Process an invoice to get started.'
          : `${history.length} allocation${history.length === 1 ? '' : 's'} recorded.`}
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        Full history view coming in Phase 5.
      </p>
    </div>
  );
}
