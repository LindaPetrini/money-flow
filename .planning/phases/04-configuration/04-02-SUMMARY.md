---
phase: 04-configuration
plan: "02"
subsystem: settings
tags: [accounts, crud, settings, cents-safe]
dependency_graph:
  requires: [04-01]
  provides: [AccountsSection, accounts-crud]
  affects: [SettingsPage]
tech_stack:
  added: []
  patterns: [inline-edit, draft-pattern, targetStr-cents-safety, window-confirm-delete]
key_files:
  created:
    - src/features/settings/AccountsSection.tsx
  modified:
    - src/features/settings/SettingsPage.tsx
key_decisions:
  - "targetStr string field in draft avoids float storage mid-edit; parseCents called only on save"
  - "window.confirm() used for delete confirmation per plan spec"
  - "handleEdit pre-populates targetStr as (targetCents / 100).toFixed(2) — empty string when targetCents === 0"
metrics:
  duration: "~5 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_changed: 2
---

# Phase 4 Plan 02: Accounts CRUD Settings Section Summary

Account management UI with inline add/edit/delete, fully wired to accountStore via setAccounts().

## What Was Built

### AccountsSection component (`src/features/settings/AccountsSection.tsx`)

Full account list with two render modes per row:

**View mode:** Shows account name, role badge, target balance (or "No target" when `targetCents === 0`), and Edit/Delete action buttons.

**Edit mode:** Inline form with name text input, role select (all 5 options: income-hub, spending, savings, tax, investing), and target (€) text input. Save/Cancel buttons.

**Add form:** Shown below the list when `showAddForm` is true. Same fields as edit mode. "Add" button calls `setAccounts([...accounts, newAccount])` with a `crypto.randomUUID()` id and `balanceCents: 0`.

### State design

```typescript
const [editingId, setEditingId] = useState<string | null>(null);
const [draft, setDraft] = useState<{ name?: string; role?: AccountRole; targetStr?: string }>({});
const [showAddForm, setShowAddForm] = useState(false);
const [newAcc, setNewAcc] = useState<{ name: string; role: AccountRole; target: string }>({...});
```

### draft/targetStr pattern (cents safety)

The draft object uses `targetStr: string` instead of `targetCents: number` for the target balance text input. This prevents raw float storage during editing. On save, `parseCents(draft.targetStr)` converts once to integer cents. Similarly, when entering edit mode, `targetCents` is converted back to a display string via `(account.targetCents / 100).toFixed(2)` — empty string when zero (shows placeholder "0.00").

This pattern guarantees: floats never touch the Account type's `targetCents: number` field.

### SettingsPage update (`src/features/settings/SettingsPage.tsx`)

Two changes:
1. Added import: `import { AccountsSection } from './AccountsSection';`
2. Replaced placeholder `<div>Accounts configuration coming soon.</div>` with `<AccountsSection />`

## Handlers

- `handleEdit(account)` — sets editingId and pre-populates draft
- `handleSaveEdit()` — maps accounts, applies draft fields, calls `setAccounts()`, resets state
- `handleCancelEdit()` — resets editingId and draft without saving
- `handleDelete(account)` — prompts via `window.confirm()`, filters account out, calls `setAccounts(filtered)`
- `handleAdd()` — validates name not empty, creates Account with UUID, calls `setAccounts([...accounts, newAccount])`, resets add form

## Verification

- `npm run build`: passed (no TypeScript errors, 169 modules)
- `npm test`: 75/75 tests passed (no regressions)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/features/settings/AccountsSection.tsx`: FOUND
- `src/features/settings/SettingsPage.tsx`: FOUND (modified)
- Build: PASSED
- Tests: 75/75 PASSED
