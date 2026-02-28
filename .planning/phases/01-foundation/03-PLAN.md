---
phase: 01-foundation
plan: 03
type: execute
wave: 2
depends_on: ["01-PLAN"]
files_modified:
  - src/types/domain.ts
  - src/types/persistence.ts
  - src/lib/storage/storage.ts
  - src/lib/storage/fsaDriver.ts
  - src/lib/storage/idbDriver.ts
  - src/stores/accountStore.ts
  - src/stores/allocationStore.ts
  - src/stores/settingsStore.ts
  - src/main.tsx
  - src/App.tsx
autonomous: true
requirements:
  - INFRA-03
  - INFRA-04
  - INFRA-05
  - INFRA-07

must_haves:
  truths:
    - "On a Chrome/Edge browser with FSA support, bootstrapStorage() attempts to restore a stored directory handle from IndexedDB and returns the FSA driver if permission is already granted"
    - "If no handle exists or permission is 'prompt', bootstrapStorage() returns the IDB driver and exposes the pending FSA handle so the UI can show a 'Grant access' button — no automatic requestPermission() call"
    - "On Firefox/Safari (no showDirectoryPicker), bootstrapStorage() falls back to the IDB driver; all read/write operations work identically"
    - "FsaDriver.write() catches DOMException with name 'NotAllowedError' (background-tab revocation) and re-throws it so the store layer can surface a re-prompt"
    - "FsaDriver.write() writes JSON.stringify(data, null, 2) to a .json file named by the key — human-readable on disk"
    - "All three Zustand stores start with initialized: false and check it before every storage.write() call — no write fires before loadXxx() completes"
    - "Zustand stores do NOT use persist middleware — storage.write() is called explicitly on every mutation"
  artifacts:
    - path: "src/types/domain.ts"
      provides: "Account, FloorItem, AllocationMove, AllocationRecord, Settings — shared domain types"
      exports: ["Account", "FloorItem", "AllocationMove", "AllocationRecord", "Settings"]
    - path: "src/types/persistence.ts"
      provides: "Serialized shapes for JSON storage — may match domain types in v1"
      exports: ["PersistedAccounts", "PersistedSettings", "PersistedHistory"]
    - path: "src/lib/storage/storage.ts"
      provides: "StorageDriver interface + bootstrapStorage() factory + exported storage singleton"
      exports: ["StorageDriver", "bootstrapStorage", "storage"]
    - path: "src/lib/storage/fsaDriver.ts"
      provides: "FsaDriver implementing StorageDriver — FSA read/write with permission lifecycle"
      exports: ["FsaDriver"]
    - path: "src/lib/storage/idbDriver.ts"
      provides: "IdbDriver implementing StorageDriver — IndexedDB fallback"
      exports: ["IdbDriver"]
    - path: "src/stores/accountStore.ts"
      provides: "useAccountStore — accounts state with initialized guard"
      exports: ["useAccountStore"]
    - path: "src/stores/allocationStore.ts"
      provides: "useAllocationStore — allocation history with initialized guard"
      exports: ["useAllocationStore"]
    - path: "src/stores/settingsStore.ts"
      provides: "useSettingsStore — buckets, floor items, overflow ratios with initialized guard"
      exports: ["useSettingsStore"]
  key_links:
    - from: "src/main.tsx"
      to: "src/lib/storage/storage.ts"
      via: "await bootstrapStorage() called before React root render"
      pattern: "bootstrapStorage"
    - from: "src/stores/accountStore.ts"
      to: "src/lib/storage/storage.ts"
      via: "import { storage } and call storage.read / storage.write"
      pattern: "storage\\.write\\|storage\\.read"
    - from: "src/lib/storage/fsaDriver.ts"
      to: "idb library (openDB)"
      via: "FSA handle persisted in IndexedDB 'money-flow-meta' db"
      pattern: "openDB.*money-flow-meta"
    - from: "src/lib/storage/idbDriver.ts"
      to: "idb library (openDB)"
      via: "app data stored in IndexedDB 'money-flow-data' db"
      pattern: "openDB.*money-flow-data"
---

<objective>
Implement the dual-persistence layer (FSA primary + IDB fallback) and three Zustand stores with initialized guards. This is the data backbone every subsequent phase writes to.

Purpose: Correct FSA permission lifecycle and Zustand write guards prevent silent data loss. The StorageDriver abstraction keeps FSA/IDB complexity contained — stores and components never call FSA or IDB directly.
Output: storage.ts + fsaDriver.ts + idbDriver.ts + three stores + domain types. App loads from storage on startup.
</objective>

