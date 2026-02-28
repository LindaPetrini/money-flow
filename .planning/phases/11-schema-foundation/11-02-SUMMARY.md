---
phase: 11-schema-foundation
plan: 02
subsystem: ui
tags: [zustand, dark-mode, merchant, storage, tailwind]

# Dependency graph
requires:
  - phase: 11-01
    provides: MerchantEntry type, PersistedMerchants type, Settings.theme field
provides:
  - merchantStore with load/upsert/lookup actions and initialized guard
  - applyTheme() side-effect in settingsStore (load + update)
  - startup Promise.all includes loadMerchants()
affects: [12-dark-mode, 13-ai-qa, phase-12, phase-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Initialized-guard pattern: all Zustand write actions check !get().initialized before mutating"
    - "Module-level applyTheme helper: NOT exported, NOT inside store — called from loadSettings/updateSettings"
    - "matchMedia guard for jsdom safety: typeof window !== 'undefined' && window.matchMedia != null"

key-files:
  created:
    - src/stores/merchantStore.ts
  modified:
    - src/stores/settingsStore.ts
    - src/main.tsx

key-decisions:
  - "lookupMerchant has NO initialized guard — returning undefined is correct 'not found' behavior; initialized=false is equivalent to nothing loaded"
  - "upsertMerchant uses case-sensitive merchantName matching — no normalization; Phase 13 determines case sensitivity strategy"
  - "applyTheme placed at module level (not exported) between DEFAULT_SETTINGS and create() call"
  - "storage key 'merchants' confirmed as unused by all other stores"

patterns-established:
  - "New Zustand store pattern: initialized flag, load action (read+set+initialized=true), write action (guard+set+write+NotAllowedError catch), sync query action (no guard)"
  - "applyTheme call order: set() first, then applyTheme() — state is authoritative before DOM side-effect"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 11 Plan 02: Schema Foundation Summary

**Zustand merchantStore with initialized-guard CRUD, theme applyTheme side-effect wired into settingsStore, and all four stores parallel-loaded at startup**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T20:14:58Z
- **Completed:** 2026-02-28T20:22:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `merchantStore.ts` from scratch following `accountStore.ts` pattern: initialized guard on writes, atomic set({data, initialized:true}) on load, case-sensitive lookupMerchant returning undefined (not throwing)
- Added module-level `applyTheme()` to `settingsStore.ts` with jsdom-safe matchMedia guard, called on loadSettings and conditionally on updateSettings when patch.theme is present
- Wired `useMerchantStore.getState().loadMerchants()` into `main.tsx` Promise.all so all four stores load in parallel before render
- 116 tests pass, zero regressions; build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create merchantStore.ts** - `4e6c1c9` (feat)
2. **Task 2: Add applyTheme to settingsStore and wire merchantStore into main.tsx** - `3369472` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified
- `src/stores/merchantStore.ts` - New Zustand store for merchant-bucket associations; load/upsert/lookup with initialized guard
- `src/stores/settingsStore.ts` - Added applyTheme() helper, theme:'system' to DEFAULT_SETTINGS, applyTheme calls in loadSettings/updateSettings
- `src/main.tsx` - Added useMerchantStore import and loadMerchants() in startup Promise.all

## Decisions Made
- `lookupMerchant` has no initialized guard — returning `undefined` is the correct "not found" response; adding a guard would make it return `undefined` both for "not found" and "not loaded yet", which is semantically identical and not a correctness issue
- `upsertMerchant` uses case-sensitive `merchantName` matching, preserving what was entered — Phase 13 will determine final normalization strategy during QA prompt engineering
- `applyTheme` is not exported — it is a private side-effect helper, not part of the store's public API
- Storage key `'merchants'` confirmed unused by accountStore, allocationStore, settingsStore

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five Phase 11 success criteria are now satisfied:
  1. `MerchantEntry` type exists (11-01)
  2. `PersistedMerchants` alias exists (11-01)
  3. `Settings.theme` field exists (11-01)
  4. `merchantStore` with initialized-guard pattern (this plan)
  5. `applyTheme()` in settingsStore + startup wiring (this plan)
- Phase 12 (dark mode toggle) can call `updateSettings({ theme: 'dark' | 'light' | 'system' })` and the DOM will update automatically
- Phase 13 (AI QA) can call `useMerchantStore.getState().upsertMerchant()` and `lookupMerchant()` for merchant memory
- No blockers

---
*Phase: 11-schema-foundation*
*Completed: 2026-02-28*
