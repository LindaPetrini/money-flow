---
phase: 07-hardening
plan: "03"
subsystem: ui
tags: [react, file-system-access-api, indexeddb, settings, storage]

# Dependency graph
requires:
  - phase: 07-hardening
    provides: fsaDriver singleton exported from src/lib/storage/storage.ts
provides:
  - StorageSection component showing current storage mode (FSA or IDB)
  - Settings > Storage tab with folder-change button for FSA users
  - Clear IDB-only explanation for Firefox/Safari users
affects: [settings-ui, storage-discovery, user-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level singleton import pattern: StorageSection reads fsaDriver directly from storage.ts, no props needed"
    - "AbortError guard: try/catch on requestPermission() silently ignores user-cancelled directory picker"

key-files:
  created:
    - src/features/settings/StorageSection.tsx
  modified:
    - src/features/settings/SettingsPage.tsx

key-decisions:
  - "StorageSection derives state from module-level fsaDriver singleton (no props) — consistent with existing App.tsx pattern"
  - "AbortError from cancelled directory picker caught silently — no reload, no error shown to user"
  - "flex-wrap added to SettingsPage nav to handle 6 tabs on narrow viewports without overflow"

patterns-established:
  - "Storage mode visibility: always expose current storage mode in Settings so users can reason about data locality"

requirements-completed: [INFRA-04, INFRA-05]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 7 Plan 03: Storage Settings Summary

**Storage settings tab added to SettingsPage — FSA users get "Change folder" button, IDB-only users get browser-local data explanation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T18:09:02Z
- **Completed:** 2026-02-28T18:10:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created StorageSection component with two display states: FSA file storage (Chrome/Edge) and IDB browser storage (Firefox/Safari)
- Wired StorageSection into SettingsPage as a sixth tab ("Storage"), added after "CSV & AI"
- Added flex-wrap to the Settings nav bar so all 6 tabs display correctly on narrow viewports
- Closed both UAT gaps: folder-change is now discoverable via Settings > Storage, and storage mode is now always visible
- Build and all 114 tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create StorageSection component** - `cadfec9` (feat)
2. **Task 2: Wire StorageSection into SettingsPage** - `baedbed` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `src/features/settings/StorageSection.tsx` - New component; shows FSA info + "Change folder" button or IDB-only explanation depending on fsaDriver
- `src/features/settings/SettingsPage.tsx` - Added 'storage' to SettingsSection type, SECTIONS array, StorageSection import, and render condition

## Decisions Made

- StorageSection reads fsaDriver directly from storage.ts module (no props) — same pattern as App.tsx handleGrantAccess, avoids prop-drilling
- AbortError silently caught — if user cancels the directory picker, nothing happens (no crash, no reload)
- flex-wrap on nav keeps all 6 tabs accessible on narrow screens

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 phases complete. Both UAT gaps (folder-change discovery, storage mode visibility) are now closed.
- Build: clean (`npm run build` passes)
- Tests: 114/114 passing
- No blockers

## Self-Check: PASSED

- FOUND: src/features/settings/StorageSection.tsx
- FOUND: src/features/settings/SettingsPage.tsx
- FOUND: commit cadfec9 (feat(07-03): create StorageSection component)
- FOUND: commit baedbed (feat(07-03): wire StorageSection into SettingsPage)

---
*Phase: 07-hardening*
*Completed: 2026-02-28*
