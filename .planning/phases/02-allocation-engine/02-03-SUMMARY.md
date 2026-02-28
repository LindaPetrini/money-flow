---
phase: 02-allocation-engine
plan: "03"
subsystem: domain
tags: [allocation-engine, tdd, pure-function, three-stage-pipeline]
dependency_graph:
  requires:
    - 02-01-SUMMARY.md  # modeDetection.ts
    - 02-02-SUMMARY.md  # floorCalculator.ts
  provides:
    - computeAllocation pure function
    - AllocationResult type
  affects:
    - future store integration (settingsStore.confirmAllocation)
tech_stack:
  added: []
  patterns:
    - three-stage pipeline (tax → detectMode → stabilize|distribute)
    - greedy priority-ordered floor fill
    - largest-remainder splitCents distribution
    - branded Cents type with as-number cast at domain boundary
key_files:
  created:
    - src/domain/allocationEngine.ts
    - src/domain/allocationEngine.test.ts
  modified: []
decisions:
  - "Buffer deficit used for mode detection only — no buffer top-up move generated in v1"
  - "Empty overflowRatios produce an unallocated move (rule: unallocated) rather than silently dropping cents"
  - "AllocationMove.amountCents assigned with as number cast (not as Cents) per domain.ts contract"
  - "floor.amountCents cast to Cents before arithmetic for type safety"
  - "pctOf (Math.floor) for tax — residual cents flow forward to next stage correctly"
metrics:
  duration: "~10 minutes"
  completed: "2026-02-28"
  tasks: 2
  files: 2
requirements:
  - ALLOC-01
  - ALLOC-02
  - ALLOC-03
  - ALLOC-04
  - ALLOC-05
  - ALLOC-06
---

# Phase 2 Plan 3: Allocation Engine Summary

**One-liner:** Three-stage allocation pipeline (tax extraction → mode detection → stabilize/distribute) with largest-remainder distribution and 6 edge case tests, 75 total tests passing.

## What Was Built

`computeAllocation(invoiceEurCents, accounts, settings, today)` — the core financial decision engine composing Wave 1 helpers into a complete three-stage pipeline:

1. **Stage 1 — Tax extraction:** `pctOf(invoiceEurCents, settings.taxPct)` using Math.floor (conservative). Residual cents flow forward. Early return if remaining <= 0 (edge case 1).

2. **Stage 2 — Mode detection:** delegates to `detectMode(bufferAccount, settings, today)` — returns `'stabilize'` or `'distribute'`.

3. **Stage 3 — Branch:**
   - **Stabilize:** `sortedActiveUncoveredFloors` + greedy fill by priority. Stops at remaining=0.
   - **Distribute:** `splitCents` across overflowRatios (largest-remainder guarantees exact sums). Edge case 5: empty ratios → unallocated-surplus move.

## Key Exports

- `computeAllocation(invoiceEurCents: Cents, accounts: Account[], settings: Settings, today?: string): AllocationResult`
- `AllocationResult { mode: 'stabilize' | 'distribute'; moves: AllocationMove[] }`

## Test Results

**Total tests:** 75 passing across 4 test files:
- `allocationEngine.test.ts`: 21 tests
- `cents.test.ts`: 25 tests
- `floorCalculator.test.ts`: 16 tests
- `modeDetection.test.ts`: 13 tests

## Edge Cases Covered

| # | Edge Case | Test Description | Result |
|---|-----------|-----------------|--------|
| 1 | Invoice < tax (remaining=0) | taxPct=100 returns only tax move | Pass |
| 2 | Stabilize partial fill by priority | Greedy stop when remaining=0 | Pass |
| 3 | Distribute exact sum | splitCents largest-remainder no cent lost | Pass |
| 4 | Buffer unfunded + all floors covered | stabilize mode, no buffer top-up move | Pass |
| 5 | Empty overflowRatios | unallocated move, 0 cents dropped | Pass |
| 6 | Expired floor items excluded | expiryDate < today filtered out | Pass |

## Requirements Satisfied

- **ALLOC-01:** Tax move always first, uses pctOf (Math.floor) — satisfied
- **ALLOC-02:** Mode auto-detected via detectMode (buffer + floor status) — satisfied
- **ALLOC-03:** Stabilize fills floors in priority order, stops at remaining=0 — satisfied
- **ALLOC-04:** Tax withholding percentage applied from settings.taxPct — satisfied
- **ALLOC-05:** Distribute uses splitCents (largest-remainder, exact sums) — satisfied
- **ALLOC-06:** Every AllocationMove has non-empty calculation, rule, and reason strings — satisfied

## Purity Contract

- Zero React imports
- Zero Zustand imports
- Zero window/document/localStorage references
- Verified: `grep -n "React\|Zustand\|window\|document\|localStorage" src/domain/allocationEngine.ts` returns empty

## Deviations from Plan

None — plan executed exactly as written.

**Pre-existing build issue (out of scope):** `src/domain/floorCalculator.test.ts` has an unused `Cents` import causing a TS6133 error in `tsc -b` build. This is a pre-existing issue not caused by this plan's changes. `npx tsc --noEmit` shows zero errors in allocationEngine files. Logged to deferred items.

## Self-Check

Files created:
- [x] `src/domain/allocationEngine.ts` — exists
- [x] `src/domain/allocationEngine.test.ts` — exists
- [x] `02-03-SUMMARY.md` — this file

Test count: 75 passing (4 files)

## Self-Check: PASSED
