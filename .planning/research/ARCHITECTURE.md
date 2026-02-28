# Architecture Research

**Domain:** Local-first browser finance allocation app (single-user, no backend)
**Researched:** 2026-02-27
**Confidence:** HIGH (core patterns verified via official docs and multiple sources)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Dashboard  │  │   Invoices   │  │ Accounts │  │ History │  │
│  │  (feature)  │  │   (feature)  │  │ (feature)│  │(feature)│  │
│  └──────┬──────┘  └──────┬───────┘  └────┬─────┘  └────┬────┘  │
│         │                │               │              │       │
│  ┌──────┴─────────────────────────────────────────────────────┐ │
│  │              shared/components (shadcn/ui base)            │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                       State Layer (Zustand)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ accountStore │  │ allocationSt │  │    settingsStore     │   │
│  │              │  │     ore      │  │  (buckets, floors)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
├─────────┴─────────────────┴──────────────────────┴───────────────┤
│                      Domain Logic Layer                          │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ allocationEng │  │  centsUtils  │  │    csvAnalyzer        │  │
│  │  (mode + calc)│  │(parseCents,  │  │  (AI integration)     │  │
│  │               │  │ formatCents) │  │                       │  │
│  └───────────────┘  └──────────────┘  └───────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Persistence Layer                             │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐  │
│  │   FSA Driver                 │  │   IndexedDB Driver       │  │
│  │  (FileSystemAccess API)      │  │   (idb, fallback)        │  │
│  │  human-readable JSON files   │  │   same schema            │  │
│  └──────────────┬───────────────┘  └─────────────┬────────────┘  │
│                 └─────────────┬───────────────────┘              │
│                        ┌──────┴──────┐                           │
│                        │  storage.ts │ (driver abstraction)      │
│                        └─────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Feature modules | Render UI for one domain area, read/write stores | React components + local hooks |
| Zustand stores | Own in-memory state, expose typed actions | `create<State>()(...)` per domain |
| Domain logic | Pure business rules (allocation engine, mode detection) | Plain TS functions, no React dependencies |
| centsUtils | All money arithmetic boundary crossing | `parseCents`, `formatCents`, `addCents`, `pctOf` |
| storage.ts | Driver selection and read/write interface | Module with FSA driver and IDB fallback |
| FSA Driver | Write canonical JSON files to user-chosen directory | File System Access API + atomic writes |
| IDB Driver | Same schema stored in browser IndexedDB | `idb` library wrapper |
| csvAnalyzer | Parse CSV, call AI API, return structured suggestions | Papa Parse + fetch to Anthropic API |

---

## Recommended Project Structure

```
src/
├── features/
│   ├── dashboard/          # Entry screen: account balances, mode indicator
│   │   ├── Dashboard.tsx
│   │   └── ModeIndicator.tsx
│   ├── invoices/           # Invoice entry + allocation result view
│   │   ├── InvoiceForm.tsx
│   │   ├── AllocationResult.tsx
│   │   └── MoveInstruction.tsx
│   ├── accounts/           # Account list, inline balance edits
│   │   ├── AccountList.tsx
│   │   ├── AccountCard.tsx
│   │   └── BalanceEditor.tsx
│   ├── buckets/            # Floor items + overflow ratio config
│   │   ├── BucketList.tsx
│   │   └── FloorItemEditor.tsx
│   ├── history/            # Past allocations log
│   │   ├── HistoryList.tsx
│   │   └── AllocationDetail.tsx
│   └── csv-import/         # CSV upload + AI analysis result
│       ├── CsvUpload.tsx
│       └── AiSuggestions.tsx
│
├── stores/
│   ├── accountStore.ts     # Account balances, targets, types
│   ├── allocationStore.ts  # Current invoice, pending moves, history
│   └── settingsStore.ts    # Buckets, floor items, overflow ratios, thresholds
│
├── domain/
│   ├── allocationEngine.ts # Stabilize vs Distribute mode logic
│   ├── modeDetection.ts    # Auto-detect mode from account state
│   ├── floorCalculator.ts  # Sum active floor items, coverage check
│   └── csvAnalyzer.ts      # CSV parsing + AI suggestion generation
│
├── lib/
│   ├── cents.ts            # parseCents, formatCents, arithmetic helpers
│   ├── storage/
│   │   ├── storage.ts      # Driver abstraction (selectDriver, read, write)
│   │   ├── fsaDriver.ts    # File System Access API implementation
│   │   └── idbDriver.ts    # IndexedDB fallback (idb library)
│   └── ai.ts               # Anthropic API client wrapper
│
├── types/
│   ├── domain.ts           # Account, Bucket, FloorItem, AllocationMove
│   └── persistence.ts      # Serialized form of all domain objects
│
├── shared/
│   ├── components/         # UI primitives (Button, Card wrapping shadcn)
│   └── hooks/              # useFormatCents, usePersistenceStatus
│
├── App.tsx                 # Route shell (simple state router)
└── main.tsx                # Vite entry, storage initialization
```

