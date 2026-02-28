---
phase: 02-allocation-engine
verified: 2026-02-28T15:02:00Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "npm run build succeeds with no TypeScript errors"
    status: failed
    reason: "floorCalculator.test.ts line 2 imports `Cents` as a type but never uses it; noUnusedLocals: true causes tsc to fail"
    artifacts:
      - path: "src/domain/floorCalculator.test.ts"
        issue: "Line 2: `import type { Cents } from '@/lib/cents';` — Cents is never used in the test file (TS6133: declared but value never read)"
    missing:
      - "Remove the unused `Cents` import from src/domain/floorCalculator.test.ts line 2"
---

# Phase 2: Allocation Engine Verification Report

**Phase Goal:** The Stabilize/Distribute allocation logic is fully implemented and tested as pure TypeScript with zero React dependencies.
**Verified:** 2026-02-28T15:02:00Z
**Status:** GAPS_FOUND — 1 of 5 success criteria failed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Given a floor state and buffer balance, engine auto-detects correct mode (no user toggle) | VERIFIED | `detectMode()` in `modeDetection.ts` is called by `allocationEngine.ts` line 69; no user toggle exists anywhere in the domain |
| 2 | Stabilize mode generates priority-ordered move instructions covering uncovered floors until invoice exhausted or all floors funded | VERIFIED | `stabilize()` in `allocationEngine.ts` calls `sortedActiveUncoveredFloors` (priority-sorted) and greedy-fills; 21 engine tests pass |
| 3 | Distribute mode generates split instructions summing exactly to invoice amount (no cent left over) | VERIFIED | `splitCents` (largest-remainder) used in `distribute()`; test "distribute handles odd cent counts exactly" confirms; 21/21 engine tests pass |
| 4 | Every generated move includes calculation, rule, and reason in human-readable form | VERIFIED | `AllocationMove` interface requires `calculation: string`, `rule: string`, `reason: string`; test "every move has...rule, calculation, reason" passes; all three branches (tax/floor/distribute) populate all fields |
| 5 | All engine functions callable from Vitest in Node environment with no browser globals | VERIFIED (runtime) / FAILED (build) | Tests: 75/75 pass in Vitest Node environment. Build: `npm run build` fails with TS6133 on unused import in test file |

