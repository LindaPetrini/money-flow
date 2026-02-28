---
phase: 12-quick-wins
plan: 01
subsystem: ui
tags: [dark-mode, theme, tailwind, localStorage, FOUC]

# Dependency graph
requires:
  - phase: 11-schema-foundation
    provides: settingsStore with theme field already in Settings type
provides:
  - FOUC-free dark mode: inline script in <head> reads mf_theme before CSS paint
  - Three-state theme toggle (system/light/dark) in App header
  - localStorage mirror: applyTheme writes mf_theme on every theme change
  - Fixed Tailwind v4 dark variant selector to work on root element
affects: [App.tsx, settingsStore, index.html, index.css]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FOUC prevention via synchronous head script reading localStorage before React hydration
    - Three-state theme cycle using THEME_CYCLE lookup object

key-files:
  created: []
  modified:
    - index.html (FOUC-prevention inline script)
    - src/index.css (@custom-variant dark selector fix)
    - src/stores/settingsStore.ts (localStorage.setItem in applyTheme)
    - src/App.tsx (theme toggle button with Sun/Moon/Monitor icons)

key-decisions:
  - "Used IIFE in head script to avoid polluting global scope"
  - "THEME_CYCLE const object for O(1) cycle lookup: system->light->dark->system"
  - "localStorage try/catch in applyTheme to handle private browsing mode gracefully"
  - "Fixed @custom-variant dark to &:where(.dark, .dark *) so root element itself gets dark styles"

patterns-established:
  - "FOUC prevention pattern: synchronous head script + localStorage mirror key (mf_theme)"
  - "Theme toggle: useSettingsStore selector + updateSettings, no local state needed"

requirements-completed: [THEME-01, THEME-02, THEME-03]

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 12-01: Dark Mode Toggle Summary

**Three-state (system/light/dark) theme toggle with FOUC-free page loads — clicking the header icon cycles themes immediately without page reload.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T20:38:00Z
- **Completed:** 2026-02-28T20:46:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

### Task 1: FOUC prevention + CSS variant fix + localStorage mirror
- Added synchronous IIFE script in `<head>` before any CSS — reads `mf_theme` from localStorage and applies `.dark` class to `<html>` before React renders, eliminating white flash on dark-mode page loads
- Fixed `@custom-variant dark (&:is(.dark *))` → `(&:where(.dark, .dark *))` so `dark:` utility classes apply to the root element itself (not just descendants)
- Added `localStorage.setItem('mf_theme', theme)` in `applyTheme()` — the FOUC mirror: every theme change (both from toggle and initial load) writes to localStorage

### Task 2: Theme toggle button in App.tsx header
- Added `Sun`, `Moon`, `Monitor` icon imports from `lucide-react`
- Added `useSettingsStore` hook to read `settings.theme`
- Defined `THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' }` for O(1) cycling
- Added theme toggle button to right side of header flex container with `aria-label` describing current state

## Verification

- `grep -q "mf_theme" index.html` — PASS
- `grep -q "where(.dark" src/index.css` — PASS
- `grep -q "localStorage.setItem" src/stores/settingsStore.ts` — PASS
- `grep -q "THEME_CYCLE" src/App.tsx` — PASS
- `npm run build` — PASS (TypeScript clean, 310 kB bundle)
- `npm test` — PASS (116 tests)

## Self-Check: PASSED