<execution_context>
@/root/.claude/get-shit-done/workflows/execute-plan.md
@/root/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/root/money-flow/.planning/phases/01-foundation/01-RESEARCH.md
@/root/money-flow/.planning/phases/01-foundation/01-01-SUMMARY.md
</context>

<interfaces>
<!-- Key patterns the executor must follow exactly. From 01-RESEARCH.md. -->

StorageDriver interface (src/lib/storage/storage.ts):
```typescript
export interface StorageDriver {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, data: T): Promise<void>;
  isAvailable(): Promise<boolean>;
}

export let storage: StorageDriver;

export async function bootstrapStorage(): Promise<{ needsFsaPrompt: boolean }> {
  // Returns { needsFsaPrompt: true } when FSA is available but needs user gesture
  // Returns { needsFsaPrompt: false } when storage is ready (FSA granted or IDB fallback)
}
```

FsaDriver (src/lib/storage/fsaDriver.ts):
```typescript
export class FsaDriver implements StorageDriver {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private pendingHandle: FileSystemDirectoryHandle | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  // Returns true = handle ready (permission granted)
  // Returns false = handle found but permission is 'prompt' (stores in pendingHandle)
  // Returns false = no handle in IDB (first run, needs showDirectoryPicker)
  async init(): Promise<boolean> { ... }

  // MUST only be called from user gesture (button click handler)
  async requestPermission(): Promise<void> { ... }

  async read<T>(key: string): Promise<T | null> { ... }
  async write<T>(key: string, data: T): Promise<void> { ... }
  // write throws DOMException(name='NotAllowedError') on background-tab revocation
  // write produces: dirHandle.getFileHandle(`${key}.json`, {create:true}), then JSON.stringify(data, null, 2)
}
```

IdbDriver (src/lib/storage/idbDriver.ts):
```typescript
export class IdbDriver implements StorageDriver {
  private db!: IDBPDatabase;

  async isAvailable(): Promise<boolean> { return true; }
  async init(): Promise<void> { ... }  // opens 'money-flow-data' db
  async read<T>(key: string): Promise<T | null> { ... }
  async write<T>(key: string, data: T): Promise<void> { ... }
}
```

Zustand store pattern (ALL three stores follow this exactly):
```typescript
import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';

interface XxxState {
  initialized: boolean;
  // ... domain fields ...
  loadXxx: () => Promise<void>;
  setXxx: (...) => Promise<void>;
}

export const useXxxStore = create<XxxState>()((set, get) => ({
  initialized: false,
  // ... initial empty state ...

  loadXxx: async () => {
    const data = await storage.read<...>('xxx') ?? defaultValue;
    set({ /* domain fields */ ...data, initialized: true });
  },

  setXxx: async (...) => {
    if (!get().initialized) return;  // CRITICAL GUARD
    set({ /* domain fields */ });
    await storage.write('xxx', /* data */);
  },
}));
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Define domain types and implement StorageDriver abstraction with FSA and IDB drivers</name>
  <files>src/types/domain.ts, src/types/persistence.ts, src/lib/storage/storage.ts, src/lib/storage/fsaDriver.ts, src/lib/storage/idbDriver.ts</files>
  <action>
Create the directory structure first:
```
mkdir -p /root/money-flow/src/types
mkdir -p /root/money-flow/src/lib/storage
```

**src/types/domain.ts** — Domain model types shared across all layers:
```typescript
export type AccountRole = 'income-hub' | 'spending' | 'savings' | 'tax' | 'investing';

export interface Account {
  id: string;
  name: string;
  balanceCents: number;   // integer cents — always
  targetCents: number;    // target balance in cents; 0 = no target
  role: AccountRole;
}

export interface FloorItem {
  id: string;
  name: string;
  amountCents: number;    // monthly amount in cents
  priority: number;       // lower = higher priority
  destinationAccountId: string;
  coveredThisMonth: boolean;
  expiryDate?: string;    // ISO date string; undefined = no expiry
  active: boolean;
}

export interface OverflowRatio {
  accountId: string;
  pct: number;            // 0-100; all overflow ratios must sum to 100
}

export interface Settings {
  taxPct: number;         // default 37; 0-100
  taxAccountId: string;
  bufferAccountId: string;
  bufferTargetCents: number;
  overflowRatios: OverflowRatio[];
  floorItems: FloorItem[];
}