### Structure Rationale

- **features/:** Colocation principle — each feature owns its components, sub-hooks, and tests. Max two levels deep. Adding a new feature is one new folder.
- **stores/:** Three stores map to three distinct domains. Keeps Zustand slices at human scale (~150-300 lines each). Cross-store reads use `getState()`.
- **domain/:** Pure TypeScript. Zero React imports. Testable in Node/Vitest without a browser. The allocation engine is the most complex file in the app — it deserves isolation.
- **lib/cents.ts:** Every number that crosses a boundary (parse, format, arithmetic) goes through here. Single file, easily audited.
- **lib/storage/:** Driver pattern means feature code never calls FSA or IDB directly. If browser support changes, only this folder changes.
- **types/:** Shared type definitions prevent circular imports between features and stores.

---

## Architectural Patterns

### Pattern 1: Driver Abstraction for Dual Persistence

**What:** A `storage.ts` module selects the appropriate persistence driver at startup, exposes a uniform `read(key)` / `write(key, data)` interface. All callers are ignorant of which driver is active.

**When to use:** Whenever two implementations must be swappable without changing call sites. Here: FSA is preferred (human-readable files survive clears), IDB is fallback (Firefox, Safari without permissions).

**Trade-offs:** Adds indirection. Worth it — without abstraction, FSA/IDB differences leak into every store action.

```typescript
// lib/storage/storage.ts
interface StorageDriver {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, data: T): Promise<void>;
  isAvailable(): Promise<boolean>;
}

export async function initStorage(): Promise<StorageDriver> {
  const fsa = new FsaDriver();
  if (await fsa.isAvailable()) return fsa;
  return new IdbDriver();
}

// Stores call this — never FSA or IDB directly
export let storage: StorageDriver;
export async function bootstrapStorage() {
  storage = await initStorage();
}
```

### Pattern 2: Cents Boundary Enforcement

**What:** All money values are stored as `number` (integer cents) in types, stores, and domain functions. The only place decimal strings appear is at the UI boundary. `parseCents` converts input; `formatCents` converts output. No `*100` or `/100` anywhere except inside `lib/cents.ts`.

**When to use:** Everywhere. This is a constraint, not an option.

**Trade-offs:** Requires discipline — one forgotten `/100` reintroduces floating-point bugs. The reward: no rounding errors in allocation math.

```typescript
// lib/cents.ts
export type Cents = number; // always integer

export function parseCents(s: string): Cents {
  // "1234.56" -> 123456   "1234" -> 123400
  const [whole, frac = '00'] = s.split('.');
  return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0').slice(0, 2), 10);
}

export function formatCents(c: Cents, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'EUR',
  }).format(c / 100);
}

export function pctOf(amount: Cents, pct: number): Cents {
  // pct is 0-100, result truncated to integer cents
  return Math.floor((amount * pct) / 100);
}

export function addCents(...amounts: Cents[]): Cents {
  return amounts.reduce((a, b) => a + b, 0);
}
```

### Pattern 3: Zustand Domain Stores (No Persist Middleware)

**What:** Three stores, each owning one domain. No Zustand persist middleware — FSA/IDB handles persistence explicitly. Stores expose typed actions that call `storage.write()` after mutations.

**When to use:** Always in this project. Zustand persist middleware would fight with the dual-driver persistence layer.

**Trade-offs:** Manual save/load is more code than persist middleware, but gives full control over when and what is written. Critical for atomic "Done" button behavior (all account balances updated together).

