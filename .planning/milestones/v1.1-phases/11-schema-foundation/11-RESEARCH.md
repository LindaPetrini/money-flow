# Phase 11: Schema Foundation - Research

**Researched:** 2026-02-28
**Domain:** TypeScript domain types, Zustand store patterns, read-time data migration
**Confidence:** HIGH

## Summary

Phase 11 is pure infrastructure — no UI, no user-visible changes, no new npm packages. Its entire scope is TypeScript type additions to existing files, a read-time migration function for old `AllocationRecord` data, one new `merchantStore.ts`, and wiring `merchantStore` + `applyTheme()` into the app startup sequence.

The codebase already provides all the patterns needed: the three existing stores (`accountStore`, `allocationStore`, `settingsStore`) each follow an identical Zustand pattern with `initialized` guard, `loadX()` from `storage.read`, and `updateX()` writing back to storage with a `NotAllowedError` guard. `merchantStore` must follow the exact same pattern. The `applyTheme()` side-effect is a `document.documentElement.classList` toggle that reads `localStorage` — it must be called both at load time (inside `loadSettings()`) and at update time (inside `updateSettings()`). `main.tsx` is the sole bootstrap entry point; adding `useMerchantStore.getState().loadMerchants()` to the `Promise.all` in `init()` is the only wiring needed.

The data migration for `AllocationRecord.source` is a map-over-array at load time inside `allocationStore.loadHistory()`: any record where `source` is `undefined` gets `source: ''` injected. This is a read-time-only migration — it does NOT write back to disk — which keeps it backward-compatible with older saved files and avoids any async write risk during startup.

**Primary recommendation:** Copy the existing store pattern exactly (accountStore is the cleanest template), add the three type fields in two files, write one migration map in `loadHistory()`, and add one `loadMerchants()` call to `main.tsx`. Total surface area is small and all patterns already exist in the codebase.

## Standard Stack

No new npm packages. This phase uses only what is already installed.

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 | Reactive store with `initialized` guard pattern | Already used by all 3 stores |
| typescript | ^5.9.3 | Type definitions for new domain fields | Project language |
| vite | ^7.3.1 | Build verification | `npm run build` is success criteria |
| vitest | ^3.2.4 | Test verification | `npm test` is success criteria |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb | ^8.0.3 | IndexedDB access via storage driver | `merchantStore` writes through `storage` singleton |

**Installation:** No new packages needed.

## Architecture Patterns

### Existing Project Structure (relevant parts)
```
src/
├── types/
│   ├── domain.ts          # Add: AllocationRecord.source, Settings.theme, MerchantEntry
│   └── persistence.ts     # Add: PersistedMerchants type alias
├── stores/
│   ├── accountStore.ts    # Pattern template for merchantStore
│   ├── allocationStore.ts # Add: read-time migration in loadHistory()
│   ├── settingsStore.ts   # Add: applyTheme() side-effect
│   └── merchantStore.ts   # NEW: create from scratch
├── lib/
│   └── bootstrap.ts       # No changes needed (seedIfEmpty only)
└── main.tsx               # Add: loadMerchants() to Promise.all
```

### Pattern 1: Zustand Store with Initialized Guard (the project standard)

**What:** Every store has `initialized: boolean`, a `loadX()` that reads from storage then sets `initialized: true`, and an `updateX()` that guards with `if (!get().initialized) return` before writing.

**When to use:** Always. This is the only store pattern in the project. `merchantStore` MUST follow it.