export interface AllocationMove {
  destinationAccountId: string;
  amountCents: number;
  rule: string;           // e.g. "tax" | "floor" | "distribute"
  calculation: string;    // e.g. "37% of €2,000 = €740"
  reason: string;         // human-readable explanation
}

export interface AllocationRecord {
  id: string;
  date: string;           // ISO date string
  invoiceAmountCents: number;
  invoiceCurrency: string;
  invoiceEurEquivalentCents: number;
  mode: 'stabilize' | 'distribute';
  moves: AllocationMove[];
}
```

**src/types/persistence.ts** — Serialized shapes for JSON storage (v1: mirrors domain types):
```typescript
import type { Account, Settings, AllocationRecord } from './domain';

// In v1 the persistence shapes are identical to domain shapes.
// These aliases exist to allow them to diverge in future without touching domain.ts.
export type PersistedAccounts = Account[];
export type PersistedSettings = Settings;
export type PersistedHistory = AllocationRecord[];
```

**src/lib/storage/storage.ts** — StorageDriver interface and bootstrapStorage factory:
```typescript
import { FsaDriver } from './fsaDriver';
import { IdbDriver } from './idbDriver';

export interface StorageDriver {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, data: T): Promise<void>;
  isAvailable(): Promise<boolean>;
}

// Exported singleton — set by bootstrapStorage(), used by all stores
export let storage: StorageDriver;

// Exposed so UI can call requestPermission() on user gesture
export let fsaDriver: FsaDriver | null = null;

export interface BootstrapResult {
  needsFsaPrompt: boolean;  // true = FSA available but needs user gesture before use
  mode: 'fsa' | 'idb';
}

export async function bootstrapStorage(): Promise<BootstrapResult> {
  const fsa = new FsaDriver();
  fsaDriver = fsa;

  if (await fsa.isAvailable()) {
    const ready = await fsa.init();
    if (ready) {
      storage = fsa;
      return { needsFsaPrompt: false, mode: 'fsa' };
    }
    // FSA available but permission not granted — fall through to IDB,
    // surface "Grant access" button via needsFsaPrompt
    const idb = new IdbDriver();
    await idb.init();
    storage = idb;
    return { needsFsaPrompt: true, mode: 'idb' };
  }

  // FSA not available (Firefox/Safari)
  fsaDriver = null;
  const idb = new IdbDriver();
  await idb.init();
  storage = idb;
  return { needsFsaPrompt: false, mode: 'idb' };
}
```

**src/lib/storage/fsaDriver.ts** — File System Access API driver. Implement exactly as shown in 01-RESEARCH.md Code Examples section "FSA Permission Check on Startup":
```typescript
import { openDB } from 'idb';
import type { StorageDriver } from './storage';

const META_DB = 'money-flow-meta';
const META_DB_VERSION = 1;
const HANDLES_STORE = 'fsa-handles';
const DIR_KEY = 'workDir';

