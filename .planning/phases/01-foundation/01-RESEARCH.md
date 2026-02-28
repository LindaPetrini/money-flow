# Phase 1: Foundation - Research

**Researched:** 2026-02-28
**Domain:** Project scaffolding (Vite 7 + React 19 + TypeScript + Tailwind v4 + shadcn/ui), dual persistence (File System Access API + IndexedDB), integer cents arithmetic
**Confidence:** HIGH — all critical claims verified against official docs (see Sources)

---

## Summary

Phase 1 builds the three load-bearing foundations that every subsequent phase depends on: a correctly scaffolded Vite 7 + React 19 + TypeScript project with the exact Tailwind v4 + shadcn/ui configuration; a dual-persistence layer (File System Access API as primary, IndexedDB as fallback) with a correct FSA permission lifecycle; and a verified integer-cents arithmetic library with unit tests. None of these domains have novel or undocumented patterns — the ecosystem research has already resolved all meaningful questions. The work is precise execution of known-good recipes, not exploration.

The two highest-risk items are well-understood. First, FSA permissions are tab-lifetime only: retrieving a `FileSystemDirectoryHandle` from IndexedDB does not restore write permission. Every startup must call `queryPermission()` and, if needed, `requestPermission()` inside a user gesture — and every write must catch `NotAllowedError` for background-tab revocation. Second, floating-point money arithmetic must be eliminated at the boundary: `parseCents` must use `Math.round(parseFloat(input) * 100)`, and `splitCents` must implement the largest-remainder algorithm so bucket totals always equal the invoice amount exactly. Both must be proven correct with Vitest unit tests before any domain logic is built on top.

The Tailwind v4 + shadcn/ui New York setup has several known configuration traps that cause cryptic errors if not followed exactly. These are fully documented and mechanical to avoid. The Zustand stores are initialized empty and must guard all write paths with an `initialized: boolean` flag until the async FSA/IDB load completes. This phase delivers no visible UI — only the project skeleton, a working persistence layer, and verified arithmetic functions.

