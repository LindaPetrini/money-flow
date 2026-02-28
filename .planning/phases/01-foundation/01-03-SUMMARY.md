---
plan: 01-03
phase: 01-foundation
status: complete
completed: 2026-02-28
---

# Summary: Plan 01-03 — Dual-Persistence Layer + Zustand Stores

## Storage Driver Implemented

**FsaDriver** (`src/lib/storage/fsaDriver.ts`):
- Implements StorageDriver interface
- FSA permission lifecycle: `init()` calls `queryPermission()` only — never `requestPermission()`
- Returns `true` if permission granted, `false` if `'prompt'` (stores handle in `pendingHandle`)
- `requestPermission()` MUST be called from user gesture only
- `write()` produces `JSON.stringify(data, null, 2)` (human-readable 2-space indent)
- `write()` re-throws `DOMException(NotAllowedError)` on background-tab revocation
- Uses IndexedDB `'money-flow-meta'` to persist directory handles between sessions

**IdbDriver** (`src/lib/storage/idbDriver.ts`):
- Implements StorageDriver interface
- Uses IndexedDB `'money-flow-data'` db with `'app-data'` object store
- `isAvailable()` always returns `true` (IDB works in all target browsers)

**bootstrapStorage()** (`src/lib/storage/storage.ts`):
- Returns `{ needsFsaPrompt: false, mode: 'fsa' }` when FSA permission already granted
- Returns `{ needsFsaPrompt: true, mode: 'idb' }` when FSA available but needs user gesture
- Returns `{ needsFsaPrompt: false, mode: 'idb' }` when FSA not available (Firefox/Safari)
- Never calls `requestPermission()` automatically

## Store List with Initialized Guard Confirmed

All three stores follow the identical pattern:
- Start with `initialized: false`
- `loadXxx()` sets `initialized: true` after reading from storage
- All write-path actions check `if (!get().initialized) return`
- No Zustand persist middleware — explicit `storage.write()` on every mutation

| Store | File | Key |
|-------|------|-----|
| useAccountStore | src/stores/accountStore.ts | `'accounts'` |
| useAllocationStore | src/stores/allocationStore.ts | `'history'` |
| useSettingsStore | src/stores/settingsStore.ts | `'settings'` |

## Build and Test Results

- `npm run build` ✓ exits 0 — no TypeScript errors
- `npm test` ✓ exits 0 — 25 passing (cents tests unaffected)
- `tsc --noEmit` ✓ exits 0

## Issues Encountered

**FSA API Type Definitions**: TypeScript's lib.dom.d.ts does not include `queryPermission()`, `requestPermission()` on `FileSystemHandle`, or `window.showDirectoryPicker()`. These are experimental APIs. Resolved by creating `src/types/fsa.d.ts` with manual type declarations.

## Self-Check: PASSED

All success criteria met:
- `npm run build` exits 0
- `npm test` exits 0 (25 passing)
- FsaDriver.write() uses JSON.stringify with 2-space indent
- IdbDriver and FsaDriver implement identical StorageDriver interface
- All three stores start with `initialized: false`
- `bootstrapStorage()` never calls `requestPermission()` — only `init()` and `isAvailable()`
