---
phase: 04-configuration
plan: "04"
subsystem: settings-ui
tags: [settings, overflow-ratios, tax, buffer, react]
dependency_graph:
  requires: [04-02, 04-03]
  provides: [CONFIG-04, CONFIG-05, CONFIG-06]
  affects: [settings-page]
tech_stack:
  added: []
  patterns: [dirty-flag-sync, lazy-useState-init]
key_files:
  created:
    - src/features/settings/OverflowRatiosSection.tsx
    - src/features/settings/TaxBufferSection.tsx
  modified:
    - src/features/settings/SettingsPage.tsx
decisions:
  - "Used dirty flag in OverflowRatiosSection to prevent useEffect from overwriting in-progress edits"
  - "Used useState lazy initializer in TaxBufferSection to avoid stale closure issues from useEffect"
  - "parseCents used for bufferTargetStr conversion on save"
metrics:
  completed: "2026-02-28"
  tasks: 2
  files: 3
---

# Phase 04 Plan 04: Overflow Ratios and Tax/Buffer Settings Summary

Built the OverflowRatiosSection and TaxBufferSection components and wired both into SettingsPage, completing the final three settings dimensions (CONFIG-04, CONFIG-05, CONFIG-06).

## What Was Built

### OverflowRatiosSection

Overflow ratio editor with per-row percentage inputs and a running total badge. The Save button is disabled (and total shown in red) when ratios do not sum to exactly 100.

Key design decisions:

**Dirty flag pattern:** `localRatios` mirrors `settings.overflowRatios` but as strings for editing. A `dirty: boolean` flag is set to `true` on any user edit. The `useEffect` that syncs from the store only runs when `!dirty`, preventing it from overwriting in-progress user input when the store updates (e.g., after a save that triggers a re-render).

**Total validity:** `Math.round(total) === 100` is used as the validity check, allowing floating-point values like 33.33/33.33/33.34 to pass.

**Revert:** Resets `localRatios` to current persisted store values and clears `dirty`, re-enabling the sync effect.

**Add dropdown:** Shows only accounts not yet present in `localRatios` (computed as `accountsNotInRatios`). Selecting an account appends a row with `pctStr: '0'`.

### TaxBufferSection

Simple form with four fields saved in one click:
- Tax percentage (0-100, validated)
- Tax account selector
- Buffer target in euros (converted to cents via `parseCents` on save)
- Buffer account selector

**useState lazy initializer:** All four fields are initialized via `useState(() => ...)` using the store value at mount. This avoids the stale closure issue that arises when using `useEffect` for initialization — the selector returns a new reference each render, which would cause a re-initialization loop.

`bufferTargetStr` is initialized as `(settings.bufferTargetCents / 100).toFixed(2)` for a clean display like `"3000.00"`. On save, `parseCents(bufferTargetStr)` converts back to integer cents.

### SettingsPage Updates

Added two imports and replaced the two placeholder divs with the new components:

```tsx
import { OverflowRatiosSection } from './OverflowRatiosSection';
import { TaxBufferSection } from './TaxBufferSection';

{activeSection === 'overflow-ratios' && <OverflowRatiosSection />}
{activeSection === 'tax-buffer' && <TaxBufferSection />}
```

## Final State of All Four Sub-Tabs

- **Accounts** — AccountsSection (from 04-02)
- **Floor Items** — FloorItemsSection (from 04-03)
- **Overflow Ratios** — OverflowRatiosSection (this plan)
- **Tax & Buffer** — TaxBufferSection (this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm run build` passes with no TypeScript errors
- `npm test` passes: 75 tests across 4 test files
