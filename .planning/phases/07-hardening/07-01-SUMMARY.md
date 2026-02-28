---
phase: 07-hardening
plan: 01
subsystem: storage-error-handling
tags: [storage, fsa, error-handling, react-context, zustand]
dependency_graph:
  requires: []
  provides: [StorageErrorContext, store-write-guards]
  affects: [accountStore, allocationStore, settingsStore, UI-error-display]
tech_stack:
  added: []
  patterns: [module-level-setter-pattern, permission-loss-bridge]
key_files:
  created:
    - src/lib/storage/StorageErrorContext.tsx
  modified:
    - src/stores/accountStore.ts
    - src/stores/allocationStore.ts
    - src/stores/settingsStore.ts
decisions:
  - "set() precedes try/catch in all store write paths — in-memory state is updated before persistence attempt; permission loss preserves runtime consistency"
  - "Module-level _reportPermissionLost setter bridges non-React store code to React state — avoids importing hooks into stores"
  - "NotAllowedError is caught and signaled (not re-thrown) — FSA permission revocation is a UI concern, not a store error"
  - "Load functions (read-only) left unchanged — permission errors only relevant on writes"
metrics:
  duration: "2 minutes"
  completed: "2026-02-28"
  tasks: 2
  files: 4
---

# Phase 7 Plan 01: StorageErrorContext + Store Write Guards Summary

FSA permission-loss bridge using module-level setter pattern connecting Zustand stores to React context, with NotAllowedError try/catch on all store write paths.

## What Was Built

### StorageErrorContext.tsx (new file)

A React context module providing a bridge between non-React Zustand store code and the React UI for FSA permission-loss signaling.

Three exports:
1. `reportPermissionLost()` — module-level function stores call directly (no React hook needed)
2. `StorageErrorProvider` — React provider that registers `_reportPermissionLost` setter via `useEffect`, cleans up on unmount
3. `useStorageError()` — hook returning `{ permissionLost: boolean }` for UI components

The key pattern: a module-level `_reportPermissionLost` variable is `null` until `StorageErrorProvider` mounts, then set to `() => setPermissionLost(true)`. This allows store code (which has no React context) to trigger a React state change.

### Store Write Guards

All three stores now have identical NotAllowedError handling on every `storage.write()` call:

```typescript
try {
  await storage.write<T>('key', value);
} catch (e) {
  if (e instanceof DOMException && e.name === 'NotAllowedError') {
    reportPermissionLost();
    return;
  }
  throw e;
}
```

**accountStore.ts** — guards on `setAccounts` and `updateBalance`
**allocationStore.ts** — guard on `appendAllocation`
**settingsStore.ts** — guard on `updateSettings`

## Key Decisions

**Why set() before try/catch:**
Memory state is updated unconditionally before the storage write attempt. If permission is lost, the UI reflects the user's action even though persistence failed. This preserves in-session consistency — the data isn't lost from the running app, only from the file.

**Why module-level setter (not useContext in stores):**
Zustand store actions run outside React's component tree. They cannot call hooks. The module-level setter pattern is the standard solution: React registers a callback at mount time, and non-React code calls it through the module variable.

**Why not re-throw NotAllowedError:**
FSA permission revocation is a UI concern — the user needs to be informed, not the error propagation chain. Re-throwing would bubble up to unhandled promise rejections. The `reportPermissionLost()` + `return` pattern keeps store actions clean.

**Why load functions are unchanged:**
`loadAccounts`, `loadHistory`, `loadSettings` are read-only — they call `storage.read()`, not `storage.write()`. FSA permission loss only affects writes (the browser requires re-confirmation for write access). Read operations remain valid after permission loss.

## Deviations from Plan

None — plan executed exactly as written.

## Build and Test Status

- `npm run build` — PASSED (zero TypeScript errors)
- `npm test` — PASSED (114/114 tests green, 5 test files)

## Self-Check: PASSED

- `src/lib/storage/StorageErrorContext.tsx` — exists, exports confirmed
- All three stores import `reportPermissionLost` — confirmed
- All `storage.write()` calls wrapped in try/catch — confirmed (4 write sites total)
- Commits d3ef01c and 23d04e9 exist in git log
