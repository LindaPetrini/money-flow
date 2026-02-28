# Phase 7: Hardening - Research

**Researched:** 2026-02-28
**Domain:** React error boundary patterns, React Context, FSA permission lifecycle, localStorage persistence, Tailwind v4 UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FSA permission-loss mid-session (INFRA-04)**
- When `storage.write()` throws `NotAllowedError` (FSA permission revoked in background tab), stores catch the error and signal it upward
- Signal mechanism: a lightweight React context `StorageErrorContext` with a single `reportPermissionLost()` function — no new Zustand store
- `StorageErrorContext.Provider` wraps the app in `main.tsx`; each store's write path wraps `await storage.write(...)` in try/catch and calls `reportPermissionLost()` if `e instanceof DOMException && e.name === 'NotAllowedError'`
- `App.tsx` consumes `useStorageError()` and renders a blocking full-screen overlay modal when `permissionLost === true`:
  - Title: "Storage access lost"
  - Body: "Money Flow lost access to your data folder (e.g. the tab was backgrounded). Click below to re-grant access."
  - Single button: "Re-grant access" — calls `fsaDriver.requestPermission()` then `window.location.reload()`
  - Overlay cannot be dismissed — forces resolution before any further writes
- The modal renders above all content via `fixed inset-0 z-50` — no shadcn Dialog dependency, raw Tailwind

**Firefox/Safari IDB notice (INFRA-05)**
- Current: tiny muted text "Browser storage (data is browser-local)" in the header — too easy to miss
- New: dismissible amber banner rendered below the header when `storageMode === 'idb'` AND `fsaDriver === null` (true Firefox/Safari — no FSA available at all; NOT just permission-not-yet-granted)
- Banner text: "Your data is stored in this browser only — it won't appear in other browsers or devices. Use Chrome or Edge to enable file storage."
- Dismiss button (×) stores `localStorage.setItem('idb_notice_dismissed', '1')` — banner stays hidden on subsequent loads
- The existing small header text (`storageMode === 'idb' ? 'Browser storage...' : 'File storage'`) is removed to avoid duplication
- Banner is NOT shown when `storageMode === 'idb'` but `fsaDriver !== null` (permission-pending case) — that's handled by the "Grant access" button

**First-run onboarding (INFRA-04 / UX)**
- First-run detection: `needsFsaPrompt === true` (FSA available, no permission yet) AND `accounts.length === 0` (no data stored = truly first time)
- When first-run detected: hide tab content, show a centered onboarding card in `<main>`:
  - Heading: "Welcome to Money Flow"
  - Body: "Money Flow stores your data as JSON files in a folder you choose. This keeps everything private and portable."
  - Single button: "Choose data folder" — triggers the existing `handleGrantAccess()` flow
- After `handleGrantAccess()` succeeds → `window.location.reload()` already happens → normal app loads
- If user is on IDB (Firefox/Safari, `storageMode === 'idb'` + `fsaDriver === null`): no onboarding card (IDB initializes immediately, data just works) — the amber banner (above) handles the notice
- If `needsFsaPrompt === false` and `accounts.length === 0`: user chose a folder on a previous session but folder is empty (e.g. new folder) → skip onboarding, show normal app with empty state

**Removed: small "Grant access" banner above tabs**
- The existing `{needsFsaPrompt && <div>Grant folder access...</div>}` banner is replaced by the onboarding card on first-run
- On returning visits where permission lapsed (needsFsaPrompt=true but accounts>0): show a simplified banner "Click to reconnect your data folder" with a "Reconnect" button — NOT the full onboarding card

### Claude's Discretion
- Exact Tailwind classes for the overlay modal and onboarding card
- Whether to add a small info icon to the IDB banner
- Animation on the overlay modal (recommend none — this is an error state, not decorative)

