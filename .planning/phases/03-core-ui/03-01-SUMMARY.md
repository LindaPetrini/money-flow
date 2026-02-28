---
phase: 03-core-ui
plan: "01"
subsystem: bootstrap
tags: [seed, stores, defaultConfig, init]
dependency_graph:
  requires: []
  provides: [default-account-seed, settings-seed, store-init-sequence]
  affects: [src/main.tsx, src/stores/accountStore.ts, src/stores/settingsStore.ts]
tech_stack:
  added: []
  patterns: [idempotent-seed, guard-before-render]
key_files:
  created:
    - src/lib/defaultConfig.ts
    - src/lib/bootstrap.ts
  modified:
    - src/main.tsx
decisions:
  - "overflowRatios.length === 0 used as proxy for unconfigured settings (not taxAccountId === '') to avoid re-seeding edge cases"
  - "seedIfEmpty placed after Promise.all store load so all initialized guards pass before any writes"
metrics:
  duration: "5m"
  completed: "2026-02-28"
  tasks_completed: 2
  files_changed: 3
---

# Phase 3 Plan 01: Default Config Seed + Bootstrap Summary

**One-liner:** Idempotent first-run seeding of 5 accounts and full settings via seedIfEmpty() wired into the init sequence.

## What Was Built

Two new files provide first-run store seeding:

- `src/lib/defaultConfig.ts` exports `DEFAULT_ACCOUNTS` (5 typed Account objects) and `DEFAULT_SETTINGS` (full Settings with overflow ratios summing to 100% and a rent floor item at €1,200/month).
- `src/lib/bootstrap.ts` exports `seedIfEmpty()` which checks whether the stores have data and seeds defaults only if empty — fully idempotent on subsequent runs.
- `src/main.tsx` now calls `await seedIfEmpty()` between the parallel store load (`Promise.all`) and the React render, ensuring stores are initialized before any write attempts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create default configuration seed data | b6f5e5e | src/lib/defaultConfig.ts |
| 2 | Create seedIfEmpty bootstrap + wire into main.tsx | f21856e | src/lib/bootstrap.ts, src/main.tsx |

## Verification

- `npm run build` exits 0 (41 modules, 1.81s)
- `npx tsc --noEmit` exits 0
- `grep -n "seedIfEmpty" src/main.tsx` shows calls at lines 9 (import) and 20 (await call)
- `DEFAULT_ACCOUNTS` present in defaultConfig.ts with 5 accounts

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Proxy for unconfigured settings:** Used `settings.overflowRatios.length === 0` rather than checking `taxAccountId === ''` because overflowRatios is the field most indicative of a configured state and is less likely to be legitimately empty.
2. **seedIfEmpty after Promise.all:** All three stores' `initialized` guards require `loadAccounts`/`loadSettings` to complete first. Calling seedIfEmpty in the same Promise.all would race against initialization.

## Self-Check

- `src/lib/defaultConfig.ts` exists: FOUND
- `src/lib/bootstrap.ts` exists: FOUND
- `src/main.tsx` updated: FOUND
- Commits b6f5e5e and f21856e: FOUND
