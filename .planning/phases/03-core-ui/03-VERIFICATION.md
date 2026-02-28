---
phase: 03-core-ui
verified: 2026-02-28
status: passed
requirements_checked: [INVOICE-01, INVOICE-02, INVOICE-03, INVOICE-04, DASH-01, DASH-02, DASH-03, DASH-04]
verified_by: Phase 08-verify-core-ui plan 01
---

# Phase 03 — Core UI Verification

## Summary

Phase 3 (Core UI) implementation was formally verified on 2026-02-28. All 8 Core UI and Invoice requirements are satisfied with direct source-code evidence. The build gate (`npm run build`) passes with 1878 modules transformed and 0 TypeScript errors. The test gate (`npm test`) passes with 114/114 tests. One known logic defect (ALLOC-02) was identified in `InvoicePage.handleDone()` — floor item coverage marking uses `destinationAccountId` instead of `floorItemId` — but this does not affect the acceptance criteria for INVOICE-03 or INVOICE-04, which concern atomicity of balance updates and history persistence.

---

## Requirement Evidence Table

| Req | Status | Acceptance Criteria | Evidence | File:Line |
|-----|--------|--------------------|---------|----|
| INVOICE-01 | SATISFIED | Three controlled inputs (amount, currency, EUR equivalent); parseCents called on submit; callback called with all three values | `useState` for `amount`, `currency`, `eurEquivalent` (lines 15-17); `parseCents(amount)` and `parseCents(eurEquivalent)` called in `handleSubmit` (lines 39-40); `onSubmit({ amountCents, currency, eurEquivalentCents })` called (lines 42-46) | `src/features/invoice/InvoiceForm.tsx:15-46` |
| INVOICE-02 | SATISFIED | `result.moves.map()` renders a card per move; each card shows destination account name, `formatCents(amountCents)`, `move.calculation`, `move.reason`; all moves shown in one view | `result.moves.map((move, index) => ...)` renders a `<Card>` per move (line 53); card shows `accountName` (line 62), `formatCents(move.amountCents)` (line 64), `move.calculation` (line 67), `move.reason` (line 68); no pagination | `src/features/invoice/AllocationResult.tsx:53-72` |
| INVOICE-03 | SATISFIED (see caveat) | `handleDone()` builds `updatedAccounts` in a single pass; calls `setAccounts(updatedAccounts)` then `appendAllocation(record)` atomically; no intermediate UI update between the two writes | `updatedAccounts` built via `accounts.map(...)` (lines 61-72); `await setAccounts(updatedAccounts)` (line 91); `await appendAllocation(record)` (line 92); no `setState()` call between these two writes | `src/features/invoice/InvoicePage.tsx:57-92` |
| INVOICE-04 | SATISFIED | `PageState` is a mutually exclusive discriminated union (`'entry' \| 'result'`); guard `if (state.phase !== 'result') return` at `handleDone()` entry; state transitions are entry→result and result→entry only | `type PageState = { phase: 'entry' } \| { phase: 'result'; ... }` (lines 12-20); guard `if (state.phase !== 'result') return` (line 58); `setState({ phase: 'result' })` in `handleFormSubmit` (line 48); `setState({ phase: 'entry' })` in `handleDone` and `handleCancel` (lines 107, 112) | `src/features/invoice/InvoicePage.tsx:12-20,58,107,112` |
| DASH-01 | SATISFIED | `useAccountStore` provides accounts array; `accounts.map(account => <AccountCard ... />)` renders all accounts; no conditional filtering | `accounts` from `useAccountStore(s => s.accounts)` (line 8); `{accounts.map(account => (<AccountCard key={account.id} account={account} ... />))}` with no filter applied (lines 39-45) | `src/features/dashboard/Dashboard.tsx:8,39-45` |
| DASH-02 | SATISFIED | Click on balance triggers edit mode (`startEditing`); input shown during edit; Enter/blur commits via `onBalanceChange` prop; Escape cancels | `<button onClick={startEditing}>` (line 105); input with `onKeyDown={handleKeyDown}` and `onBlur={handleBlur}` (lines 93-96); `handleKeyDown` calls `commitEdit()` on Enter, `cancelEdit()` on Escape (lines 53-58); `commitEdit()` calls `onBalanceChange(account.id, newCents)` (line 44) | `src/features/dashboard/AccountCard.tsx:35-63,105-113` |
| DASH-03 | SATISFIED | `getStatus(account)` returns `'at-target' \| 'near-target' \| 'below-target'`; thresholds are `>=targetCents` (at), `>=targetCents*0.8` (near), else below; `STATUS_DOT_CLASSES` maps each status to a color class; colored dot rendered in UI | `getStatus()` (lines 10-15): `balanceCents >= targetCents` → `'at-target'`; `balanceCents >= targetCents * 0.8` → `'near-target'`; else `'below-target'`; `STATUS_DOT_CLASSES` maps to `bg-green-500`, `bg-yellow-400`, `bg-red-500` (lines 17-21); dot rendered as `<span className={cn('...', dotClass)} />` (line 74) | `src/features/dashboard/AccountCard.tsx:10-21,33,74` |
| DASH-04 | SATISFIED | Dashboard imports `detectMode()` from `domain/modeDetection`; called with buffer account and settings; result passed to `ModeBadge`; `ModeBadge` renders mode label and one-line explanation | `import { detectMode } from '@/domain/modeDetection'` (Dashboard line 3); `const mode = detectMode(bufferAccount, settings, today)` (line 24); `<ModeBadge mode={mode} />` (line 30); `MODE_CONFIG` maps mode to `label` and `explanation` strings (ModeBadge lines 7-18); both rendered in component (ModeBadge lines 25-27) | `src/features/dashboard/Dashboard.tsx:3,24,30` + `src/features/dashboard/ModeBadge.tsx:7-27` |