### Deferred Ideas (OUT OF SCOPE)
- Toast notifications when another tab updates data (BroadcastChannel) — v2 requirement NOTF-01
- IDB data export/import for Firefox users — v2 EXPORT-02
- Animated transitions on the onboarding screen — polish, not hardening
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-04 | FSA permission lifecycle handled correctly — `queryPermission()` on startup, `requestPermission()` inside user gesture, graceful `NotAllowedError` recovery | StorageErrorContext pattern; store try/catch wrappers; overlay modal with `requestPermission()` in click handler |
| INFRA-05 | IndexedDB fallback when FSA unavailable (Firefox/Safari) — all features work, no file persistence | Dismissible amber banner gated on `fsaDriver === null`; localStorage dismiss flag; removal of duplicate header text |
</phase_requirements>

---

## Summary

Phase 7 is a focused hardening pass: three distinct UX improvements to the storage layer boundary with no new domain logic. All decisions are locked in CONTEXT.md with precise implementation specs. The codebase is well-prepared: `FsaDriver.write()` already re-throws `NotAllowedError`, stores already call `storage.write()` in predictable locations, and `App.tsx` already receives `needsFsaPrompt` and `storageMode` props. The planner's main job is sequencing file changes across three concerns that touch overlapping files.

The central technical challenge is the `StorageErrorContext`: stores are plain Zustand modules (not React components), so they cannot call React hooks directly. The solution is to pass `reportPermissionLost` as a callback from the context to the store at mount time, or to make the context state available as a module-level setter that stores can call. The locked decision specifies a React context — the cleanest approach given the architecture is to expose a module-level setter from the context module that stores import.

The IDB banner and first-run onboarding are straightforward React state changes in `App.tsx` with localStorage persistence for dismiss state. No external libraries are needed. The only new file is `src/lib/storage/StorageErrorContext.tsx`.

**Primary recommendation:** Implement in three waves: (1) StorageErrorContext + store wrappers, (2) overlay modal in App.tsx, (3) IDB banner + onboarding card + remove old banner.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (already installed) | Context API, useState, useContext | Already in use throughout codebase |
| Tailwind v4 | 4.x (already installed) | Overlay + banner + card styling | Locked tech stack |
| Zustand | 5 (already installed) | Store state management | All stores already use it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage (browser API) | native | Persist IDB banner dismiss flag | Matches existing pattern (CsvAiSection API key) |
| shadcn/ui Card, Button | already installed | Onboarding card UI | Locked in CONTEXT.md code_context |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context for error signal | Zustand store | CONTEXT.md explicitly rules out new Zustand store; Context is lighter for a single boolean |
| shadcn Dialog for overlay | Raw Tailwind div | CONTEXT.md explicitly rules out shadcn Dialog; raw `fixed inset-0 z-50` div is simpler for a blocking overlay |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/storage/
│   ├── StorageErrorContext.tsx   # NEW — only new file this phase
│   ├── fsaDriver.ts              # UNCHANGED
│   └── storage.ts                # UNCHANGED
├── stores/
│   ├── accountStore.ts           # MODIFIED — try/catch on write calls
│   ├── allocationStore.ts        # MODIFIED — try/catch on write calls
│   └── settingsStore.ts          # MODIFIED — try/catch on write calls
├── main.tsx                      # MODIFIED — wrap App in StorageErrorContext.Provider
└── App.tsx                       # MODIFIED — overlay modal, IDB banner, onboarding card
```

### Pattern 1: React Context with module-level setter (stores ↔ context bridge)

**What:** Stores are Zustand modules initialized before React mounts. They cannot use React hooks. The bridge: `StorageErrorContext.tsx` exports both a React Context/Provider AND a module-level `reportPermissionLost` function that the provider registers via `useEffect`. Stores import and call the module-level function; React re-renders via the context state.

**When to use:** Any time non-React code (stores, plain modules) needs to signal React UI state without introducing a Zustand store.

**Example:**
```typescript
// src/lib/storage/StorageErrorContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface StorageErrorContextValue {
  permissionLost: boolean;
  reportPermissionLost: () => void;
}

