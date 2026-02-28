---
phase: 02-allocation-engine
plan: 01
subsystem: domain
tags: [tdd, pure-function, mode-detection, allocation-engine]
dependency_graph:
  requires: [src/types/domain.ts]
  provides: [src/domain/modeDetection.ts]
  affects: [allocation engine entry point]
tech_stack:
  added: []
  patterns: [pure function, TDD red-green, parameter-injected today]
key_files:
  created:
    - src/domain/modeDetection.ts
    - src/domain/modeDetection.test.ts
  modified: []
decisions:
  - today is injected as a parameter (default: new Date().toISOString().slice(0,10)) to keep function pure and tests deterministic
  - OR logic: buffer underfunded OR any active uncovered non-expired floor item triggers stabilize
  - Buffer deficit does NOT generate allocation moves in v1 — mode detection only
metrics:
  duration: ~5min
  completed: 2026-02-28
---

# Phase 02 Plan 01: detectMode Pure Function Summary

**One-liner:** Pure `detectMode` function that auto-detects Stabilize vs Distribute mode using OR logic on buffer funding and floor item coverage.

## Files Created

| File | Purpose |
|------|---------|
| `src/domain/modeDetection.ts` | Pure function implementation, 37 lines |
| `src/domain/modeDetection.test.ts` | 13 Vitest tests covering all branches |

## Test Count

13 tests passing across 3 describe blocks:
- `buffer condition` (5 tests): undefined buffer, underfunded, zero balance, exact target, above target
- `floor item condition` (6 tests): uncovered active, all covered, inactive ignored, expired ignored, expires today included, no expiry included
- `buffer + floor interaction` (2 tests): underfunded despite covered floors, distribute only when both conditions satisfied

## Key Exports

```typescript
export function detectMode(
  bufferAccount: Account | undefined,
  settings: Settings,
  today: string = new Date().toISOString().slice(0, 10),
): 'stabilize' | 'distribute'
```

## Logic Summary

OR condition — returns `'stabilize'` when:
1. `bufferAccount` is undefined, OR
2. `bufferAccount.balanceCents < settings.bufferTargetCents`, OR
3. Any floor item where `f.active && !f.coveredThisMonth && (!f.expiryDate || f.expiryDate >= today)`

Returns `'distribute'` only when buffer is fully funded AND all active non-expired floor items are covered.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/domain/modeDetection.ts` exists
- [x] `src/domain/modeDetection.test.ts` exists
- [x] 13 tests pass
- [x] No React/Zustand/store imports
- [x] No window/document/localStorage references
- [x] `today` is a parameter with default (not called at top level)
- [x] OR logic for buffer + floor conditions