```typescript
// stores/allocationStore.ts
interface AllocationState {
  pendingMoves: AllocationMove[];
  history: AllocationRecord[];
  confirmAllocation: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

export const useAllocationStore = create<AllocationState>()((set, get) => ({
  pendingMoves: [],
  history: [],
  confirmAllocation: async () => {
    const moves = get().pendingMoves;
    const record: AllocationRecord = { /* ... */ };
    set(s => ({ history: [record, ...s.history], pendingMoves: [] }));
    // Atomic: write history + updated account balances together
    await storage.write('history', get().history);
    await useAccountStore.getState().applyMoves(moves);
  },
  loadHistory: async () => {
    const history = await storage.read<AllocationRecord[]>('history') ?? [];
    set({ history });
  },
}));
```

### Pattern 4: FSA Handle Stored in IndexedDB for Persistence

**What:** On first run, prompt user to select a save directory via `showDirectoryPicker()`. Store the returned `FileSystemDirectoryHandle` in IndexedDB. On startup, retrieve handle, call `queryPermission()`, and re-prompt only if needed.

**When to use:** Every session start, before any read/write.

**Trade-offs:** Requires user gesture on first run and sometimes subsequent runs. The UX pattern is: "Choose where your data lives" — acceptable for a power-user finance tool. VS Code does this with its vscode-filehandles-store.

```typescript
// lib/storage/fsaDriver.ts
export class FsaDriver implements StorageDriver {
  private dirHandle: FileSystemDirectoryHandle | null = null;

  async isAvailable(): Promise<boolean> {
    return 'showDirectoryPicker' in window;
  }

  async init(): Promise<boolean> {
    // Try to restore from IDB first
    const stored = await idbGet<FileSystemDirectoryHandle>('fsa-dir-handle');
    if (stored) {
      const perm = await stored.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') { this.dirHandle = stored; return true; }
      // perm === 'prompt' — need user gesture, handle in UI
    }
    return false;
  }

  async requestDir(): Promise<void> {
    // Must be called from user gesture (button click)
    this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await idbSet('fsa-dir-handle', this.dirHandle);
  }

  async write<T>(key: string, data: T): Promise<void> {
    const file = await this.dirHandle!.getFileHandle(`${key}.json`, { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }

  async read<T>(key: string): Promise<T | null> {
    try {
      const file = await this.dirHandle!.getFileHandle(`${key}.json`);
      const f = await file.getFile();
      return JSON.parse(await f.text()) as T;
    } catch { return null; }
  }
}
```

### Pattern 5: Pure Domain Logic Layer

**What:** The allocation engine is a set of pure TypeScript functions that accept data and return results. No React, no store access, no side effects.

**When to use:** For the allocation engine, mode detection, and floor calculator. These are the business rules — they must be testable in isolation.

**Trade-offs:** Requires stores to call domain functions explicitly and pass in data. This is correct — stores own when computation happens; domain owns what the computation is.

```typescript
// domain/allocationEngine.ts
export function computeAllocation(
  invoiceAmountCents: Cents,
  accounts: Account[],
  settings: AllocationSettings,
): AllocationResult {
  const mode = detectMode(accounts, settings);
  if (mode === 'stabilize') return stabilize(invoiceAmountCents, accounts, settings);
  return distribute(invoiceAmountCents, accounts, settings);
}

export function detectMode(
  accounts: Account[],
  settings: AllocationSettings,
): 'stabilize' | 'distribute' {
  const uncoveredFloor = computeUncoveredFloor(accounts, settings);
  return uncoveredFloor > 0 ? 'stabilize' : 'distribute';
}
```

---

## Data Flow

### Invoice Entry Flow

```
User types invoice amount (string "2000.00")
    |
    v
InvoiceForm calls parseCents("2000.00") -> 200000
    |
    v
allocationStore.computeForInvoice(200000)
    |
    v
Calls domain/allocationEngine.computeAllocation(200000, accounts, settings)
    | (pure function, no side effects)
    v
Returns AllocationResult { mode, moves: [{ accountId, amountCents, reason }] }
    |
    v
Store sets pendingMoves in memory (no save yet)
    |
    v
UI renders AllocationResult -> user sees move instructions
    |
    v
User clicks "Done"
    |
    v
confirmAllocation(): update balances + append history atomically
    |
    v
storage.write('accounts', ...) + storage.write('history', ...)
    |
    v
UI reflects new balances
```

### Startup / Initialization Flow

