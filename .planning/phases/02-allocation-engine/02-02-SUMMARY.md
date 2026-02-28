---
phase: 02-allocation-engine
plan: "02"
subsystem: domain
tags: [pure-functions, floor-calculator, tdd, allocation]
dependency_graph:
  requires: [src/types/domain.ts, src/lib/cents.ts]
  provides: [sortedActiveUncoveredFloors, totalUncoveredCents]
  affects: [allocationEngine.ts]
tech_stack:
  added: []
  patterns: [pure-functions, branded-types, tdd-red-green]
key_files:
  created:
    - src/domain/floorCalculator.ts
    - src/domain/floorCalculator.test.ts
  modified: []
decisions:
  - "totalUncoveredCents delegates to sortedActiveUncoveredFloors to avoid duplicated filter logic"
  - "Non-mutating sort: .filter() produces new array, .sort() operates on that new array only"
  - "today parameter with default enables deterministic date-sensitive testing without mocking"
metrics:
  duration: "~3 minutes"
  completed: "2026-02-28"
---

# Phase 02 Plan 02: floorCalculator Pure Functions Summary

Pure functions `sortedActiveUncoveredFloors` and `totalUncoveredCents` with full Vitest coverage applying triple filter (active AND not-covered AND not-expired) sorted by priority ascending.

## Files Created

- `src/domain/floorCalculator.ts` — implementation (45 lines)
- `src/domain/floorCalculator.test.ts` — tests (130 lines)

## Test Results

16 tests passing (0 failing):
- `sortedActiveUncoveredFloors`: 11 tests covering empty array, single item, active filter, coveredThisMonth filter, expiry boundary (expired/today/future/undefined), sort order, non-mutation, and combined filters
- `totalUncoveredCents`: 5 tests covering empty array, sum, covered exclusion, expired exclusion, and all-excluded case

## Key Exports

- `sortedActiveUncoveredFloors(floorItems: FloorItem[], today?: string): FloorItem[]`
- `totalUncoveredCents(floorItems: FloorItem[], today?: string): Cents`

## Filter Logic

```
active === true
AND coveredThisMonth === false
AND (expiryDate === undefined OR expiryDate >= today)
```

Sorted ascending by `priority` (lower number = higher priority = first).

## Constraints Verified

- No React, Zustand, or store imports in `floorCalculator.ts`
- No `window`, `document`, or `localStorage` references
- Sort is non-mutating: `.filter()` creates new array, `.sort()` operates on that new array
- `totalUncoveredCents` delegates filtering to `sortedActiveUncoveredFloors` — no duplicated logic

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/domain/floorCalculator.ts` exists
- [x] `src/domain/floorCalculator.test.ts` exists
- [x] 16/16 tests pass
