---
phase: 04-configuration
plan: 03
subsystem: settings/floor-items
tags: [settings, floor-items, crud, expiry, zustand]
dependency_graph:
  requires: [04-01]
  provides: [floor-item-crud, expiry-auto-deactivation]
  affects: [settings-page]
tech_stack:
  added: []
  patterns: [draft-string-fields, useEffect-auto-deactivation, sorted-display]
key_files:
  created:
    - src/features/settings/FloorItemsSection.tsx
  modified:
    - src/features/settings/SettingsPage.tsx
decisions:
  - "FloorItemDraft uses amountStr and priorityStr as strings to prevent mid-edit float coercion"
  - "Expiry auto-deactivation runs in useEffect on every floorItems change, not on demand"
  - "Expired items show both Expired badge AND remain visible (not filtered out)"
metrics:
  duration: ~10m
  completed: 2026-02-28
  tasks_completed: 2
  files_modified: 2
---

# Phase 4 Plan 03: Floor Items CRUD with Expiry Auto-Deactivation Summary

Floor items CRUD UI implemented in `FloorItemsSection`, wired into `SettingsPage` Floor Items sub-tab; expiry auto-deactivation runs via `useEffect` on every render cycle.

## What Was Built

### FloorItemsSection (`src/features/settings/FloorItemsSection.tsx`)

A complete CRUD interface for `FloorItem` records stored in `settingsStore.settings.floorItems`.

**Key design decisions:**

**1. FloorItemDraft uses string fields for numeric values**

```typescript
type FloorItemDraft = {
  name: string;
  amountStr: string;      // e.g. '1200.00' — converted to cents on save
  priorityStr: string;    // e.g. '1' — converted to number on save
  destinationAccountId: string;
  expiryDate: string;     // '' = no expiry
};
```

This prevents partial-input loss during typing. If the user types "12" on the way to "1200", storing an intermediate float (12) and displaying it back as "12.00" would reset their cursor. String fields avoid all mid-edit parsing.

Conversion to `amountCents` (via `parseCents`) and `priority` (via `parseInt`) only happens on Save/Add.

**2. Expiry auto-deactivation via useEffect**

```typescript
useEffect(() => {
  const today = new Date().toISOString().slice(0, 10);
  const hasExpired = floorItems.some(
    item => item.active && item.expiryDate && item.expiryDate < today
  );
  if (hasExpired) {
    const updated = floorItems.map(item =>
      item.active && item.expiryDate && item.expiryDate < today
        ? { ...item, active: false }
        : item
    );
    updateSettings({ floorItems: updated });
  }
}, [floorItems, updateSettings]);
```

This runs on every render when `floorItems` changes. It is idempotent (checks `item.active` before marking false, uses `hasExpired` guard to avoid needless writes). If an item's `expiryDate` is in the past and it is still `active: true`, it is immediately set to `active: false` and persisted.

**3. Display**

- Items sorted ascending by `priority` before rendering
- Each row shows: `#N` priority badge, name, formatted amount, destination account name, optional expiry info
- Expired items (expiryDate < today): "Expired" badge in destructive color
- Inactive but not expired items: "Inactive" badge in muted color
- Edit row uses inline inputs for all fields; date input for expiry (empty = no expiry)

**4. Edge case: no accounts**

If `accounts.length === 0`, the section renders a warning instead of the list/add form:

```
No accounts configured — add accounts first.
```

### SettingsPage (`src/features/settings/SettingsPage.tsx`)

Two changes only:

1. Added import: `import { FloorItemsSection } from './FloorItemsSection';`
2. Replaced placeholder div with `<FloorItemsSection />` in the `floor-items` tab

## Deviations from Plan

None — plan executed exactly as written. The SettingsPage already had `AccountsSection` imported (from plan 04-02 which ran before this one), so the import addition was clean.

## Verification

- `npm run build`: passes (170 modules, no TypeScript errors)
- `npm test`: 75 tests pass (4 test files, no regressions)
- FloorItemsSection renders correctly in Settings > Floor Items tab
- All writes go through `updateSettings({ floorItems: [...] })`
- `parseCents` used for all amount string-to-cents conversions
- No floats stored in persisted data
