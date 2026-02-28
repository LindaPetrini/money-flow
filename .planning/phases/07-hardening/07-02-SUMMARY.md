---
phase: 07-hardening
plan: 02
subsystem: ui
tags: [react, storage, fsa, idb, ux, error-handling]

# Dependency graph
requires:
  - phase: 07-hardening plan 01
    provides: StorageErrorContext with StorageErrorProvider, useStorageError, and reportPermissionLost

provides:
  - StorageErrorProvider wired into app root (main.tsx)
  - Blocking permission-lost overlay in App.tsx (fixed inset-0 z-50, Re-grant access button)
  - Dismissible amber IDB notice banner for Firefox/Safari users
  - First-run onboarding card (Welcome to Money Flow, Choose data folder)
  - Returning-visit reconnect banner for users with lapsed FSA permission

affects: [all future phases that extend App.tsx, any UI work involving storage states]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Blocking overlay pattern for irrecoverable state (no dismiss, forces user action)
    - Progressive disclosure for storage UX (different UI for first-run vs returning user)
    - localStorage for persist-across-reload UI dismissal state

key-files:
  created: []
  modified:
    - src/main.tsx
    - src/App.tsx

key-decisions:
  - "handleGrantAccess simplified — no store reloads before window.location.reload(); init() in main.tsx already re-runs all store loads on reload"
  - "isFirstRun = needsFsaPrompt && accounts.length === 0 — combines FSA prompt flag with empty accounts to detect genuine first-run vs permission lapse"
  - "IDB banner gated on fsaDriver === null (not just storageMode === 'idb') — avoids showing banner during FSA permission-pending flow where fsaDriver exists but needs a click"
  - "idbNoticeDismissed initialized from localStorage via useState lazy initializer — persists across reloads without useEffect"

patterns-established:
  - "Blocking overlay: fixed inset-0 z-50 with no close option — forces user action for irrecoverable state"
  - "Dismissal persistence: localStorage.setItem on dismiss, useState(() => localStorage.getItem() === '1') for init"

requirements-completed: [INFRA-04, INFRA-05]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 7 Plan 02: App Storage Hardening UX Summary

**Blocking permission-lost overlay, dismissible Firefox/Safari IDB banner, and first-run onboarding card wired into App.tsx via StorageErrorProvider**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T17:30:00Z
- **Completed:** 2026-02-28T17:35:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Wired `StorageErrorProvider` into `main.tsx` app root so all descendants can access `useStorageError()`
- Implemented blocking overlay rendered when `permissionLost === true` — no dismiss option, forces Re-grant access click
- Implemented dismissible amber banner shown on true Firefox/Safari (storageMode === 'idb' && fsaDriver === null) with localStorage persistence for dismiss state
- Implemented first-run onboarding card (Welcome to Money Flow) shown before any UI when needsFsaPrompt && accounts.length === 0
- Implemented returning-visit reconnect banner for users with existing data but lapsed FSA permission
- Removed old "Grant folder access" banner and old header storage-mode indicator text

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap App in StorageErrorProvider in main.tsx** - `9da2bf7` (feat)
2. **Task 2: Implement overlay, IDB banner, and onboarding card in App.tsx** - `4c0d6b5` (feat)

## Files Created/Modified
- `src/main.tsx` - Added StorageErrorProvider import and wrapper around App inside StrictMode
- `src/App.tsx` - Full rewrite: permission-lost overlay, IDB amber banner, first-run onboarding card, reconnect banner; removed old banner and header text

## Decisions Made
- `handleGrantAccess` simplified — removed the pre-reload store loads (loadAccounts/loadHistory/loadSettings). The `window.location.reload()` causes `init()` in main.tsx to re-run, which already calls all store loads. Doing it twice was redundant.
- `isFirstRun` uses `needsFsaPrompt && accounts.length === 0` rather than just `needsFsaPrompt` — distinguishes genuine first-time users (no data yet) from returning users who need to re-grant access.
- IDB banner condition is `storageMode === 'idb' && fsaDriver === null` — the `fsaDriver === null` check avoids showing the banner in the FSA permission-pending flow where fsaDriver is non-null (Chrome/Edge without permission yet).
- `idbNoticeDismissed` uses lazy initializer `() => localStorage.getItem('idb_notice_dismissed') === '1'` — reads localStorage once on mount without requiring a useEffect.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 complete — all hardening goals achieved
- FSA permission loss: blocking overlay triggers clear re-prompt dialog, normal operation resumes after re-grant
- Firefox/Safari: explicit "browser-local" notice shown, dismissible, persists across reloads
- First-run: onboarding card guides users to choose data directory before any allocation work
- Build: `npm run build` passes, 114 tests passing (5 test files), no TypeScript errors

---
*Phase: 07-hardening*
*Completed: 2026-02-28*