**Example (from accountStore.ts — use as template):**
```typescript
// Source: /src/stores/accountStore.ts (existing, verified)
import { create } from 'zustand';
import { storage } from '@/lib/storage/storage';
import { reportPermissionLost } from '@/lib/storage/StorageErrorContext';
import type { MerchantEntry } from '@/types/domain';
import type { PersistedMerchants } from '@/types/persistence';

interface MerchantState {
  initialized: boolean;
  merchants: MerchantEntry[];
  loadMerchants: () => Promise<void>;
  upsertMerchant: (entry: MerchantEntry) => Promise<void>;
  lookupMerchant: (merchantName: string) => MerchantEntry | undefined;
}

export const useMerchantStore = create<MerchantState>()((set, get) => ({
  initialized: false,
  merchants: [],

  loadMerchants: async () => {
    const data = await storage.read<PersistedMerchants>('merchants') ?? [];
    set({ merchants: data, initialized: true });
  },

  upsertMerchant: async (entry) => {
    if (!get().initialized) return;  // Guard: never write before load
    const existing = get().merchants;
    const idx = existing.findIndex(m => m.merchantName === entry.merchantName);
    const updated = idx >= 0
      ? existing.map((m, i) => i === idx ? entry : m)
      : [...existing, entry];
    set({ merchants: updated });
    try {
      await storage.write<PersistedMerchants>('merchants', updated);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        reportPermissionLost();
        return;
      }
      throw e;
    }
  },

  lookupMerchant: (merchantName) => {
    return get().merchants.find(m => m.merchantName === merchantName);
  },
}));
```

### Pattern 2: Read-Time Migration (for AllocationRecord.source)

**What:** When `loadHistory()` reads old data that pre-dates a new optional field, map over the array and inject the default value for missing fields. Do NOT write back to disk.

**When to use:** When a new optional field must never be `undefined` at runtime, even for records that pre-date the field being added. The storage format on disk can remain as-is — the migration only affects the in-memory representation.