**Primary recommendation:** Scaffold with `npm create vite@latest`, follow the exact Tailwind v4 + shadcn setup steps documented in this file, implement the FSA driver and IDB fallback behind a `StorageDriver` interface, implement `lib/cents.ts` with `parseCents`/`formatCents`/`splitCents`, write Vitest unit tests for all three functions, and gate the phase on green tests before proceeding.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | App scaffolds with Vite 7 + React 19 + TypeScript, runs via `npm start` on localhost with no server | Scaffold recipe in Standard Stack section; `npm start` script alias in vite.config. |
| INFRA-02 | App is open-source publishable (no proprietary dependencies, clean GitHub repo) | All stack packages are MIT/Apache licensed. No proprietary SDKs in Phase 1. |
| INFRA-03 | File System Access API integration — user grants directory access once per session; handle stored in IndexedDB for re-use | FSA Driver pattern with idb handle persistence documented in Architecture Patterns and Code Examples. |
| INFRA-04 | FSA permission lifecycle handled correctly — `queryPermission()` on startup, `requestPermission()` inside user gesture, graceful `NotAllowedError` recovery | Full permission lifecycle pattern in Code Examples; both pitfalls (#1, #2) document the error modes. |
| INFRA-05 | IndexedDB fallback when FSA unavailable (Firefox/Safari) — all features work, no file persistence | IDB Driver implementing same `StorageDriver` interface; `isAvailable()` check drives driver selection. |
| INFRA-06 | All money arithmetic uses integer cents throughout (`parseCents`, `formatCents`, `splitCents` with largest-remainder) — no floating point in domain logic | Complete `lib/cents.ts` implementation in Code Examples; `splitCents` largest-remainder algorithm verified and documented. |
| INFRA-07 | Data persisted as human-readable JSON files in user-selected directory via FSA | FSA Driver writes `JSON.stringify(data, null, 2)` to named `.json` files; file layout documented in Architecture Patterns. |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 7.3.1 | Build tool + dev server | ESM-only, fastest HMR, required for Vitest 4; Node 20.19+ required. |
| React | 19.2.4 | UI framework | Required by shadcn/ui New York on Tailwind v4 path; concurrent rendering. |
| TypeScript | 5.7+ | Type safety | Bundled with Vite template; strict mode required for `Cents` branded type. |
| Tailwind CSS | 4.2.1 | Utility-first CSS | CSS-first (no `tailwind.config.js`), `@theme` in CSS only, OKLCH colors. |
| @tailwindcss/vite | 4.2.1 | Vite plugin for Tailwind | First-party plugin; replaces PostCSS entirely; must match Tailwind major.minor. |
| shadcn/ui | latest CLI | Component library | New York variant is default for Tailwind v4; components copied into src/. |
| Zustand | 5.0.11 | In-session UI state | Zero provider, no persist middleware; FSA/IDB own persistence. |
| idb | 8.0.3 | IndexedDB wrapper | Used for two purposes: persisting FSA `FileSystemDirectoryHandle`; IDB fallback driver. |
| File System Access API | browser-native | Primary persistence | Human-readable JSON files on disk; survives cache clears; Chrome/Edge only. |
| Vitest | 4.0.18 | Test runner | Vite-native; jest-compatible API; required for cents unit tests in this phase. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | 4.x | React HMR in Vite | Required; use Babel variant (not SWC) for shadcn compatibility. |
| tw-animate-css | 1.x | Animation utilities | Replaces deprecated `tailwindcss-animate`; import in `src/index.css`. |
| lucide-react | latest | Icons | shadcn/ui default icon set; installed automatically by shadcn CLI. |
| @testing-library/react | 16.x | Component test utilities | Required for React 19; v14/v15 do not support React 19. |
| @testing-library/jest-dom | 6.x | DOM matchers | `toBeInTheDocument()` etc.; imported in vitest setup file. |
| jsdom | 25.x | DOM environment | `environment: 'jsdom'` in vitest config; required for React component tests. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tailwindcss/vite plugin | PostCSS tailwindcss | PostCSS causes double-processing with Vite plugin; never mix the two. |
| tw-animate-css | tailwindcss-animate | `tailwindcss-animate` is deprecated in Tailwind v4 shadcn path; causes class conflicts. |
| Zustand (no persist) | Zustand + persist middleware | persist middleware creates a second source of truth fighting with FSA; explicit writes give atomic control. |
| idb full library | idb-keyval | idb-keyval is key-value only; full idb needed for typed object stores (handles, app data fallback). |
| @vitejs/plugin-react (Babel) | @vitejs/plugin-react-swc | SWC occasionally conflicts with Babel transforms some shadcn components use; speed difference negligible. |

**Installation:**

```bash
# Node version check — Vite 7 requires Node 20.19+ or 22.12+
node --version

# 1. Scaffold
npm create vite@latest money-flow -- --template react-ts
cd money-flow

# 2. Tailwind v4 + Vite plugin
npm install tailwindcss @tailwindcss/vite

# 3. shadcn/ui (Tailwind v4 + React 19 compatible)
npx shadcn@latest init
# Prompts: New York style, OKLCH colors, leave tailwind config path BLANK

# 4. Animation (tw-animate-css replaces tailwindcss-animate)
npm install tw-animate-css

# 5. State + persistence
npm install zustand idb

# 6. Test dependencies
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom

# 7. Add npm start alias to package.json scripts:
# "start": "vite"
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 subset)

```
src/
├── lib/
│   ├── cents.ts              # parseCents, formatCents, splitCents, pctOf, addCents
│   └── storage/
│       ├── storage.ts        # StorageDriver interface + bootstrapStorage()
│       ├── fsaDriver.ts      # File System Access API implementation
│       └── idbDriver.ts      # IndexedDB fallback (idb library)
├── stores/
│   ├── accountStore.ts       # Account balances (initialized: boolean guard)
│   ├── allocationStore.ts    # Pending moves + history (initialized guard)
│   └── settingsStore.ts      # Buckets, floor items, overflow ratios (initialized guard)
├── types/
│   ├── domain.ts             # Account, FloorItem, AllocationMove, etc.
│   └── persistence.ts        # Serialized shapes for JSON storage
├── test/
│   └── setup.ts              # @testing-library/jest-dom import
├── App.tsx                   # Minimal shell — just "app is alive" for Phase 1
└── main.tsx                  # Vite entry; calls bootstrapStorage() on mount
```

Full `features/` tree (dashboard, invoices, accounts, etc.) is scaffolded in Phase 3. Phase 1 only needs the infrastructure files above.

### Pattern 1: StorageDriver Abstraction

**What:** A `storage.ts` module detects capability at startup and returns either the FSA driver or the IDB driver. All callers (stores) interact only with the `StorageDriver` interface — never with FSA or IDB directly.

**When to use:** Always. This is the persistence architecture for the entire app.

```typescript
// src/lib/storage/storage.ts
export interface StorageDriver {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, data: T): Promise<void>;
  isAvailable(): Promise<boolean>;
}