---

## Build and Test Gates

### `npm run build`: PASSED

```
vite v7.3.1 building client environment for production...
✓ 1878 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.29 kB
dist/assets/index-SU8fE_jx.css   34.17 kB │ gzip:  6.95 kB
dist/assets/index-DLh-0ZJN.js   307.35 kB │ gzip: 94.72 kB
✓ built in 4.17s
```

**Result:** 0 TypeScript errors, 0 build warnings.

### `npm test`: PASSED

```
 ✓ src/domain/allocationEngine.test.ts (21 tests)
 ✓ src/lib/csvParser.test.ts (39 tests)
 ✓ src/lib/cents.test.ts (25 tests)
 ✓ src/domain/floorCalculator.test.ts (16 tests)
 ✓ src/domain/modeDetection.test.ts (13 tests)

 Test Files  5 passed (5)
      Tests  114 passed (114)
```

**Result:** 114/114 tests passing, 0 failures.

**Date verified:** 2026-02-28

---

## Caveats

### ALLOC-02: Floor Item Coverage Defect

**Defect:** `InvoicePage.handleDone()` (line 75-77) collects `coveredFloorAccountIds` from floor-rule moves and then marks floor items covered using `coveredFloorAccountIds.includes(f.destinationAccountId)` (line 99). This is incorrect when multiple floor items share the same `destinationAccountId` — only the first floor item for a given account gets marked covered; subsequent items with the same destination are never marked, even if they were funded.

The correct field to match against is the floor item's own ID (e.g. `floorItemId` on the move), not the destination account ID.

**Impact:** In edge cases where two or more floor items target the same destination account, only the first floor item per account gets marked `coveredThisMonth = true` after confirmation. The account balance update (step 4, line 91) and history append (step 4, line 92) are unaffected — those operate correctly regardless.

**Requirements affected:** ALLOC-02 (floor coverage accuracy). INVOICE-03 and INVOICE-04 are NOT affected — INVOICE-03 requires atomicity of balance writes and history append (both correct), and INVOICE-04 requires no partial confirmation (also correct). Those requirements remain SATISFIED.

**Fix planned:** Phase 10 (Fix Integration Defects).
