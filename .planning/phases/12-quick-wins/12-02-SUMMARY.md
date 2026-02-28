---
phase: 12-quick-wins
plan: 02
subsystem: invoice
tags: [invoice, history, source, AllocationRecord]

# Dependency graph
requires:
  - phase: 11-schema-foundation
    provides: AllocationRecord.source typed as optional string, migration guarantees '' default
provides:
  - Optional "From" input field on InvoiceForm
  - source threaded from InvoiceForm → InvoicePage PageState → AllocationRecord
  - Conditional source display in collapsed HistoryPage rows
affects: [InvoiceForm, InvoicePage, HistoryPage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optional form field with empty string default (never undefined)
    - Conditional JSX render using short-circuit: {record.source && (...)}

key-files:
  created: []
  modified:
    - src/features/invoice/InvoiceForm.tsx (source state + optional input + onSubmit extension)
    - src/features/invoice/InvoicePage.tsx (PageState extended, source in setState and record)
    - src/features/history/HistoryPage.tsx (conditional source span in collapsed row)

key-decisions:
  - "source always passes as string (source.trim()), never undefined — consistent with migration guarantee"
  - "Empty string is falsy in JS — {record.source && ...} guard correctly hides element for pre-v1.1 records"
  - "source placed between date and mode badge in collapsed row for visual clarity"

patterns-established:
  - "Optional fields: always '' not undefined; falsy guard in JSX for conditional display"

requirements-completed: [INVSRC-01, INVSRC-02]

# Metrics
duration: 6min
completed: 2026-02-28
---

# Phase 12-02: Invoice Source Field Summary

**Optional "From" field added to invoice form — client/project name persists to AllocationRecord and appears in history rows for quick identification.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T20:44:00Z
- **Completed:** 2026-02-28T20:50:00Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

### Task 1: Add source field to InvoiceForm and thread through InvoicePage
- Extended `InvoiceFormProps.onSubmit` to include `source: string`
- Added `const [source, setSource] = useState('')` state in InvoiceForm
- Added "From (optional)" text input in JSX between EUR Equivalent and Submit button
- `handleSubmit` passes `source: source.trim()` and resets `setSource('')`
- Extended `PageState` result branch with `source: string`
- Extended `handleFormSubmit` parameter type; `setState` includes `source: data.source`
- Added `source: state.source` to `AllocationRecord` construction in `handleDone`

### Task 2: Display source in collapsed HistoryPage rows
- Added conditional `{record.source && (...)}` span between date and mode badge
- Span uses `truncate max-w-[120px]` with `title={record.source}` for overflow tooltip
- Empty-string records (all pre-v1.1 records after migration) render no extra element

## Verification

- `grep -q "source: string" src/features/invoice/InvoiceForm.tsx` — PASS
- `grep -q "source: state.source" src/features/invoice/InvoicePage.tsx` — PASS
- `grep -q "record.source &&" src/features/history/HistoryPage.tsx` — PASS
- `npm run build` — PASS (TypeScript clean)
- `npm test` — PASS (116 tests)

## Self-Check: PASSED