**Why read-time only (don't write):**
- No async write risk during app startup
- Backward compatible — old app versions can still read the file
- Zero risk of data loss from a write failure during migration

**Example:**
```typescript
// Source: /src/stores/allocationStore.ts (to be added)
loadHistory: async () => {
  const raw = await storage.read<PersistedHistory>('history') ?? [];
  // Read-time migration: inject source='' for pre-v1.1 records
  const data = raw.map(record => ({
    ...record,
    source: record.source ?? '',
  }));
  set({ history: data, initialized: true });
},
```

### Pattern 3: Side-Effect on Load + Update (for applyTheme)

**What:** A function with a DOM side-effect (`document.documentElement.classList`) that must fire both when data is first loaded from storage AND whenever the value is updated. Call it inside `loadSettings()` and inside `updateSettings()`.

**When to use:** For preferences that affect DOM state outside of React's render cycle (themes, font size, etc.).

**Example:**
```typescript
// Source: pattern derived from settingsStore.ts structure
function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
}

// Called in loadSettings(): applyTheme(data.theme ?? 'system')
// Called in updateSettings() after set(): applyTheme(get().settings.theme ?? 'system')
```

**Note:** The `?? 'system'` default handles old Settings objects that pre-date the `theme` field. This is the Settings equivalent of the AllocationRecord migration — no write-back needed.

### Pattern 4: Bootstrap Wiring (for merchantStore in main.tsx)

**What:** Add `useMerchantStore.getState().loadMerchants()` to the existing `Promise.all` in `init()` in `main.tsx`.

**Example:**
```typescript
// Source: /src/main.tsx (existing, to be modified)
import { useMerchantStore } from '@/stores/merchantStore';

// Inside init():
await Promise.all([
  useAccountStore.getState().loadAccounts(),
  useAllocationStore.getState().loadHistory(),
  useSettingsStore.getState().loadSettings(),
  useMerchantStore.getState().loadMerchants(),   // ADD
]);
```

### Anti-Patterns to Avoid

- **Write-back migration:** Do not write the migrated `history` array back to storage in `loadHistory()`. It creates async write risk during startup, can corrupt files if interrupted, and breaks backward compatibility. Read-time-only is correct.
- **Eager initialization:** Do not set `initialized: true` before `storage.read()` resolves. The guard `if (!get().initialized) return` only works if load is atomic — set both `data` and `initialized` in a single `set()` call.
- **Missing `??` default on `lookupMerchant`:** The return type should be `MerchantEntry | undefined`. Do not throw if not found — callers in Phase 13 will use the undefined check to decide whether to ask the AI.
- **Calling `applyTheme` outside the store:** All callers that update `Settings.theme` go through `updateSettings(patch)`. Centralizing `applyTheme()` inside the store means no component needs to call it directly.
- **Adding `merchants` to `seedIfEmpty()`:** The merchant store starts empty by design. Do NOT add a default seed for merchants — empty is correct initial state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Merchant lookup performance | Binary search, trie, Map index | Simple `Array.find()` | Merchant lists will be < 500 items; `find()` on 500-item array is < 1ms |
| Theme persistence | Custom localStorage wrapper | `localStorage.getItem/setItem` directly | Trivial string; no abstraction needed |
| Migration framework | Versioned migration runner | Inline `?? ''` in `map()` | One field, one default — no framework warranted |
| Store subscription for theme | React `useEffect` with subscription | Call `applyTheme()` in the store actions | DOM mutation outside React is simpler and avoids re-render coupling |

**Key insight:** Phase 11 is deliberately minimal. Any framework, abstraction, or "proper" solution for what are 1-line problems creates unnecessary complexity. The existing codebase patterns are the correct solution.

## Common Pitfalls

### Pitfall 1: TypeScript structural unsafety on PersistedHistory cast
**What goes wrong:** `storage.read<PersistedHistory>('history')` casts the raw JSON to `PersistedHistory = AllocationRecord[]` at compile time, but the raw JSON is actually `Array<AllocationRecord & { source?: undefined }>`. If Phase 12 code does `record.source.toLowerCase()` without checking for undefined, it crashes on old records.
**Why it happens:** TypeScript trusts the type cast; the actual file data predates the field.
**How to avoid:** The read-time migration in `loadHistory()` ensures every in-memory record has `source: string` (empty string, never undefined). The `??` operator in the map handles both `undefined` (old records) and `null` (hypothetically malformed data).
**Warning signs:** Any code that accesses `record.source` without a null-check before the migration is implemented.

### Pitfall 2: Settings.theme missing from DEFAULT_SETTINGS in settingsStore
**What goes wrong:** The local `DEFAULT_SETTINGS` constant inside `settingsStore.ts` is used when no settings are stored yet. If `theme` is not in it, `applyTheme(settings.theme ?? 'system')` will always fall to `'system'` on first run — which is correct behavior, but only because of the `??`. Missing it from `DEFAULT_SETTINGS` is technically fine but causes a type error in strict mode if `theme` is required.
**How to avoid:** Add `theme: 'system' as const` to the local `DEFAULT_SETTINGS` object. Since `Settings.theme` is optional (`?`), this is additive and backward compatible.

### Pitfall 3: `initialized` guard on `lookupMerchant`
**What goes wrong:** `lookupMerchant` is a synchronous lookup, not a write. Adding an `initialized` guard that returns `undefined` when not initialized is correct (no data yet), but callers must handle `undefined` gracefully.
**Why it happens:** During app startup, `lookupMerchant` could theoretically be called before `loadMerchants()` completes (e.g., if a component renders during the startup sequence). Since `main.tsx` awaits all loads before rendering, this is not a real risk in the current app, but the guard is still good defensive practice.
**How to avoid:** `lookupMerchant` returns `undefined` (same as "not found") — no guard needed. The `initialized` guard only belongs on write operations.

### Pitfall 4: Storage key collision for merchants
**What goes wrong:** Using a storage key that conflicts with existing keys (`'accounts'`, `'settings'`, `'history'`).
**How to avoid:** Use key `'merchants'`. Both `FsaDriver` (which uses `${key}.json` filenames) and `IdbDriver` (which uses the key directly) will create a separate `merchants.json` / IDB entry. Confirmed: no existing store uses the `'merchants'` key.

### Pitfall 5: `applyTheme` calling `window.matchMedia` in a non-browser environment
**What goes wrong:** Tests run in jsdom. `window.matchMedia` is not implemented in jsdom by default and returns `undefined`, causing a crash if `applyTheme` is called during unit tests.
**How to avoid:** Guard with `typeof window !== 'undefined' && window.matchMedia` OR mock `matchMedia` in test setup. The existing `src/test/setup.ts` only imports `@testing-library/jest-dom` — no matchMedia mock exists yet. Since Phase 11 has no UI tests, the simplest approach is to not call `applyTheme` in any file covered by unit tests. The stores are not tested directly (they depend on `storage` which is a browser API), so this is not an immediate risk for Phase 11.

## Code Examples

### domain.ts additions
```typescript
// Source: /src/types/domain.ts (to be modified)

// Add to AllocationRecord:
export interface AllocationRecord {
  id: string;
  date: string;
  invoiceAmountCents: number;
  invoiceCurrency: string;
  invoiceEurEquivalentCents: number;
  mode: 'stabilize' | 'distribute';
  moves: AllocationMove[];
  source?: string;  // ADD: client/project name; '' for pre-v1.1 records after migration
}

// Add to Settings:
export interface Settings {
  taxPct: number;
  taxAccountId: string;
  bufferAccountId: string;
  bufferTargetCents: number;
  overflowRatios: OverflowRatio[];
  floorItems: FloorItem[];
  theme?: 'light' | 'dark' | 'system';  // ADD: undefined treated as 'system'
}

// Add new types:
export interface MerchantEntry {
  merchantName: string;   // canonical name from CSV, used as lookup key
  bucketAccountId: string; // which account/bucket this merchant maps to
  context?: string;        // user-provided context note (optional)
}
```

### persistence.ts addition
```typescript
// Source: /src/types/persistence.ts (to be modified)
import type { Account, Settings, AllocationRecord, MerchantEntry } from './domain';

export type PersistedAccounts = Account[];
export type PersistedSettings = Settings;
export type PersistedHistory = AllocationRecord[];
export type PersistedMerchants = MerchantEntry[];  // ADD
```

### allocationStore.ts migration
```typescript
// Source: /src/stores/allocationStore.ts (loadHistory to be modified)
loadHistory: async () => {
  const raw = await storage.read<PersistedHistory>('history') ?? [];
  const data = raw.map(record => ({
    ...record,
    source: record.source ?? '',
  }));
  set({ history: data, initialized: true });
},
```

### settingsStore.ts applyTheme addition
```typescript
// Source: /src/stores/settingsStore.ts (to be modified)

// Helper function (module-level, not exported):
function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
}

// In loadSettings():
loadSettings: async () => {
  const data = await storage.read<PersistedSettings>('settings') ?? DEFAULT_SETTINGS;
  set({ settings: data, initialized: true });
  applyTheme(data.theme ?? 'system');  // side-effect after state is set
},

// In updateSettings():
updateSettings: async (patch) => {
  if (!get().initialized) return;
  const updated = { ...get().settings, ...patch };
  set({ settings: updated });
  if (patch.theme !== undefined) {
    applyTheme(updated.theme ?? 'system');  // side-effect only when theme changes
  }
  try {
    await storage.write<PersistedSettings>('settings', updated);
  } catch (e) {
    // ... existing error handling unchanged
  }
},
```

**Note on `applyTheme` in `updateSettings`:** Calling it for every `updateSettings` invocation (not just when `patch.theme` is present) is also acceptable — the `classList.toggle` is idempotent. The conditional `if (patch.theme !== undefined)` is a minor optimization but not required.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.0 `AllocationRecord` (no source) | v1.1 adds optional `source?: string` | Phase 11 | Enables Phase 12 invoice source field |
| v1.0 `Settings` (no theme) | v1.1 adds optional `theme?: 'light'\|'dark'\|'system'` | Phase 11 | Enables Phase 12 dark mode |
| No merchant store | `merchantStore.ts` with load/upsert/lookup | Phase 11 | Enables Phase 13 merchant memory |

**Deprecated/outdated:**
- Nothing deprecated. Phase 11 is purely additive to existing types.

## Open Questions

1. **`MerchantEntry.context` field shape**
   - What we know: The roadmap mentions "user-provided context" for uncertain transactions (AIAN-02). Phase 13 will add Q&A where the user types context for an ambiguous transaction.
   - What's unclear: Is `context` a single string per merchant, or a per-transaction note? The REQUIREMENTS.md says "User can provide context and assign a bucket for each uncertain transaction" — the merchant memory persists the assignment for future imports, but context may vary per import.
   - Recommendation: Keep `context?: string` as optional on `MerchantEntry` — a single most-recent context string is sufficient for Phase 13's pre-classification. Phase 13 research can refine if needed.

2. **`lookupMerchant` key normalization**
   - What we know: CSV merchant names may have inconsistent casing ("Amazon", "AMAZON", "amazon").
   - What's unclear: Whether normalization (lowercase) should be in `merchantStore` or in the caller (Phase 13's import logic).
   - Recommendation: Store `merchantName` as-is (no normalization) in Phase 11. Phase 13 research will determine if case-insensitive lookup is needed. Do not over-engineer the foundation layer.