```
main.tsx renders App
    |
    v
App calls bootstrapStorage()
    |
    v
FsaDriver.init() tries to restore saved handle from IDB
    |
    +-- Permission granted -> FSA driver active, load all stores
    |
    +-- No handle or needs prompt ->
            Show "Choose data folder" screen (user gesture required)
                |
                v
            FsaDriver.requestDir() -> stores handle in IDB
                |
                v
            Load all stores from FSA files
    (IDB driver used silently if showDirectoryPicker unavailable)
```

### CSV Analysis Flow

```
User uploads CSV file(s)
    |
    v
CsvUpload reads file as text (File.text())
    |
    v
csvAnalyzer.parseTransactions(csvText) via Papa Parse
    -> returns Transaction[]
    |
    v
csvAnalyzer.analyzeWithAI(transactions, apiKey)
    -> sends categorized summary to Anthropic API
    -> returns BucketSuggestion[]
    |
    v
settingsStore holds suggestions in memory (not persisted until user accepts)
    |
    v
AiSuggestions renders each suggestion with reasoning shown
    |
    v
User accepts -> settingsStore.applyAiSuggestions() -> storage.write('settings', ...)
```

### State Read Flow

```
React component renders
    |
    v
useAccountStore(s => s.accounts)  -- subscribes to slice
    |
    v
Zustand notifies only this component when accounts change
    |
    v
Cents values formatted at render time: formatCents(account.balanceCents)
    |
    v
User never sees raw cent integers
```

---

## How FSA + IndexedDB Coexist

| Concern | FSA Driver | IDB Driver |
|---------|------------|------------|
| Where data lives | User-chosen directory, real .json files | Browser origin storage, auto-managed |
| Survives browser clear | Yes (files on disk) | No (wiped with cookies/storage) |
| Human-readable | Yes (pretty-printed JSON) | No (binary IDB format) |
| Cross-device | Easy (sync folder with Dropbox/iCloud etc.) | No |
| Requires user gesture | Yes (initial dir selection, occasional re-prompt) | No |
| Browser support | Chrome/Edge (Chromium) | All modern browsers |
| Handle persistence | FileSystemDirectoryHandle stored in IDB | N/A |

**Coexistence strategy:**

1. Both drivers implement the same `StorageDriver` interface.
2. FSA is always attempted first at startup.
3. If FSA is unavailable (Firefox, Safari without OPFS, or user refused), IDB driver activates transparently.
4. The FSA driver itself uses IDB only to persist its directory handle between sessions — it does NOT store app data in IDB.
5. If a user migrates from IDB to FSA (gets a new Chromium browser), the app can offer a one-time migration: read all from IDB, write all to FSA.

**File layout on disk (FSA mode):**

```
~/money-flow-data/         (user-chosen directory)
├── accounts.json          # Account[] with balanceCents
├── settings.json          # Buckets, floor items, overflow ratios
└── history.json           # AllocationRecord[]
```

---

## Where Zustand Stores Live and What They Own

### accountStore

Owns: current state of every account (balance, target, type, name, currency).

Key actions:
- `loadAccounts()` — read from storage on boot
- `updateBalance(id, newCents)` — inline edit
- `applyMoves(moves)` — called by allocationStore.confirmAllocation
- `addAccount(...)`, `removeAccount(id)`

Does NOT own: account target policy (settingsStore). Owns the actual current balance.

### allocationStore

Owns: pending allocation (one invoice at a time), computed moves, allocation history.

Key actions:
- `computeForInvoice(amountCents)` — calls domain/allocationEngine, sets pendingMoves
- `confirmAllocation()` — atomic commit: save history + trigger accountStore.applyMoves
- `loadHistory()` — read from storage on boot
- `clearPending()` — cancel current invoice

Does NOT own: the rules for how allocation works (that is domain/allocationEngine.ts).

### settingsStore

Owns: bucket configuration (name, percentage/amount, destination, priority), floor items (name, amountCents, expiry, covered flag), overflow ratios, Wise buffer target.

Key actions:
- `loadSettings()` — read from storage on boot
- `updateBucket(...)`, `addFloorItem(...)`, `removeFloorItem(...)`
- `markFloorCovered(id)`, `resetMonthlyFloor()` (new month)
- `setAiSuggestions(suggestions)` — temp state while user reviews
- `applyAiSuggestions()` — persist accepted suggestions

Does NOT own: the current month's calculated floor total (derived in allocationEngine from settingsStore data).

---

## Integer Cents Flow Through the System