const StorageErrorContext = createContext<StorageErrorContextValue>({
  permissionLost: false,
  reportPermissionLost: () => {},
});

// Module-level setter — stores call this (no React hook needed)
let _reportPermissionLost: (() => void) | null = null;

export function reportPermissionLost() {
  _reportPermissionLost?.();
}

export function StorageErrorProvider({ children }: { children: ReactNode }) {
  const [permissionLost, setPermissionLost] = useState(false);

  useEffect(() => {
    _reportPermissionLost = () => setPermissionLost(true);
    return () => { _reportPermissionLost = null; };
  }, []);

  return (
    <StorageErrorContext.Provider value={{ permissionLost, reportPermissionLost: () => setPermissionLost(true) }}>
      {children}
    </StorageErrorContext.Provider>
  );
}

export function useStorageError() {
  return useContext(StorageErrorContext);
}
```

**Store write wrapper (same pattern for all three stores):**
```typescript
// In accountStore.ts — setAccounts and updateBalance both get this wrapper
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';

// ...inside the write call:
try {
  await storage.write<PersistedAccounts>('accounts', accounts);
} catch (e) {
  if (e instanceof DOMException && e.name === 'NotAllowedError') {
    reportPermissionLost();
    return; // Don't re-throw — state is already updated in memory
  }
  throw e;
}
```

### Pattern 2: Blocking overlay modal (permission-loss recovery)

**What:** A `fixed inset-0 z-50` div renders over all content when `permissionLost === true`. It cannot be dismissed. The single button calls `fsaDriver.requestPermission()` (user gesture ✓) then `window.location.reload()`.

**When to use:** Error states requiring forced resolution before the user can continue.

**Example:**
```tsx
// In App.tsx — rendered as first child inside the outer div, before header
{permissionLost && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
    <div className="bg-card border border-border rounded-lg p-8 max-w-sm w-full mx-4 shadow-lg">
      <h2 className="text-lg font-semibold mb-2">Storage access lost</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Money Flow lost access to your data folder (e.g. the tab was backgrounded).
        Click below to re-grant access.
      </p>
      <Button onClick={handleReGrantAccess} className="w-full">
        Re-grant access
      </Button>
    </div>
  </div>
)}
```

**`handleReGrantAccess` in App.tsx:**
```typescript
const handleReGrantAccess = async () => {
  if (!fsaDriver) return;
  await fsaDriver.requestPermission();
  window.location.reload();
};
```

### Pattern 3: Dismissible banner with localStorage persistence

**What:** Amber banner conditionally rendered. Dismiss sets a localStorage key. Initial state reads localStorage so it survives page reloads.

**When to use:** Persistent informational notices the user may want to hide once acknowledged.

**Example:**
```tsx
// In App.tsx — useState initialized from localStorage
const [idbNoticeDismissed, setIdbNoticeDismissed] = useState(
  () => localStorage.getItem('idb_notice_dismissed') === '1'
);

const handleDismissIdbNotice = () => {
  localStorage.setItem('idb_notice_dismissed', '1');
  setIdbNoticeDismissed(true);
};

// Render condition: true IDB (no FSA API at all) AND not dismissed
{storageMode === 'idb' && fsaDriver === null && !idbNoticeDismissed && (
  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
    <span className="text-amber-800">
      Your data is stored in this browser only — it won't appear in other browsers or devices.
      Use Chrome or Edge to enable file storage.
    </span>
    <button
      onClick={handleDismissIdbNotice}
      className="ml-4 text-amber-600 hover:text-amber-800 font-medium"
      aria-label="Dismiss"
    >
      ×
    </button>
  </div>
)}
```

### Pattern 4: First-run onboarding card (conditional main content)

**What:** When `needsFsaPrompt === true && accounts.length === 0`, replace tab content with an onboarding card. Read `accounts` from store. Note: on first render, `accounts` is loaded before React mounts (in `main.tsx` init function), so it's synchronously available.

**Example:**
```tsx
// In App.tsx
const accounts = useAccountStore(s => s.accounts);
const isFirstRun = needsFsaPrompt && accounts.length === 0;

