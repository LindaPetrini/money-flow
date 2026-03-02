import { Input } from '@/components/ui/input';

export interface HistoryFiltersState {
  dateFrom: string;    // YYYY-MM-DD or ''
  dateTo: string;      // YYYY-MM-DD or ''
  sourceQuery: string; // free text or ''
  amountMin: string;   // decimal euros string or ''
  amountMax: string;   // decimal euros string or ''
}

interface HistoryFiltersProps {
  filters: HistoryFiltersState;
  onChange: (filters: HistoryFiltersState) => void;
}

export function HistoryFilters({ filters, onChange }: HistoryFiltersProps) {
  const update = (patch: Partial<HistoryFiltersState>) =>
    onChange({ ...filters, ...patch });

  const hasAnyFilter =
    filters.dateFrom || filters.dateTo || filters.sourceQuery ||
    filters.amountMin || filters.amountMax;

  return (
    <div className="space-y-3 mb-6 p-4 rounded-lg border border-border bg-muted/30">
      {/* Date range row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="filter-date-from" className="text-xs text-muted-foreground">From date</label>
          <Input
            id="filter-date-from"
            type="date"
            value={filters.dateFrom}
            onChange={e => update({ dateFrom: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="filter-date-to" className="text-xs text-muted-foreground">To date</label>
          <Input
            id="filter-date-to"
            type="date"
            value={filters.dateTo}
            onChange={e => update({ dateTo: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Source search row */}
      <div className="space-y-1">
        <label htmlFor="filter-source" className="text-xs text-muted-foreground">Client / source</label>
        <Input
          id="filter-source"
          type="text"
          placeholder="Search by client name..."
          value={filters.sourceQuery}
          onChange={e => update({ sourceQuery: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* Amount range row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="filter-amount-min" className="text-xs text-muted-foreground">Min amount (€)</label>
          <Input
            id="filter-amount-min"
            type="text"
            placeholder="0"
            value={filters.amountMin}
            onChange={e => update({ amountMin: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="filter-amount-max" className="text-xs text-muted-foreground">Max amount (€)</label>
          <Input
            id="filter-amount-max"
            type="text"
            placeholder="—"
            value={filters.amountMax}
            onChange={e => update({ amountMax: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Clear filters link — only shown when at least one filter is active */}
      {hasAnyFilter && (
        <button
          type="button"
          onClick={() => onChange({ dateFrom: '', dateTo: '', sourceQuery: '', amountMin: '', amountMax: '' })}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
