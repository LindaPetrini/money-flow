---
phase: 03-core-ui
plan: "03"
subsystem: invoice-workflow
tags: [invoice, allocation, form, state-machine, atomic-confirmation]
dependency_graph:
  requires:
    - 03-01 (shadcn foundation, Button component)
    - src/domain/allocationEngine.ts
    - src/stores/accountStore.ts
    - src/stores/allocationStore.ts
    - src/stores/settingsStore.ts
    - src/lib/cents.ts
  provides:
    - Invoice entry form with validation
    - Allocation result view with full calculation transparency
    - Atomic Done confirmation (balances + history + floor coverage)
  affects:
    - accountStore (setAccounts on Done)
    - allocationStore (appendAllocation on Done)
    - settingsStore (floorItems coveredThisMonth on Done)
tech_stack:
  added:
    - shadcn/ui Card component
    - shadcn/ui Input component
  patterns:
    - React useState local state machine (entry | result phases)
    - Branded Cents type casting at UI boundary
    - getState() escape hatch for settings update after async ops
key_files:
  created:
    - src/features/invoice/InvoiceForm.tsx
    - src/features/invoice/AllocationResult.tsx
    - src/features/invoice/InvoicePage.tsx
  modified: []
decisions:
  - "Floor item marking uses destinationAccountId matching (not floor item id) — aligns with engine move structure"
  - "Card + Input shadcn components installed; were already present on disk (skipped overwrite)"
  - "AllocationResult component imports AllocationResult type aliased as AllocationResultType to avoid name collision with the component itself"
  - "handleDone uses useSettingsStore.getState() for floor update to read freshest settings post-async setAccounts call"
metrics:
  duration: "~8 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 03 Plan 03: Invoice Entry Workflow Summary

**One-liner:** Invoice form with controlled inputs and parseCents validation, allocation result view with per-move calculation transparency, and atomic Done confirmation updating account balances, history, and floor coverage via sequential store writes.

## What Was Built

Three components in `src/features/invoice/` implementing the primary Money Flow workflow:

**InvoiceForm.tsx** — Controlled form with three required text inputs (amount, currency, EUR equivalent). Validates all fields non-empty before submit. Calls `parseCents()` to convert string inputs to integer cents. Resets fields after calling `onSubmit`. Shows per-field validation error messages.

**AllocationResult.tsx** — Displays the engine output after form submission. Shows mode badge (Stabilize/Distribute with distinct colors), invoice summary line, a Card-wrapped list of every `AllocationMove` with account name (resolved from ID), formatted amount, `calculation` string from engine, and `reason` in muted text. Shows running total using `addCents`. Done/Cancel buttons at the bottom.

**InvoicePage.tsx** — State machine with two exclusive phases (`entry` | `result`). Loading guard prevents render until both `accountStore.initialized` and `settingsStore.initialized` are true. `handleFormSubmit` calls `computeAllocation` and transitions to result phase. `handleDone` atomically:
1. Builds updated accounts array (one-pass balance adjustment)
2. Identifies floor moves by `rule === 'floor'`
3. Constructs `AllocationRecord` with `crypto.randomUUID()`
4. Awaits `setAccounts()` then `appendAllocation()` then `updateSettings()` in sequence
5. Returns to entry phase

`handleCancel` returns to entry with zero store mutations.

## Verification

- `npm run build` exits 0 (tsc + vite, no errors)
- `npx tsc --noEmit` exits 0
- `computeAllocation`, `setAccounts`, `appendAllocation` all confirmed present in InvoicePage.tsx
- All three component files exist in `src/features/invoice/`

## Deviations from Plan

None — plan executed exactly as written. The `appendAllocation` method name matched the plan exactly (confirmed from allocationStore.ts). FloorItem matching uses `destinationAccountId` as specified, which matches the `FloorItem` interface in domain.ts.