// In <main>:
{isFirstRun ? (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Card className="max-w-md w-full mx-4">
      <CardContent className="pt-6 text-center">
        <h1 className="text-2xl font-semibold mb-3">Welcome to Money Flow</h1>
        <p className="text-muted-foreground mb-6">
          Money Flow stores your data as JSON files in a folder you choose.
          This keeps everything private and portable.
        </p>
        <Button onClick={handleGrantAccess} className="w-full">
          Choose data folder
        </Button>
      </CardContent>
    </Card>
  </div>
) : (
  <>
    {activeTab === 'dashboard' && <Dashboard />}
    {activeTab === 'invoice' && <InvoicePage />}
    {activeTab === 'history' && <HistoryPage />}
    {activeTab === 'settings' && <SettingsPage />}
  </>
)}
```

### Pattern 5: Returning-visit permission-lapsed banner (needsFsaPrompt=true, accounts>0)

**What:** Replaces the existing muted `{needsFsaPrompt && <div>Grant folder access...</div>}` banner for users who have data but lost permission since last visit.

**Example:**
```tsx
// Show reconnect banner when permission lapsed but user has existing data
{needsFsaPrompt && !isFirstRun && (
  <div className="bg-muted px-4 py-2 text-sm flex items-center gap-3">
    <span className="text-muted-foreground">Click to reconnect your data folder</span>
    <button
      onClick={handleGrantAccess}
      className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium"
    >
      Reconnect
    </button>
  </div>
)}
```

### Anti-Patterns to Avoid

- **Calling `requestPermission()` outside a user gesture handler:** Browser will silently fail or throw. All `requestPermission()` calls must be direct responses to click events — no setTimeout, no Promise.then chaining without keeping the user-gesture context.
- **Re-throwing NotAllowedError from store write methods:** State is already updated in memory when the write fails. Re-throwing would propagate to the caller (usually a UI event handler) and leave the app in an inconsistent state. Catch, signal, return.
- **Checking `storageMode === 'idb'` alone for the IDB banner:** This is true in both the "FSA available but not yet granted" case AND the "FSA not available" case. The condition MUST be `storageMode === 'idb' && fsaDriver === null` to show the banner only for true Firefox/Safari users.
- **Showing both the onboarding card and the IDB banner simultaneously:** For true IDB users (Firefox/Safari), `needsFsaPrompt === false`, so `isFirstRun` is always false. The conditions are mutually exclusive by design.
- **Creating a new Zustand store for permission state:** CONTEXT.md explicitly prohibits this. React context is the right tool for ephemeral UI-layer error state that doesn't need persistence.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blocking modal overlay | Custom modal component with portal | Raw `fixed inset-0 z-50` div | CONTEXT.md specifies this; no portal needed for a single overlay; shadcn Dialog banned for this use case |
| Dismiss state persistence | Custom storage wrapper | Direct `localStorage.getItem/setItem` | Existing pattern in CsvAiSection; no abstraction needed for a single flag |
| Permission revocation detection | Custom polling/event listener | Catch `NotAllowedError` on write | FSA API throws synchronously on the write call when permission is revoked — no need to poll |

**Key insight:** This phase adds zero new libraries. Every problem is solved with browser primitives (localStorage, DOMException), React primitives (Context, useState), and existing code patterns already established in the codebase.

---

## Common Pitfalls

### Pitfall 1: Store module-level vs React lifecycle timing
**What goes wrong:** `_reportPermissionLost` is null when a store write fails before React mounts (e.g., during the `init()` function in main.tsx before `createRoot`).
**Why it happens:** `StorageErrorContext.Provider` registers `_reportPermissionLost` in a `useEffect`, which runs after mount. Stores load data during `init()`, before mount.
**How to avoid:** Stores only write (never just read) in response to user actions (button clicks, form submits). The `loadAccounts/loadHistory/loadSettings` calls in `init()` only call `storage.read()`, not `storage.write()`. Permission loss only triggers on writes, which only happen after the user interacts. By the time any write occurs, the provider is mounted. This is safe by the app's architecture.
**Warning signs:** If a store were to write during `loadX()`, this would be a problem. Verify that all store load functions remain read-only.

### Pitfall 2: `requestPermission()` called without user gesture
**What goes wrong:** Browser throws `SecurityError: Must be handling a user gesture to show a permission request`.
**Why it happens:** The FSA `requestPermission()` API enforces user-gesture requirement at the browser level.
**How to avoid:** The overlay "Re-grant access" button is a direct `onClick` handler — this is safe. Never call `requestPermission()` in a `useEffect`, setTimeout, Promise.then without being in the original synchronous call stack of the user event.
**Warning signs:** `SecurityError` in console; modal appears but permission dialog never shows.

### Pitfall 3: IDB banner condition using only `storageMode`
**What goes wrong:** Banner shown to users on Chrome who haven't granted FSA permission yet — they see "use Chrome or Edge" even though they're on Chrome.
**Why it happens:** When FSA is available but permission not granted, `bootstrapStorage()` returns `{ needsFsaPrompt: true, mode: 'idb' }`. So `storageMode === 'idb'` is true even on Chrome/Edge.
**How to avoid:** Condition MUST include `fsaDriver === null`. When `fsaDriver !== null`, the permission-pending case is handled by the "Reconnect" banner or onboarding card.
**Warning signs:** Chrome users see "Use Chrome or Edge" message before granting permissions.

### Pitfall 4: First-run detection race condition
**What goes wrong:** `accounts.length === 0` check happens before stores are loaded, showing onboarding card to returning users.
**Why it happens:** If stores weren't pre-loaded, `accounts` would be `[]` (initial state) for all users.
**How to avoid:** `main.tsx` already calls `loadAccounts()` before `createRoot()`. Accounts are loaded synchronously into store state before React renders. This is already correct architecture — just verify it's preserved.
**Warning signs:** Returning users with data see the onboarding card on page load.

### Pitfall 5: Stale `permissionLost` state after reload
**What goes wrong:** After `window.location.reload()`, the overlay persists briefly because React state hasn't reset yet.
**Why it happens:** Not actually a problem — `window.location.reload()` causes a full page reload, discarding all React state. The overlay disappears as soon as the reload initiates.
**How to avoid:** No action needed. This is correct behavior.

---

## Code Examples

### StorageErrorContext.tsx (complete)
```typescript
// src/lib/storage/StorageErrorContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface StorageErrorContextValue {
  permissionLost: boolean;
}

