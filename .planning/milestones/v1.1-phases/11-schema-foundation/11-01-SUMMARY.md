---
phase: 11-schema-foundation
plan: 01
subsystem: database
tags: [typescript, domain-types, persistence, migration, zustand]

# Dependency graph
requires:
  - phase: 10-fix-integration-defects
    provides: stable AllocationRecord and Settings types that v1.1 extends
provides:
  - AllocationRecord.source optional field for client/project attribution
  - Settings.theme optional field for dark mode support
  - MerchantEntry interface for merchant-to-bucket mappings
  - PersistedMerchants type alias for FSA/IndexedDB storage
  - Read-time migration ensuring source is always string (never undefined) in memory
affects: [12-history-and-ui, 13-ai-csv-analysis, merchantStore]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-time migration pattern: normalize optional fields at load time, never write back, preserves backward compatibility"
    - "Type alias pattern: PersistedX mirrors domain type for stable persistence contract"

key-files:
  created: []
  modified:
    - src/types/domain.ts
    - src/types/persistence.ts
    - src/stores/allocationStore.ts

key-decisions:
  - "merchantName stored case-preserved (not lowercased) — Phase 13 research will determine case sensitivity strategy"
  - "source migration uses ?? '' (empty string) not ?? undefined — Phase 12 code can call record.source.toLowerCase() without null checks"
  - "Migration is read-time only (no disk write) — preserves backward compatibility with pre-v1.1 data files"

patterns-established:
  - "Read-time migration: inject default values for new optional fields at load, not at write"
  - "Type alias per persisted collection: PersistedMerchants = MerchantEntry[]"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 11 Plan 01: Schema Foundation Summary

**Three additive v1.1 domain types (AllocationRecord.source, Settings.theme, MerchantEntry) plus PersistedMerchants alias and a read-time migration that guarantees source is always a string in memory**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T20:11:51Z
- **Completed:** 2026-02-28T20:12:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `source?: string` to `AllocationRecord` and `theme?: 'light' | 'dark' | 'system'` to `Settings` — fully additive, no existing code needs to change
- Defined `MerchantEntry` interface with `merchantName`, `bucketAccountId`, and optional `context` fields, exported from `domain.ts`
- Added `PersistedMerchants = MerchantEntry[]` type alias to `persistence.ts` — Phase 11-02 can now create `merchantStore.ts`
- Implemented read-time migration in `allocationStore.loadHistory()` that maps every record to `source: record.source ?? ''` — in-memory only, no disk write

## Task Commits

Each task was committed atomically:

1. **Task 1: Add domain types — AllocationRecord.source, Settings.theme, MerchantEntry** - `6ad828a` (feat)
2. **Task 2: Add PersistedMerchants alias and read-time source migration** - `0c8320e` (feat)

## Files Created/Modified

- `src/types/domain.ts` — Added `source?: string` to AllocationRecord, `theme?: 'light' | 'dark' | 'system'` to Settings, new MerchantEntry interface
- `src/types/persistence.ts` — Added MerchantEntry import, exported `PersistedMerchants = MerchantEntry[]`
- `src/stores/allocationStore.ts` — loadHistory() maps records with `source: record.source ?? ''` before setting state

## Decisions Made

- `merchantName` stored case-preserved (not lowercased) — Phase 13 research will determine the case sensitivity strategy for merchant lookup
- Source field migration uses `?? ''` (empty string), not `?? undefined` — guarantees Phase 12 code can call `record.source.toLowerCase()` without null checks crashing
- Migration is read-time only (no disk write back) — preserves backward compatibility with data files written before v1.1

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both tasks applied cleanly. TypeScript type check, `npm run build`, and `npm test` (116 tests) all passed with zero errors or regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `MerchantEntry` and `PersistedMerchants` are now stable — Plan 11-02 can create `merchantStore.ts` immediately
- `AllocationRecord.source` is in place for Phase 12 history filtering UI
- `Settings.theme` is in place for Phase 12 dark mode implementation
- All 116 existing tests pass; zero regressions

---
*Phase: 11-schema-foundation*
*Completed: 2026-02-28*
