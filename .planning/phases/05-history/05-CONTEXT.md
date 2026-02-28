# Phase 5: History - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Display the full log of past allocations and provide a "New Month" reset. Users can review every confirmed allocation in reverse chronological order, expand any entry to see all moves exactly as they appeared at confirmation time, and reset floor item coverage to start a new month. No filtering, search, or export — those are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### History list layout
- Reverse chronological list of allocation entries (most recent first)
- Each entry is a clickable row that expands/collapses inline (accordion — no modal or sheet)
- Collapsed state shows: formatted date, invoice amount + currency, mode badge (Stabilize/Distribute), move count (e.g. "4 moves")
- Date format: human-readable short form, e.g. "28 Feb 2026"
- Reuse the Stabilize/Distribute badge color conventions from AllocationResult.tsx (amber = stabilize, emerald = distribute)

### Expanded entry content
- Shows all moves exactly as they appeared at confirmation time: destination account name, amount, calculation string, reason string
- Reuse the Card layout pattern from AllocationResult.tsx for move items
- No re-running of allocation logic — render from the stored AllocationRecord.moves array directly

### New Month reset
- "New Month" button lives at the top of the History page (not in Settings)
- Button triggers a browser `confirm()` dialog: "Reset floor coverage for new month? This marks all floor items as uncovered. Account balances and history are unchanged."
- On confirm: set `coveredThisMonth = false` on all floor items in settingsStore, persist settings
- No other data is touched (balances, history records, configuration all unchanged)

### Empty state
- When `history.length === 0`: show a single centered message — "No allocations yet. Process an invoice to get started."
- No illustration needed — keep it minimal
- No pagination — personal finance tool; list stays small

### Claude's Discretion
- Exact chevron/arrow icon used for expand/collapse toggle
- Animation timing on accordion expand
- Whether to show the total allocated amount in the collapsed row (add if it fits cleanly)

</decisions>

<specifics>
## Specific Ideas

- User gave full discretion ("I trust you") — all decisions above are Claude's choices
- The move card pattern in AllocationResult.tsx is the reference for expanded move display
- Keep it consistent with the existing minimal/clean UI style throughout the app

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AllocationResult.tsx`: Move Card layout (account name, amount, calculation, reason) — copy/adapt for expanded history entries
- `ModeBadge.tsx` or inline badge in `AllocationResult.tsx`: Stabilize/Distribute color conventions (amber/emerald)
- `Card`, `CardContent` from `@/components/ui/card`: standard container for move items
- `formatCents` from `@/lib/cents`: money formatting already in use everywhere

### Established Patterns
- `allocationStore.history: AllocationRecord[]` already persisted and loaded — data layer is complete
- `AllocationRecord` shape: `{ id, date, invoiceAmountCents, invoiceCurrency, invoiceEurEquivalentCents, mode, moves[] }` — no new types needed
- `settingsStore.floorItems` has `coveredThisMonth: boolean` per item — New Month reset just flips all to false

### Integration Points
- `HistoryPage.tsx` is a stub — replace entirely with real implementation
- New Month reset writes to `settingsStore` (update floorItems, call `saveSettings`)
- No changes needed to `allocationStore`, `accountStore`, or `App.tsx`

</code_context>

<deferred>
## Deferred Ideas

- Filtering history by date range, mode, or amount — future phase
- Exporting history as CSV — Phase 6 scope or standalone
- Deleting individual history records — not planned

</deferred>

---

*Phase: 05-history*
*Context gathered: 2026-02-28*