const StorageErrorContext = createContext<StorageErrorContextValue>({
  permissionLost: false,
});

// Module-level setter — called by stores (non-React code)
let _reportPermissionLost: (() => void) | null = null;

export function reportPermissionLost() {
  _reportPermissionLost?.();
}

export function StorageErrorProvider({ children }: { children: ReactNode }) {
  const [permissionLost, setPermissionLost] = useState(false);

  useEffect(() => {
    _reportPermissionLost = () => setPermissionLost(true);
    return () => { _reportPermissionLost = null; };
  }, []);

  return (
    <StorageErrorContext.Provider value={{ permissionLost }}>
      {children}
    </StorageErrorContext.Provider>
  );
}

export function useStorageError() {
  return useContext(StorageErrorContext);
}
```

### main.tsx wrapping with provider
```tsx
// src/main.tsx — wrap App with StorageErrorProvider
import { StorageErrorProvider } from '@/lib/storage/StorageErrorContext';

// Inside createRoot render:
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorageErrorProvider>
      <App needsFsaPrompt={bootstrapResult.needsFsaPrompt} storageMode={bootstrapResult.mode} />
    </StorageErrorProvider>
  </StrictMode>,
);
```

### Store write wrapper (accountStore.ts example)
```typescript
// Both setAccounts and updateBalance get identical try/catch treatment
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';