**Score:** 4/5 success criteria verified (all runtime behavior correct; one build error)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domain/modeDetection.ts` | `detectMode()` pure function, no browser deps | VERIFIED | 37 lines, pure, imports only `@/types/domain`; no React/window/document |
| `src/domain/modeDetection.test.ts` | Vitest tests for all mode paths | VERIFIED | 13 tests, all pass; covers buffer-only, floor-only, combined conditions, expiry edge cases |
| `src/domain/floorCalculator.ts` | `sortedActiveUncoveredFloors` + `totalUncoveredCents` | VERIFIED | 51 lines, pure; imports only `@/types/domain` and `@/lib/cents` |
| `src/domain/floorCalculator.test.ts` | Vitest tests for filter/sort paths | VERIFIED (runtime) / HAS ISSUE | 16 tests pass; has unused `import type { Cents }` on line 2 causing TS build error |
| `src/domain/allocationEngine.ts` | `computeAllocation()` three-stage pipeline | VERIFIED | 157 lines, pure; imports only `@/lib/cents`, `@/types/domain`, `./modeDetection`, `./floorCalculator` |
| `src/domain/allocationEngine.test.ts` | Vitest tests for all allocation paths and edge cases | VERIFIED | 21 tests, all pass; covers edge cases 1-6, mode detection, exact sum, move shape |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `allocationEngine.ts` | `modeDetection.ts` | `import { detectMode }` + called at line 69 | WIRED | `detectMode(bufferAccount, settings, today)` called in main path and early-return path |
| `allocationEngine.ts` | `floorCalculator.ts` | `import { sortedActiveUncoveredFloors }` + called at line 98 | WIRED | Called inside `stabilize()` function |
| `allocationEngine.ts` | `@/lib/cents` | `import { pctOf, subCents, formatCents, splitCents }` | WIRED | All four used: pctOf (tax), subCents (remaining), formatCents (calculation strings), splitCents (distribute) |
| `allocationEngine.ts` | `@/types/domain` | `import type { Account, Settings, AllocationMove }` | WIRED | All three types used in function signatures and return type |
| `modeDetection.ts` | `@/types/domain` | `import type { Account, Settings }` | WIRED | Both types used in `detectMode` signature |
| `floorCalculator.ts` | `@/types/domain` | `import type { FloorItem }` | WIRED | Used in both function signatures |
| `floorCalculator.ts` | `@/lib/cents` | `import type { Cents }` + `import { addCents }` | WIRED | `addCents` used in `totalUncoveredCents` reduce |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ALLOC-01 | 02-01, 02-03 | Auto-detect mode (no user toggle) | SATISFIED | `detectMode()` derives mode from data state; no toggle in domain code |
| ALLOC-02 | 02-02, 02-03 | Stabilize mode priority-ordered moves | SATISFIED | `sortedActiveUncoveredFloors` sorts by `priority` ascending; greedy fill in order |
| ALLOC-03 | 02-03 | Distribute mode exact sum | SATISFIED | `splitCents` (largest-remainder) guarantees sum = remaining; test verified |
| ALLOC-04 | 02-03 | Tax allocation first | SATISFIED | Tax move always pushed first in `computeAllocation` before mode branch |
| ALLOC-05 | 02-03 | Every move has calculation, rule, reason | SATISFIED | `AllocationMove` type mandates all three; all branches populate non-empty strings |
| ALLOC-06 | 02-01, 02-02, 02-03 | Pure TypeScript, zero React/browser deps | SATISFIED (domain code) | No React, Zustand, window, document, or localStorage in any of the three domain files |

---

## Test Results

```
Test Files  4 passed (4)
     Tests  75 passed (75)

 src/domain/allocationEngine.test.ts  21 tests  PASS
 src/lib/cents.test.ts                25 tests  PASS
 src/domain/floorCalculator.test.ts   16 tests  PASS
 src/domain/modeDetection.test.ts     13 tests  PASS
```

**Runtime verdict:** All 75 tests pass. Vitest runs in Node environment with zero browser globals required.

---

## Build Result

```
npm run build — EXIT CODE 2

src/domain/floorCalculator.test.ts(2,1): error TS6133:
  'Cents' is declared but its value is never read.
```

**Root cause:** `floorCalculator.test.ts` line 2 has `import type { Cents } from '@/lib/cents'` which TypeScript flags as unused under `noUnusedLocals: true`. The `Cents` type is never referenced in the test file body. This is a trivial one-line fix (remove the import).

**Impact:** The domain implementation files (`modeDetection.ts`, `floorCalculator.ts`, `allocationEngine.ts`) all build cleanly — the error is only in the test file.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/domain/floorCalculator.test.ts` | 2 | Unused type import: `import type { Cents }` | Warning | Causes `npm run build` to fail (noUnusedLocals) |

No stub implementations found. No TODO/FIXME/placeholder comments in domain files. No empty return values in business logic paths.

---

## Purity Verification

Checked all three domain files for prohibited imports:

- React: NOT FOUND
- Zustand: NOT FOUND
- `window`: NOT FOUND
- `document`: NOT FOUND
- `localStorage`: NOT FOUND
- `new Date()` inside functions: NOT FOUND (all functions accept `today` parameter)

All domain files are pure: data-in, data-out, no side effects.

---

## Gaps Summary

One gap blocks full phase sign-off:

**Build failure:** `src/domain/floorCalculator.test.ts` line 2 contains an unused `import type { Cents }` that was likely left over from an earlier draft of the test. The TypeScript compiler (strict mode, `noUnusedLocals: true`) rejects it. The fix is a single-line deletion. All business logic is correct and all tests pass — this is a test-file hygiene issue, not a logic bug.

**Fix required:** Delete line 2 of `src/domain/floorCalculator.test.ts`:
```
import type { Cents } from '@/lib/cents';
```

After that fix, `npm run build` should succeed and the phase can be marked fully passed.

---

_Verified: 2026-02-28T15:02:00Z_
_Verifier: Claude (gsd-verifier)_