## Validation Architecture

The config does not have `workflow.nyquist_validation` set (absent from config.json), so this section is included as a best-effort guide.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase 11 Behavior → Test Map

Phase 11 has no formal requirement IDs (pure infrastructure). The success criteria map to verifiable behaviors:

| Success Criterion | Behavior | Test Type | Notes |
|-------------------|----------|-----------|-------|
| SC-1: AllocationRecord.source migration | Old records (no source) get source='' on load | unit | Can be tested with a mock storage read returning [{...no source...}] |
| SC-2: Settings.theme + applyTheme | Theme applied on load and update | unit | Requires matchMedia mock in setup.ts |
| SC-3: MerchantEntry + PersistedMerchants types | TypeScript compilation | build | `npm run build` verifies; no runtime test needed |
| SC-4: merchantStore load/upsert/lookup + initialized guard | Store operations are correct | unit | Can be tested with mocked storage |
| SC-5: npm run build + npm test pass | Zero regressions | build + test | Run both commands |

### Wave 0 Gaps

The existing 5 test files (116 tests) cover only pure domain logic and CSV parsing — they do not test any stores directly. Phase 11 may add store unit tests or rely on TypeScript build verification alone.

- [ ] Optional: `src/stores/merchantStore.test.ts` — tests upsert/lookup logic and initialized guard
- [ ] Optional: `src/stores/allocationStore.migration.test.ts` — tests the read-time source migration