export let storage: StorageDriver;

export async function bootstrapStorage(): Promise<void> {
  const fsa = new FsaDriver();
  if (await fsa.isAvailable()) {
    const ready = await fsa.init();  // tries to restore saved handle
    if (ready) { storage = fsa; return; }
    // Handle needs user gesture — set IDB as interim, surface FSA prompt in UI
  }
  storage = new IdbDriver();
  await (storage as IdbDriver).init();
}
```

### Pattern 2: FSA Permission Lifecycle

**What:** Every session start must check permission on the stored handle. If permission is `'prompt'` (not `'granted'`), the app must surface a button for the user to click — `requestPermission()` cannot be called outside a user gesture. If no handle exists, `showDirectoryPicker()` provides one.

**When to use:** In `FsaDriver.init()` on startup. Never inline in components.

```typescript
// src/lib/storage/fsaDriver.ts
import { openDB } from 'idb';

const HANDLES_STORE = 'fsa-handles';
const DIR_KEY = 'workDir';

export class FsaDriver implements StorageDriver {
  private dirHandle: FileSystemDirectoryHandle | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  // Returns true if handle is ready without user gesture
  async init(): Promise<boolean> {
    const db = await openDB('money-flow-meta', 1, {
      upgrade(db) { db.createObjectStore(HANDLES_STORE); },
    });
    const stored = await db.get(HANDLES_STORE, DIR_KEY) as FileSystemDirectoryHandle | undefined;
    if (!stored) return false;
    const perm = await stored.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') { this.dirHandle = stored; return true; }
    // perm === 'prompt' — need user gesture; caller must surface button
    return false;
  }

  // MUST be called from a user gesture (button click handler)
  async requestPermission(existingHandle?: FileSystemDirectoryHandle): Promise<void> {
    if (existingHandle) {
      await existingHandle.requestPermission({ mode: 'readwrite' });
      this.dirHandle = existingHandle;
    } else {
      this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    }
    const db = await openDB('money-flow-meta', 1);
    await db.put(HANDLES_STORE, this.dirHandle, DIR_KEY);
  }