setAccounts: async (accounts) => {
  if (!get().initialized) return;
  set({ accounts });
  try {
    await storage.write<PersistedAccounts>('accounts', accounts);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      reportPermissionLost();
      return;
    }
    throw e;
  }
},
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Silently swallowing write errors | Catch + signal via context | Phase 7 | Eliminates silent data loss |
| Muted header text for IDB mode | Amber banner with explicit message | Phase 7 | Users understand fallback mode |
| No first-run guidance | Onboarding card | Phase 7 | Eliminates confusion on first visit |
| "Grant access" banner always shown when `needsFsaPrompt` | Two distinct UX paths (onboarding vs reconnect) | Phase 7 | Correct message for each scenario |

---

## Open Questions

1. **`fsaDriver` is a module-level export from `storage.ts` — is it accessible in `App.tsx` after the IDB-only bootstrap path sets it to `null`?**
   - What we know: `bootstrapStorage()` sets `fsaDriver = null` when FSA is unavailable. `App.tsx` already imports `fsaDriver` from `@/lib/storage/storage`. This is a module singleton — the null assignment in `bootstrapStorage()` is visible to all importers.
   - What's unclear: Nothing — this is confirmed correct by reading `storage.ts` line 14 and `App.tsx` line 2. `fsaDriver` is `null` when FSA is unavailable.
   - Recommendation: Use `fsaDriver === null` as the "true IDB mode" guard. No change needed.

2. **Should `handleReGrantAccess` in App.tsx reload or re-run the store load sequence?**
   - What we know: The existing `handleGrantAccess()` already calls `window.location.reload()` after `requestPermission()`. The CONTEXT.md specifies the same pattern for `handleReGrantAccess`.
   - What's unclear: Nothing — reload is the correct approach as it re-runs `bootstrapStorage()` which will now get `queryPermission() === 'granted'`.
   - Recommendation: Use `window.location.reload()` consistently for both grant and re-grant flows.

---

## Codebase Integration Summary

### Files to modify
| File | Change |
|------|--------|
| `src/main.tsx` | Wrap `<App>` with `<StorageErrorProvider>` |
| `src/App.tsx` | Add: `useStorageError()` hook, overlay modal, IDB banner, onboarding card, `handleReGrantAccess`; Remove: old needsFsaPrompt banner; Modify: header text removal |
| `src/stores/accountStore.ts` | Add try/catch to `setAccounts` and `updateBalance` write calls |
| `src/stores/allocationStore.ts` | Add try/catch to `appendAllocation` write call |
| `src/stores/settingsStore.ts` | Add try/catch to `updateSettings` write call |

### Files to create
| File | Purpose |
|------|---------|
| `src/lib/storage/StorageErrorContext.tsx` | React context + module-level setter for permission-lost signaling |

### Files unchanged
- `src/lib/storage/fsaDriver.ts` — already correct; re-throws `NotAllowedError`
- `src/lib/storage/storage.ts` — no changes needed
- All feature components (Dashboard, InvoicePage, HistoryPage, SettingsPage, etc.)

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading — `src/App.tsx`, `src/main.tsx`, `src/stores/*.ts`, `src/lib/storage/*.ts` — confirmed exact APIs, export shapes, existing patterns
- `07-CONTEXT.md` — locked implementation decisions from project owner

### Secondary (MEDIUM confidence)
- React 19 Context API and `useEffect` timing — standard React patterns, unchanged from React 16+
- FSA API `requestPermission()` user-gesture requirement — well-documented browser security constraint

### Tertiary (LOW confidence)
- None — all claims verified against source code or locked decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing tools confirmed by reading installed deps
- Architecture: HIGH — all patterns verified against actual codebase; no assumptions about external APIs
- Pitfalls: HIGH — derived from direct reading of `storage.ts` bootstrap logic and `fsaDriver.ts` behavior

**Research date:** 2026-02-28
**Valid until:** 2026-04-28 (stable React + FSA patterns; nothing fast-moving)