**Decision for planner:** Store tests require mocking `storage` and `reportPermissionLost`. Given the stores are thin wrappers over storage and the migration logic is a single `?? ''` expression, the planner may choose to verify via `npm run build` + manual smoke test rather than unit tests. Document the decision in the plan.

## Sources

### Primary (HIGH confidence)
- `/src/stores/accountStore.ts` — Zustand store pattern template (verified by reading)
- `/src/stores/allocationStore.ts` — Existing loadHistory pattern (verified by reading)
- `/src/stores/settingsStore.ts` — Settings store pattern with initialized guard (verified by reading)
- `/src/types/domain.ts` — Current domain types (verified by reading)
- `/src/types/persistence.ts` — Current persistence aliases (verified by reading)
- `/src/lib/bootstrap.ts` — seedIfEmpty scope (verified by reading)
- `/src/main.tsx` — Bootstrap sequence (verified by reading)
- `/src/lib/storage/storage.ts` — Storage driver interface and keys (verified by reading)
- `package.json` — Library versions (verified by reading)
- `vitest.config.ts` — Test framework config (verified by reading)

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 11 detail — Plan breakdown (11-01, 11-02 split)
- `.planning/STATE.md` Accumulated Context — Prior research decisions (merchantStore write guard, matchMedia selector)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all patterns directly observed in codebase
- Architecture: HIGH — patterns copied verbatim from existing stores; no speculation
- Pitfalls: HIGH — derived from direct code inspection of existing stores and type system
- Migration pattern: HIGH — `?? ''` in a map is well-established TypeScript/JS idiom

**Research date:** 2026-02-28
**Valid until:** 2026-04-28 (stable patterns — not time-sensitive)