  async read<T>(key: string): Promise<T | null> {
    if (!this.dirHandle) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(`${key}.json`);
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text()) as T;
    } catch {
      return null;  // File not found is fine on first run
    }
  }

  async write<T>(key: string, data: T): Promise<void> {
    if (!this.dirHandle) throw new Error('FSA not initialized');
    try {
      const fileHandle = await this.dirHandle.getFileHandle(`${key}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        // Background-tab revocation — surface re-prompt in UI
        throw e;  // Caller catches and shows "Grant permission" button
      }
      throw e;
    }
  }
}
```

### Pattern 3: IDB Fallback Driver

**What:** Implements the same `StorageDriver` interface using IndexedDB. Used on Firefox/Safari or any browser where FSA is unavailable. No file-on-disk output — data is browser-origin-local.

```typescript
// src/lib/storage/idbDriver.ts
import { openDB, IDBPDatabase } from 'idb';

export class IdbDriver implements StorageDriver {
  private db!: IDBPDatabase;

  async isAvailable(): Promise<boolean> { return true; }

  async init(): Promise<void> {
    this.db = await openDB('money-flow-data', 1, {
      upgrade(db) { db.createObjectStore('app-data'); },
    });
  }

  async read<T>(key: string): Promise<T | null> {
    return (await this.db.get('app-data', key)) ?? null;
  }

  async write<T>(key: string, data: T): Promise<void> {
    await this.db.put('app-data', data, key);
  }
}
```

### Pattern 4: Zustand Store with `initialized` Guard

**What:** All three Zustand stores start empty. An `initialized: boolean` flag is set to `true` only after the async storage load completes. Write paths (actions that call `storage.write()`) must check this flag and bail if `false`. This prevents the race condition where a component triggers a write before initial data is loaded, overwriting the saved file with empty state.

**When to use:** In every store's write-path actions.

```typescript
// src/stores/accountStore.ts (pattern applies to all three stores)
import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import type { Account } from '@/types/domain';

interface AccountState {
  initialized: boolean;
  accounts: Account[];
  loadAccounts: () => Promise<void>;
  setAccounts: (accounts: Account[]) => Promise<void>;
  updateBalance: (id: string, newCents: number) => Promise<void>;
}

export const useAccountStore = create<AccountState>()((set, get) => ({
  initialized: false,
  accounts: [],

  loadAccounts: async () => {
    const data = await storage.read<Account[]>('accounts') ?? [];
    set({ accounts: data, initialized: true });
  },

  setAccounts: async (accounts) => {
    if (!get().initialized) return;  // Guard: never write before load
    set({ accounts });
    await storage.write('accounts', accounts);
  },

  updateBalance: async (id, newCents) => {
    if (!get().initialized) return;
    const updated = get().accounts.map(a =>
      a.id === id ? { ...a, balanceCents: newCents } : a
    );
    set({ accounts: updated });
    await storage.write('accounts', updated);
  },
}));
```

### Pattern 5: Cents Boundary Enforcement

**What:** All money values stored as integer cents. `parseCents` is the ONLY entry point for string-to-number conversion. `formatCents` is the ONLY exit point for display. No `* 100` or `/ 100` anywhere outside `lib/cents.ts`.

**When to use:** Everywhere. This is a constraint, not an option.

```typescript
// src/lib/cents.ts
export type Cents = number & { readonly __brand: 'Cents' };

export function parseCents(input: string): Cents {
  // Handles "19.99", "1999", "1,999.00" — strips non-numeric except dot
  const cleaned = input.replace(/[^0-9.]/g, '');
  return Math.round(parseFloat(cleaned) * 100) as Cents;
}

export function formatCents(cents: Cents, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function pctOf(amount: Cents, pct: number): Cents {
  // pct is 0-100; uses Math.floor (conservative — caller handles remainder)
  return Math.floor((amount * pct) / 100) as Cents;
}

export function addCents(...amounts: Cents[]): Cents {
  return amounts.reduce((a, b) => a + b, 0) as Cents;
}

export function subCents(a: Cents, b: Cents): Cents {
  return (a - b) as Cents;
}

// Largest-remainder algorithm — bucket totals ALWAYS equal total exactly
export function splitCents(total: Cents, ratios: number[]): Cents[] {
  if (ratios.length === 0) return [];
  const sum = ratios.reduce((a, b) => a + b, 0);
  if (sum === 0) return ratios.map(() => 0 as Cents);
  const floats = ratios.map(r => (r / sum) * total);
  const floored = floats.map(f => Math.floor(f));
  const remainder = total - floored.reduce((a, b) => a + b, 0);
  const sortedByRemainder = floats
    .map((f, i) => ({ rem: f - floored[i], i }))
    .sort((a, b) => b.rem - a.rem);
  for (let k = 0; k < remainder; k++) {
    floored[sortedByRemainder[k].i]++;
  }
  return floored as Cents[];
}
```

### Pattern 6: Vite + Tailwind v4 Configuration

**What:** The exact configuration required for Tailwind v4 with Vite. Any deviation causes broken builds or missing styles.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // NOT in postcss.config.js — Vite plugin only
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

```css
/* src/index.css */
@import "tailwindcss";
@import "tw-animate-css";   /* NOT tailwindcss-animate */

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* OKLCH color tokens — injected by npx shadcn init */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  /* ... full palette from shadcn init output ... */
}
```

```json
// components.json — Tailwind v4 mode
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

```json
// tsconfig.app.json — path alias for shadcn
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Anti-Patterns to Avoid

- **Using PostCSS for Tailwind:** Delete any `postcss.config.js`; use only `@tailwindcss/vite` plugin in `vite.config.ts`.
- **Non-empty `"config"` in components.json:** `"config": ""` (empty string) is required for Tailwind v4. Any path value breaks `npx shadcn add [component]`.
- **`tailwindcss-animate` instead of `tw-animate-css`:** The former is deprecated in the Tailwind v4 shadcn path; causes duplicate animation definitions.
- **Zustand `persist` middleware:** Creates a second source of truth alongside FSA; stale localStorage data overwrites fresh FSA data silently.
- **Writing to stores before `initialized = true`:** Any component that triggers a write before `loadAccounts()` completes will overwrite the saved file with an empty array.
- **`parseFloat(input) * 100` without `Math.round`:** `parseFloat("19.99") * 100 = 1998.9999...` — must use `Math.round`.
- **`/ 100` or `* 100` outside `lib/cents.ts`:** Makes auditing impossible; creates float leakage paths.
- **Calling `requestPermission()` or `showDirectoryPicker()` outside a user gesture:** Both throw `SecurityError` in Chrome if not triggered by a click/keydown event.
- **Using `border` class alone in Tailwind v4:** v4 border default is `currentColor` not the theme border color; use `border-border` explicitly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB boilerplate | Custom IDB wrapper | `idb` (jakearchibald) | IDB API is callback-based, error-prone; idb provides typed Promises and structured clone support for FSA handles |
| Cents rounding | Ad-hoc `Math.floor` / `Math.round` throughout | Centralized `lib/cents.ts` | One missed floor/round anywhere leaks floats; auditing impossible without a single boundary |
| Largest-remainder split | Custom distribution logic | `splitCents` from `lib/cents.ts` | Off-by-one cent errors accumulate silently; largest-remainder is the correct algorithm for this |
| Test DOM environment | Manual DOM setup | jsdom via Vitest config | jsdom provides complete browser globals for component tests without a browser |

**Key insight:** The cents layer is the most tempting thing to hand-roll inline — "just multiply by 100" — and the most dangerous. The largest-remainder algorithm is subtle enough that any custom implementation will have off-by-one bugs. Put everything in `lib/cents.ts` and never touch it from outside.

---

## Common Pitfalls

### Pitfall 1: FSA Handle Retrieved But Permission Revoked

**What goes wrong:** App retrieves `FileSystemDirectoryHandle` from IndexedDB successfully but all subsequent file reads/writes throw `NotAllowedError`. The handle is valid; the permission is gone.

**Why it happens:** FSA permissions are tab-lifetime only. Closing the tab and reopening — even to the same URL — revokes all previously granted permissions. The handle survives in IDB; the permission does not.

**How to avoid:** In `FsaDriver.init()`, always call `stored.queryPermission({ mode: 'readwrite' })` after retrieving the handle. If the result is `'prompt'` (not `'granted'`), do NOT call `requestPermission()` yet — surface a "Grant access to your data folder" button and call `requestPermission()` only in the button's click handler.

**Warning signs:** `getFileHandle()` or `createWritable()` throws `NotAllowedError` immediately after page load.

---

### Pitfall 2: Background-Tab Permission Auto-Revocation

**What goes wrong:** User opens app, uses it, switches to another tab for an extended period, returns and clicks "Done" on an invoice. The write silently fails or the app crashes.

**Why it happens:** Chrome revokes FSA write permission when a tab is backgrounded for an extended period (exact duration varies by Chrome version and system memory pressure).

**How to avoid:** Wrap every `storage.write()` call (or every `FsaDriver.write()`) in a try/catch that specifically catches `DOMException` with `name === 'NotAllowedError'`. On catch, set a store flag `permissionRevoked: true` that surfaces a persistent banner with a "Re-grant access" button. The button calls `requestPermission()` inside its click handler.

**Warning signs:** Write operations fail intermittently, especially after leaving the app open and unfocused.

---

### Pitfall 3: Floating-Point Leaking Through parseCents

**What goes wrong:** `parseCents("19.99")` returns `1998.9999...` instead of `1999`. Distribution splits don't add up to the invoice total. Allocation totals are ±1 cent off.

**Why it happens:** `parseFloat("19.99") * 100 = 1998.9999999999998` in IEEE 754. Forgetting `Math.round` causes the integer to be fractional.

**How to avoid:** `parseCents` implementation must use `Math.round(parseFloat(cleaned) * 100)`. Write a unit test: `expect(parseCents("19.99")).toBe(1999)`. Write a `splitCents` unit test: `expect(splitCents(100 as Cents, [1, 1, 1]).reduce((a,b)=>a+b, 0)).toBe(100)`.

**Warning signs:** `parseCents("19.99") !== 1999` in tests; allocation totals differ from invoice amount.

---

### Pitfall 4: Zustand Write Before FSA Load

**What goes wrong:** User opens app. Zustand stores initialize with empty arrays. Before `loadAccounts()` completes, a re-render triggers a write (e.g., a `useEffect` cleanup or an optimistic update). The empty array overwrites the saved `accounts.json`. On next load, all accounts are gone.

**Why it happens:** `bootstrapStorage()` and all store `load*()` calls are async. React renders synchronously while awaiting. Any write action triggered during this window fires against an empty in-memory store.

**How to avoid:** Every store starts with `initialized: false`. Every write-path action (`setAccounts`, `updateBalance`, etc.) checks `if (!get().initialized) return` before calling `storage.write()`. Only `loadAccounts()` sets `initialized: true`, and it does so only after successfully reading from storage (even if the data is `[]`).

**Warning signs:** Data disappears after page refresh; dashboard briefly shows real data then goes blank.

---

### Pitfall 5: Tailwind v4 Configuration Mismatches

**What goes wrong:** shadcn components don't render correctly (no borders, wrong colors, animations missing). `npx shadcn add [component]` fails with a cryptic error about missing config.

**Why it happens:** Multiple Tailwind v4 gotchas exist simultaneously. Any one of them causes subtle or total breakage.

**How to avoid:** Checklist to verify after scaffold:
- `"config": ""` (empty string, not a path) in `components.json`
- `@import "tw-animate-css"` (not `tailwindcss-animate`) in `src/index.css`
- `tailwindcss` added to `vite.config.ts` plugins via `@tailwindcss/vite` import (not PostCSS)
- No `tailwind.config.js` file exists
- Colors are OKLCH (from shadcn init), not HSL
- `border-border` used instead of bare `border` for bordered elements

**Warning signs:** `border` renders with no visible line; accent colors appear wrong; `npx shadcn add` fails with "cannot find tailwind config".

---

### Pitfall 6: Vitest 4 `basic` Reporter Removed

**What goes wrong:** Test run fails with "Unknown reporter: basic".

**Why it happens:** Vitest 4 removed the `basic` reporter.

**How to avoid:** Use `reporters: ['default']` in `vite.config.ts` test config (or omit `reporters` entirely — `default` is the default).

**Warning signs:** Error on `npm test` before any test code runs.

---

## Code Examples

Verified patterns from official sources and ARCHITECTURE.md research:

### parseCents — Correct Implementation

```typescript
// src/lib/cents.ts
export type Cents = number & { readonly __brand: 'Cents' };

export function parseCents(input: string): Cents {
  const cleaned = input.replace(/[^0-9.]/g, '');
  return Math.round(parseFloat(cleaned) * 100) as Cents;
}
```

### splitCents — Largest-Remainder Algorithm

```typescript
export function splitCents(total: Cents, ratios: number[]): Cents[] {
  if (ratios.length === 0) return [];
  const sum = ratios.reduce((a, b) => a + b, 0);
  if (sum === 0) return ratios.map(() => 0 as Cents);
  const floats = ratios.map(r => (r / sum) * total);
  const floored = floats.map(f => Math.floor(f));
  const remainder = total - floored.reduce((a, b) => a + b, 0);
  const sortedByRemainder = floats
    .map((f, i) => ({ rem: f - floored[i], i }))
    .sort((a, b) => b.rem - a.rem);
  for (let k = 0; k < remainder; k++) {
    floored[sortedByRemainder[k].i]++;
  }
  return floored as Cents[];
}
```

### Unit Tests for lib/cents.ts

```typescript
// src/lib/cents.test.ts
import { describe, it, expect } from 'vitest';
import { parseCents, formatCents, splitCents, pctOf, addCents } from './cents';
import type { Cents } from './cents';

describe('parseCents', () => {
  it('handles standard decimal input', () => {
    expect(parseCents('19.99')).toBe(1999);
  });
  it('handles whole numbers', () => {
    expect(parseCents('2000')).toBe(200000);
  });
  it('handles zero', () => {
    expect(parseCents('0')).toBe(0);
  });
  it('handles single decimal place', () => {
    expect(parseCents('19.9')).toBe(1990);
  });
  it('no floating-point leakage on known problematic values', () => {
    expect(parseCents('19.99')).toBe(1999);   // not 1998.9999...
    expect(parseCents('1.01')).toBe(101);
    expect(parseCents('99.99')).toBe(9999);
  });
});

describe('splitCents', () => {
  it('splits evenly', () => {
    expect(splitCents(100 as Cents, [1, 1])).toEqual([50, 50]);
  });
  it('total always equals input (largest-remainder correctness)', () => {
    const total = 100 as Cents;
    const parts = splitCents(total, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
  });
  it('handles uneven ratios', () => {
    const total = 1000 as Cents;
    const parts = splitCents(total, [33, 33, 34]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
  });
  it('handles large invoice amounts', () => {
    const total = 200000 as Cents; // €2000
    const parts = splitCents(total, [37, 35, 15, 13]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
  });
  it('returns empty for empty ratios', () => {
    expect(splitCents(100 as Cents, [])).toEqual([]);
  });
});

describe('pctOf', () => {
  it('calculates percentage of cents (floor)', () => {
    expect(pctOf(200000 as Cents, 37)).toBe(74000);
  });
  it('floors result to integer', () => {
    expect(pctOf(100 as Cents, 33)).toBe(33); // not 33.333...
  });
});

describe('addCents', () => {
  it('sums multiple Cents values', () => {
    expect(addCents(100 as Cents, 200 as Cents, 300 as Cents)).toBe(600);
  });
});
```

### FSA Permission Check on Startup (with user gesture gate)

```typescript
// src/lib/storage/fsaDriver.ts — startup flow
// Called at app boot from main.tsx:
//   const fsaReady = await fsaDriver.init();
//   if (!fsaReady) { /* show "Grant access" button */ }

async init(): Promise<boolean> {
  const db = await openDB('money-flow-meta', 1, {
    upgrade(db) { db.createObjectStore('fsa-handles'); },
  });
  const stored: FileSystemDirectoryHandle | undefined = await db.get('fsa-handles', 'workDir');
  if (!stored) return false;
  const perm = await stored.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    this.dirHandle = stored;
    return true;
  }
  // perm === 'prompt' — must not call requestPermission here
  // Store the handle so requestPermission() can use it
  this.pendingHandle = stored;
  return false;
}

// Called from button click handler ONLY:
async requestPermission(): Promise<void> {
  if (this.pendingHandle) {
    await this.pendingHandle.requestPermission({ mode: 'readwrite' });
    this.dirHandle = this.pendingHandle;
    this.pendingHandle = null;
  } else {
    this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  }
  const db = await openDB('money-flow-meta', 1);
  await db.put('fsa-handles', this.dirHandle, 'workDir');
}
```

### FSA Write with NotAllowedError Catch

```typescript
// Every write path in fsaDriver.ts
async write<T>(key: string, data: T): Promise<void> {
  if (!this.dirHandle) throw new Error('FsaDriver: not initialized');
  try {
    const fileHandle = await this.dirHandle.getFileHandle(`${key}.json`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      // Background-tab revocation — re-throw so stores can surface re-prompt UI
      throw e;
    }
    throw e;
  }
}
```

### Vitest Setup File

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
```

### package.json scripts (including npm start)

```json
{
  "scripts": {
    "start": "vite",
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostCSS-based Tailwind | `@tailwindcss/vite` plugin (CSS-first) | Tailwind v4.0, Jan 2025 | No `tailwind.config.js`; `@theme` in CSS only; delete `postcss.config.js` |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui Tailwind v4 migration, Feb 2025 | Different package name; same `@import` pattern |
| HSL color tokens in shadcn | OKLCH color tokens | shadcn Tailwind v4 update, Feb 2025 | Colors defined in `@theme` block as OKLCH values; no hsl() wrappers |
| `tailwind.config.js` in components.json | `"config": ""` (empty string) | shadcn Tailwind v4 support | Required for shadcn CLI to work; non-empty value breaks `npx shadcn add` |
| `@testing-library/react` v14/v15 | v16 | React 19 release | v16+ required for React 19 compatibility; v14/v15 do not support new concurrent hooks |
| `reporters: ['basic']` in Vitest | `reporters: ['default']` | Vitest 4.0 | `basic` reporter removed; `default` is now the standard |
| Zustand `useSelector` returning objects | `useShallow` wrapper | Zustand v5 | Without `useShallow`, object selectors create new references every render → infinite loops |
| Node 18 for Vite | Node 20.19+ or 22.12+ | Vite 7.0 | Node 18 dropped (EOL); scaffolding on Node 18 silently succeeds but fails at build time |
| `ForwardRef` in shadcn components | `data-slot` attributes | shadcn Tailwind v4 update | `React.forwardRef` removed; direct ref passing via `data-slot`; no behavior change for consumers |

**Deprecated/outdated:**
- `tailwindcss-animate`: replaced by `tw-animate-css`; do not install
- `tailwind.config.js` on new Tailwind v4 projects: use `@theme {}` in CSS
- `@testing-library/react` v14/v15 with React 19: v16 required
- Vitest `reporters: ['basic']`: removed in v4
- Zustand `persist` middleware for FSA-backed stores: antipattern creates second source of truth

---

## Open Questions

1. **FSA persistent permissions (Chrome 122+ prompt)**
   - What we know: Chrome 122 introduced a persistent permission prompt that lets users opt in to having FSA permissions survive session boundaries.
   - What's unclear: The exact UX and API behavior when persistent permission is granted — does `queryPermission()` return `'granted'` immediately on next page load without a user gesture?
   - Recommendation: Implement the standard `queryPermission()` → `requestPermission()` pattern (works regardless of persistent permission state). If persistent permission is granted, `queryPermission()` returns `'granted'` and the extra button is never shown. No special handling needed.

2. **`parseCents` edge cases for European number formats**
   - What we know: The target user is a European freelancer. European locale formats use `.` for thousands separator and `,` for decimal: `1.999,99`.
   - What's unclear: Whether the invoice entry field will accept European-format strings on input, or whether the user will always type in a normalized format.
   - Recommendation: For Phase 1, implement `parseCents` to strip non-numeric-except-dot characters and handle `"19.99"` format. Add European format handling (replace `,` decimal with `.`) in Phase 3 when the invoice form is built, at the form input boundary rather than in `parseCents` itself.

3. **Branded `Cents` type strictness vs. ergonomics**
   - What we know: `type Cents = number & { readonly __brand: 'Cents' }` prevents raw numbers from being passed where Cents is expected at compile time.
   - What's unclear: Whether the branding overhead creates friction in Vitest tests (requiring `as Cents` casts throughout).
   - Recommendation: Implement with the brand in Phase 1 unit tests to validate the ergonomics. If test verbosity is unacceptable, fall back to `type Cents = number` with a clear comment — the unit tests still prove correctness even without compile-time branding.

---

## Sources

### Primary (HIGH confidence)

- [Vite 7.0 announcement](https://vite.dev/blog/announcing-vite7) — Node 20.19+ requirement, ESM-only, breaking changes
- [React 19.2 blog post](https://react.dev/blog/2025/10/01/react-19-2) — version 19.2.4, feature list
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first, `@theme` directive, Vite plugin, no `tailwind.config.js`
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — New York default, OKLCH, `tw-animate-css`, `"config": ""` in components.json
- [shadcn/ui changelog February 2025](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4) — Tailwind v4 + React 19 support confirmed
- [Zustand v5 migration guide](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5) — `useShallow` requirement, persist middleware behavioral changes
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) — `basic` reporter removed, Vite 7 support
- [Chrome Developers — File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) — handle lifecycle, permission model
- [Chrome Developers — Persistent Permissions for FSA](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) — `queryPermission()` + `requestPermission()` pattern, Chrome 122+
- [jakearchibald/idb GitHub](https://github.com/jakearchibald/idb) — version 8.0.3, typed object stores, FSA handle serialization

### Secondary (MEDIUM confidence)

- [xjavascript.com — FSA handle storage guide](https://www.xjavascript.com/blog/file-system-access-api-is-it-possible-to-store-the-filehandle-of-a-saved-or-loaded-file-for-later-use/) — idb + FSA integration pattern; verified against MDN queryPermission docs
- [Frontstuff — Handle Monetary Values in JavaScript](https://frontstuff.io/how-to-handle-monetary-values-in-javascript) — integer cents pattern; verified against multiple sources
- [Honeybadger — Currency Calculations in JavaScript](https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/) — cents arithmetic pattern; cross-verified

### Tertiary (LOW confidence)

- None for Phase 1 — all critical implementation details have PRIMARY or SECONDARY sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions verified against official npm/blog announcements
- Architecture: HIGH — driver abstraction, cents boundary, initialized guard are well-established patterns with official doc support
- Pitfalls: HIGH — FSA permission model from official Chrome docs; float arithmetic from well-established consensus; Tailwind v4 gotchas from official shadcn changelog
- Scaffold configuration: HIGH — exact config values from official Tailwind v4 and shadcn/ui Tailwind v4 documentation

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (30 days — stack is stable; Tailwind v4 and shadcn are actively maintained but breaking changes are unlikely within 30 days)