export class FsaDriver implements StorageDriver {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  // Stored when init() finds a handle but permission is 'prompt'
  // UI must call requestPermission() in a click handler to use it
  public pendingHandle: FileSystemDirectoryHandle | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async init(): Promise<boolean> {
    const db = await openDB(META_DB, META_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(HANDLES_STORE)) {
          db.createObjectStore(HANDLES_STORE);
        }
      },
    });
    const stored = await db.get(HANDLES_STORE, DIR_KEY) as FileSystemDirectoryHandle | undefined;
    if (!stored) return false;

    const perm = await stored.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      this.dirHandle = stored;
      return true;
    }
    // perm === 'prompt' — cannot call requestPermission here (not a user gesture)
    this.pendingHandle = stored;
    return false;
  }

  // MUST be called only from a user gesture (button click handler)
  async requestPermission(): Promise<void> {
    if (this.pendingHandle) {
      await this.pendingHandle.requestPermission({ mode: 'readwrite' });
      this.dirHandle = this.pendingHandle;
      this.pendingHandle = null;
    } else {
      this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    }
    const db = await openDB(META_DB, META_DB_VERSION);
    await db.put(HANDLES_STORE, this.dirHandle, DIR_KEY);
  }

  async read<T>(key: string): Promise<T | null> {
    if (!this.dirHandle) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(`${key}.json`);
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text()) as T;
    } catch {
      return null;  // File not found on first run — normal
    }
  }

  async write<T>(key: string, data: T): Promise<void> {
    if (!this.dirHandle) throw new Error('FsaDriver: not initialized — no directory handle');
    try {
      const fileHandle = await this.dirHandle.getFileHandle(`${key}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        // Background-tab permission revocation — re-throw so stores can surface re-prompt
        throw e;
      }
      throw e;
    }
  }
}
```

**src/lib/storage/idbDriver.ts** — IndexedDB fallback driver:
```typescript
import { openDB, IDBPDatabase } from 'idb';
import type { StorageDriver } from './storage';

const DATA_DB = 'money-flow-data';
const DATA_DB_VERSION = 1;
const DATA_STORE = 'app-data';

export class IdbDriver implements StorageDriver {
  private db!: IDBPDatabase;

  async isAvailable(): Promise<boolean> {
    return true;  // IndexedDB is available in all target browsers
  }

  async init(): Promise<void> {
    this.db = await openDB(DATA_DB, DATA_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DATA_STORE)) {
          db.createObjectStore(DATA_STORE);
        }
      },
    });
  }

  async read<T>(key: string): Promise<T | null> {
    const result = await this.db.get(DATA_STORE, key);
    return result !== undefined ? result as T : null;
  }

  async write<T>(key: string, data: T): Promise<void> {
    await this.db.put(DATA_STORE, data, key);
  }
}
```

After writing all files, run TypeScript type check:
```
cd /root/money-flow && npx tsc --noEmit 2>&1 | head -30
```
Fix any type errors before proceeding.
  </action>
  <verify>
    <automated>cd /root/money-flow && npx tsc --noEmit 2>&1; echo "Exit: $?"</automated>
  </verify>
  <done>
`tsc --noEmit` exits 0 (no type errors). All five files exist. FsaDriver, IdbDriver, and StorageDriver interface are exported correctly. No * 100 or / 100 in any storage file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement three Zustand stores with initialized guards and wire bootstrapStorage into main.tsx</name>
  <files>src/stores/accountStore.ts, src/stores/allocationStore.ts, src/stores/settingsStore.ts, src/main.tsx, src/App.tsx</files>
  <action>
Create the stores directory:
```
mkdir -p /root/money-flow/src/stores
```

**src/stores/accountStore.ts**:
```typescript
import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import type { Account } from '@/types/domain';
import type { PersistedAccounts } from '@/types/persistence';

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
    const data = await storage.read<PersistedAccounts>('accounts') ?? [];
    set({ accounts: data, initialized: true });
  },

  setAccounts: async (accounts) => {
    if (!get().initialized) return;  // Guard: never write before load completes
    set({ accounts });
    await storage.write<PersistedAccounts>('accounts', accounts);
  },

  updateBalance: async (id, newCents) => {
    if (!get().initialized) return;
    const updated = get().accounts.map(a =>
      a.id === id ? { ...a, balanceCents: newCents } : a
    );
    set({ accounts: updated });
    await storage.write<PersistedAccounts>('accounts', updated);
  },
}));
```

**src/stores/allocationStore.ts**:
```typescript
import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import type { AllocationRecord } from '@/types/domain';
import type { PersistedHistory } from '@/types/persistence';

interface AllocationState {
  initialized: boolean;
  history: AllocationRecord[];
  loadHistory: () => Promise<void>;
  appendAllocation: (record: AllocationRecord) => Promise<void>;
}

export const useAllocationStore = create<AllocationState>()((set, get) => ({
  initialized: false,
  history: [],

  loadHistory: async () => {
    const data = await storage.read<PersistedHistory>('history') ?? [];
    set({ history: data, initialized: true });
  },

  appendAllocation: async (record) => {
    if (!get().initialized) return;  // Guard
    const updated = [record, ...get().history];  // most recent first
    set({ history: updated });
    await storage.write<PersistedHistory>('history', updated);
  },
}));
```

**src/stores/settingsStore.ts**:
```typescript
import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import type { Settings } from '@/types/domain';
import type { PersistedSettings } from '@/types/persistence';

const DEFAULT_SETTINGS: Settings = {
  taxPct: 37,
  taxAccountId: '',
  bufferAccountId: '',
  bufferTargetCents: 0,
  overflowRatios: [],
  floorItems: [],
};

interface SettingsState {
  initialized: boolean;
  settings: Settings;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  initialized: false,
  settings: DEFAULT_SETTINGS,

  loadSettings: async () => {
    const data = await storage.read<PersistedSettings>('settings') ?? DEFAULT_SETTINGS;
    set({ settings: data, initialized: true });
  },

  updateSettings: async (patch) => {
    if (!get().initialized) return;  // Guard
    const updated = { ...get().settings, ...patch };
    set({ settings: updated });
    await storage.write<PersistedSettings>('settings', updated);
  },
}));
```

**src/main.tsx** — bootstrap storage before React renders, pass FSA prompt state to App:
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { bootstrapStorage, type BootstrapResult } from '@/lib/storage/storage';
import { useAccountStore } from '@/stores/accountStore';
import { useAllocationStore } from '@/stores/allocationStore';
import { useSettingsStore } from '@/stores/settingsStore';

async function init() {
  const bootstrapResult: BootstrapResult = await bootstrapStorage();

  // Load all stores from storage in parallel before rendering
  await Promise.all([
    useAccountStore.getState().loadAccounts(),
    useAllocationStore.getState().loadHistory(),
    useSettingsStore.getState().loadSettings(),
  ]);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App needsFsaPrompt={bootstrapResult.needsFsaPrompt} storageMode={bootstrapResult.mode} />
    </StrictMode>,
  );
}

init().catch(console.error);
```

**src/App.tsx** — display storage mode status and FSA prompt button if needed:
```typescript
import { fsaDriver, bootstrapStorage } from '@/lib/storage/storage';
import { useAccountStore } from '@/stores/accountStore';
import { useAllocationStore } from '@/stores/allocationStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface AppProps {
  needsFsaPrompt: boolean;
  storageMode: 'fsa' | 'idb';
}

export default function App({ needsFsaPrompt, storageMode }: AppProps) {
  const accounts = useAccountStore(s => s.accounts);

  const handleGrantAccess = async () => {
    if (!fsaDriver) return;
    await fsaDriver.requestPermission();
    // Re-load stores now that FSA is active
    await Promise.all([
      useAccountStore.getState().loadAccounts(),
      useAllocationStore.getState().loadHistory(),
      useSettingsStore.getState().loadSettings(),
    ]);
    // Force re-render — simple approach for Phase 1
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-2xl font-semibold mb-4">Money Flow</h1>

      <p className="text-sm text-muted-foreground mb-4">
        Storage: {storageMode === 'fsa' ? 'File System (FSA)' : 'Browser (IndexedDB)'}
        {storageMode === 'idb' && ' — your data is browser-local'}
      </p>

      {needsFsaPrompt && (
        <button
          onClick={handleGrantAccess}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm mb-4"
        >
          Grant access to your data folder
        </button>
      )}

      <p className="text-sm text-muted-foreground">
        Accounts loaded: {accounts.length}
      </p>
    </div>
  );
}
```

After writing all files, verify the build:
```
cd /root/money-flow && npm run build 2>&1 | tail -20
```
Fix any type errors. If Zustand import issues occur, verify zustand is installed: `npm ls zustand`.
  </action>
  <verify>
    <automated>cd /root/money-flow && npm run build 2>&1 | tail -10</automated>
  </verify>
  <done>
`npm run build` exits 0 with no errors. All three store files exist with `initialized: false` initial state and `if (!get().initialized) return` guards in all write-path actions. main.tsx calls bootstrapStorage() and all three loadXxx() before createRoot(). No Zustand persist middleware is imported anywhere. `npm test` still passes.
  </done>
</task>

</tasks>

<verification>
Run all verification commands:
```
cd /root/money-flow && npm run build && npm test
```

Manual checks:
1. grep -r "persist" src/stores/ — should find 0 results (no persist middleware)
2. grep -r "initialized" src/stores/ — should find the guard in every write-path action
3. grep -r "\* 100\|/ 100" src/ — should find 0 results (all cents math is in lib/cents.ts)
4. All five storage/type files exist: src/types/domain.ts, src/types/persistence.ts, src/lib/storage/storage.ts, src/lib/storage/fsaDriver.ts, src/lib/storage/idbDriver.ts
5. Three store files exist with initialized guard pattern
</verification>

<success_criteria>
1. `npm run build` exits 0 — persistence layer compiles cleanly
2. `npm test` still passes — cents tests still green after adding stores
3. FsaDriver.write() produces JSON files with 2-space indent (human-readable)
4. IdbDriver operates identically to FsaDriver from the caller's perspective
5. All three stores start with `initialized: false` and check it before writing
6. bootstrapStorage() never calls requestPermission() — only init() and isAvailable()
</success_criteria>

<output>
After completion, create `/root/money-flow/.planning/phases/01-foundation/01-03-SUMMARY.md` with:
- Storage driver implemented (FSA + IDB)
- Store list with initialized guard confirmed
- Build and test results
- Any issues encountered with FSA type definitions (FileSystemDirectoryHandle may need lib.dom.d.ts)
</output>
