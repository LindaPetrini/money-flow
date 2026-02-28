---
plan: 10-02
phase: 10
status: complete
completed: 2026-02-28
---

# Plan 10-02 Summary: Fix INFRA-04 — First-Run Detection Decoupled

## What Was Built

Fixed the INFRA-04 UX defect in `src/App.tsx`. Changed `isFirstRun = needsFsaPrompt && accounts.length === 0` to `isFirstRun = needsFsaPrompt`. Also removed the now-unused `accounts` const and `useAccountStore` import to keep the file clean and avoid TypeScript `noUnusedLocals` errors.

The fix ensures returning Chrome users who have no accounts see the onboarding card (with "Choose data folder" button) instead of a broken empty dashboard state.

## Key Files

key-files:
  modified:
    - src/App.tsx — removed accounts/useAccountStore, simplified isFirstRun to `needsFsaPrompt` alone

## Test Results

- 116 tests pass (all passing)
- npm run build: success (1878 modules)

## Commits

- fix(infra-04): decouple isFirstRun from accounts.length — use needsFsaPrompt alone, remove unused accountStore import (e8dcae9)

## Self-Check: PASSED

Both tasks complete. No TypeScript errors. All tests pass. Build clean.