```
User input (string)
  "2000.00" or "2,000" or "2000"
       |
       v  parseCents()
  Cents = 200000  (integer, no decimals anywhere)
       |
       v  stored in stores, passed to domain functions
  allocationEngine: pctOf(200000, 37) -> 74000
  addCents(74000, 50000) -> 124000
       |
       v  formatCents() only at render
  "740,00 EUR"  "500,00 EUR"  "1.240,00 EUR"
```

**Rules enforced:**
1. `parseCents` called exactly once per user-input string (at form submit or on-blur).
2. `formatCents` called exactly once per value at render time.
3. No `/ 100` or `* 100` in any file except `lib/cents.ts`.
4. All JSON files on disk store cents as integers (no decimal strings in persistence).
5. TypeScript `Cents = number` type alias makes grep-auditing practical.

---

## Build Order (Phase Dependencies)

The dependency graph drives phase ordering:

```
Phase 1: Foundation
  lib/cents.ts               (no dependencies)
  types/domain.ts            (depends on cents)
  lib/storage/ (both drivers)(depends on types)
  stores/ (all three)        (depends on storage + types)

Phase 2: Domain Logic
  domain/allocationEngine.ts (depends on types + cents)
  domain/modeDetection.ts    (depends on types)
  domain/floorCalculator.ts  (depends on types + cents)
  -> Vitest tests for all domain functions here

Phase 3: Core UI
  features/dashboard/        (depends on stores)
  features/accounts/         (depends on accountStore)
  features/invoices/         (depends on allocationStore + allocationEngine)
  -> Manual test: enter invoice, see move instructions, click Done

Phase 4: Configuration UI
  features/buckets/          (depends on settingsStore)
  -> Manual test: add/edit floor items, change ratios, see mode change

Phase 5: History
  features/history/          (depends on allocationStore)
  -> Manual test: confirm allocation, check history log

Phase 6: CSV Import + AI
  domain/csvAnalyzer.ts      (depends on Papa Parse + AI client)
  lib/ai.ts                  (depends on Anthropic SDK or fetch)
  features/csv-import/       (depends on csvAnalyzer + settingsStore)
  -> Manual test: upload real CSV, see suggestions with reasoning

Phase 7: Persistence Hardening
  Storage migration path (IDB -> FSA)
  Startup permission flow UX
  Error states (permission revoked, quota exceeded)
```

**Why this order:**
- Cents and types have zero dependencies — they anchor everything.
- Storage must exist before stores (stores call storage).
- Domain logic must exist before UI (UI calls stores which call domain).
- CSV/AI is last because it has external API dependency and no other feature depends on it.
- Persistence hardening is last because happy-path must work before error handling.

---

## Anti-Patterns

### Anti-Pattern 1: Floating-Point Money

**What people do:** Store money as `number` (float), multiply/divide directly.
**Why it's wrong:** `0.1 + 0.2 === 0.30000000000000004`. Allocation results will be off by 1-2 cents, accumulating silently.
**Do this instead:** `parseCents` on input, integer arithmetic everywhere, `formatCents` on output.

### Anti-Pattern 2: Zustand Persist Middleware with FSA

**What people do:** Add `persist` middleware to Zustand stores and point at localStorage or a custom storage adapter.
**Why it's wrong:** Persist middleware fires on every state change. FSA writes are async and require user-granted handles. Using persist middleware means fighting the FSA permission model and potentially losing writes silently.
**Do this instead:** Explicit `storage.write()` calls inside store actions at meaningful save points (after confirmAllocation, after settings change). This gives atomic control.

### Anti-Pattern 3: AI API Key in Source or Storage

**What people do:** Put Anthropic API key in `.env`, commit it, or store it in localStorage unencrypted.
**Why it's wrong:** Open source repo + public GitHub = key exposure.
**Do this instead:** Prompt user to paste API key each session (stored in sessionStorage, never persisted) OR store encrypted in settings.json with a warning. Never commit to git.

### Anti-Pattern 4: One Monolithic Zustand Store

**What people do:** Put all state (accounts, settings, history, pending allocation) in one `create()` call.
**Why it's wrong:** Every component subscribed to any part of the store re-renders when any state changes. For a finance tool with frequent balance updates, this causes all allocation history to re-render when you edit an account name.
**Do this instead:** Three stores (`accountStore`, `allocationStore`, `settingsStore`). Components subscribe to exactly what they need.

### Anti-Pattern 5: Domain Logic in Components

**What people do:** Write the Stabilize/Distribute algorithm inline in `InvoiceForm.tsx` or inside a Zustand action.
**Why it's wrong:** Cannot unit test without a browser. Cannot reuse. Cannot audit the financial logic without wading through React code.
**Do this instead:** `domain/allocationEngine.ts` — pure functions, tested with Vitest in Node environment.

### Anti-Pattern 6: Re-requesting FSA Directory on Every Session

**What people do:** Call `showDirectoryPicker()` every time the app loads.
**Why it's wrong:** Requires user interaction before any data loads, even when the previous handle is still valid.
**Do this instead:** Store handle in IDB, call `queryPermission()` first. Only call `requestPermission()` if query returns `'prompt'`, and only call `showDirectoryPicker()` on first run or if the stored handle is gone.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic API | `fetch` POST from browser to `api.anthropic.com` | Requires `anthropic-dangerous-direct-browser-access: true` header. User provides API key. Verify current CORS policy before implementing. |
| File System Access API | Browser native API, no library | Wrap in `lib/storage/fsaDriver.ts`. Check `'showDirectoryPicker' in window` for availability. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Feature -> Store | Zustand hooks (`useAccountStore`) | No direct store imports in components except via hooks |
| Store -> Domain | Direct function call (`allocationEngine.computeAllocation(...)`) | Stores call domain; domain never imports stores |
| Store -> Storage | `storage.write(key, data)` / `storage.read(key)` | Always async. Stores manage their own keys. |
| Domain functions | Pure function arguments | No shared mutable state between domain files |
| FSA Driver -> IDB | IDB used only for handle persistence | `idb` library in FSA driver for handle storage, not app data |

---

## Scaling Considerations

This is a single-user local app. "Scaling" here means data growth over time, not user count.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-12 months of history | Current architecture handles fine. JSON files stay small (under 100KB). |
| 3-5 years of history | History file can grow. Paginate reads: store history as yearly files (`history-2026.json`). |
| Many accounts (20+) | No changes needed. All accounts load into memory on startup. |
| CSV with 10k+ rows | Papa Parse is streaming-capable. Move csvAnalyzer to a Web Worker to avoid blocking UI. |

### Scaling Priorities

1. **First bottleneck:** History JSON file size (after years of daily use). Fix: split by year.
2. **Second bottleneck:** CSV parsing of large exports blocking the UI thread. Fix: Web Worker for Papa Parse.

---

## Sources

- File System Access API: [Chrome Developers — File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) — HIGH confidence (official docs)
- FSA handle persistence in IDB: [xjavascript.com — FileHandle storage guide](https://www.xjavascript.com/blog/file-system-access-api-is-it-possible-to-store-the-filehandle-of-a-saved-or-loaded-file-for-later-use/) — MEDIUM confidence (verified against MDN queryPermission docs)
- Persistent permissions: [Chrome Developers blog — Persistent Permissions for FSA](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) — HIGH confidence (official source)
- Zustand slice pattern: [Atlys Engineering — Slice-Based Zustand Store](https://engineering.atlys.com/a-slice-based-zustand-store-for-next-js-14-and-typescript-6b92385a48f5), [Zustand GitHub discussions #2496](https://github.com/pmndrs/zustand/discussions/2496) — HIGH confidence (official GitHub + verified engineering blog)
- Zustand multiple stores guidance: [pmndrs/zustand GitHub](https://github.com/pmndrs/zustand) — HIGH confidence (official repo)
- Integer cents pattern: [Frontstuff — Handle Monetary Values in JavaScript](https://frontstuff.io/how-to-handle-monetary-values-in-javascript), [Honeybadger — Currency Calculations in JavaScript](https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/) — HIGH confidence (multiple sources agree, well-established pattern)
- idb library: [jakearchibald/idb GitHub](https://github.com/jakearchibald/idb) — HIGH confidence (official repo)
- Feature-based folder structure: [Robin Wieruch — React Folder Structure](https://www.robinwieruch.de/react-folder-structure/), [Profy — Screaming Architecture](https://profy.dev/article/react-folder-structure) — MEDIUM confidence (community consensus, not an official React recommendation)
- Anthropic browser API: LOW confidence — verify `anthropic-dangerous-direct-browser-access` header and CORS policy against current Anthropic SDK docs before implementing CSV analysis feature

---

*Architecture research for: local-first browser finance allocation app*
*Researched: 2026-02-27*
