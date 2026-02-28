# Architecture Research

**Domain:** Browser-local personal finance app — v1.1 feature integration
**Researched:** 2026-02-28
**Confidence:** HIGH — based on direct inspection of all relevant source files

---

## Existing Architecture (v1.0 Baseline)

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          React UI Layer                                  │
│                                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │Dashboard │  │ InvoicePage  │  │ HistoryPage  │  │  SettingsPage   │ │
│  │AccountCard│  │ InvoiceForm  │  │              │  │  CsvAiSection   │ │
│  │ModeBadge │  │AllocationRes │  │              │  │  FloorItemsSec  │ │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│       │               │                 │                    │          │
├───────┴───────────────┴─────────────────┴────────────────────┴──────────┤
│                         Zustand Store Layer                              │
│                                                                          │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐    │
│  │ accountStore │  │  allocationStore  │  │    settingsStore       │    │
│  │  accounts[]  │  │   history[]       │  │    Settings object     │    │
│  └──────┬───────┘  └────────┬──────────┘  └───────────┬────────────┘   │
│         │                   │                          │                 │
├─────────┴───────────────────┴──────────────────────────┴────────────────┤
│                         Storage Abstraction                              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  storage.ts (StorageDriver interface: read/write)                │   │
│  │  ┌──────────────────────┐   ┌───────────────────────────────┐   │   │
│  │  │  fsaDriver.ts        │   │  idbDriver.ts                 │   │   │
│  │  │  FSA → JSON files    │   │  IndexedDB fallback           │   │   │
│  │  └──────────────────────┘   └───────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                      Domain Logic (Pure Functions)                       │
│                                                                          │
│  ┌────────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ allocationEngine   │  │ floorCalculator  │  │  modeDetection    │   │
│  └────────────────────┘  └──────────────────┘  └───────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                         External / Browser APIs                          │
│                                                                          │
│  ┌─────────────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  anthropicClient.ts  │  │  csvParser   │  │  localStorage       │   │
│  │  (direct browser    │  │  (PapaParse) │  │  (API key only)     │   │
│  │  fetch to Anthropic)│  └──────────────┘  └─────────────────────┘   │
│  └─────────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| `App.tsx` | Tab routing, FSA onboarding, permission-lost overlay | `src/App.tsx` |
| `Dashboard` | Account balance cards, mode badge | `src/features/dashboard/` |
| `InvoicePage` | Entry→result state machine, handleDone atomicity | `src/features/invoice/` |
| `InvoiceForm` | Amount/currency/EUR input, validation | `src/features/invoice/` |
| `AllocationResult` | Move card display, Done/Cancel buttons | `src/features/invoice/` |
| `HistoryPage` | Accordion list of AllocationRecords | `src/features/history/` |
| `SettingsPage` | Tab dispatcher for settings sub-sections | `src/features/settings/` |
| `CsvAiSection` | CSV upload, AI call, suggestion cards | `src/features/settings/` |
| `accountStore` | Account CRUD + balance updates + persistence | `src/stores/` |
| `allocationStore` | History append + load + persistence | `src/stores/` |
| `settingsStore` | Settings update + persistence | `src/stores/` |
| `anthropicClient` | Anthropic API fetch wrapper, structured JSON schema | `src/lib/` |
| `csvParser` | PapaParse wrapper, bank format detection | `src/lib/` |
| `storage.ts` | Driver selection, bootstrapStorage() | `src/lib/storage/` |

---

## v1.1 Feature Integration Map

### Feature 1: AI Transaction Q&A

**What it needs:** A conversational turn-taking loop within the CSV import flow where the AI identifies uncertain transactions and the user assigns each to a bucket.

**Integration point:** `CsvAiSection.tsx` — the `handleAnalyse` path gets extended.

**New flow:**
```
Upload CSV → Parse → merchantStore pre-classification (skip known merchants)
                   → First AI pass: detect uncertain transactions (new)
                   → Q&A loop: render one uncertain transaction at a time
                   → User types context + selects bucket → answer stored
                   → upsertMerchant() called after each answer
                   → Loop ends → existing callAnthropicAPI() enriched with Q&A context
                   → Suggestion cards shown (existing flow continues)
```

**Changes required:**
- `anthropicClient.ts` — add two new exported functions:
  - `callUncertainTransactionDetection(apiKey, transactions): Promise<UncertainTransaction[]>` — batch call to identify all ambiguous transactions at once (one API call, not one per transaction)
  - `callTransactionQA(apiKey, transactions, qaAnswers): Promise<AIAnalysisResult>` — main analysis call enriched with Q&A context (replaces or augments existing `callAnthropicAPI`)
- `CsvAiSection.tsx` — add Q&A state machine alongside existing analysis state:

```typescript
type QAPhase =
  | { step: 'idle' }
  | { step: 'detecting' }
  | { step: 'asking'; current: UncertainTransaction; remaining: UncertainTransaction[]; answers: QAAnswer[] }
  | { step: 'complete'; answers: QAAnswer[] };
```

- New types (add to `domain.ts` or a new `src/types/ai.ts`):
  - `UncertainTransaction` — `{ transaction: ParsedTransaction; reason: string }`
  - `QAAnswer` — `{ transaction: ParsedTransaction; userContext: string; bucket: BucketKey }`

- The Q&A answers are passed into the main analysis call to enrich bucket attribution

**No new store needed.** Q&A answers are ephemeral per-session. Only the merchant mappings (outcomes of the Q&A) are persisted via `merchantStore`.

**New component:** `TransactionQACard.tsx` inside `src/features/settings/` — renders the current uncertain transaction, a text input for user context, a bucket selector, and a Next button.

---

### Feature 2: Merchant Memory

**What it needs:** Persist `merchant → bucket` mappings across sessions so future CSV imports can pre-classify known merchants and skip Q&A for them.

**New store required:** `merchantStore.ts`

**Store shape:**
```typescript
// In src/types/domain.ts
export interface MerchantEntry {
  id: string;
  merchantPattern: string;  // normalised lowercase fragment of description
  bucket: BucketKey;
  lastSeen: string;         // ISO date — for potential future pruning
}

// In src/types/persistence.ts
export type PersistedMerchants = MerchantEntry[];
```

```typescript
// src/stores/merchantStore.ts
interface MerchantState {
  initialized: boolean;
  merchants: MerchantEntry[];
  loadMerchants: () => Promise<void>;
  upsertMerchant: (entry: Omit<MerchantEntry, 'id'>) => Promise<void>;
  getMerchantBucket: (description: string) => BucketKey | null;
}
```

**Persistence key:** `'merchants'` — new key. FSA creates `merchants.json`; IDB creates a `merchants` entry. No driver changes needed — the existing `StorageDriver` interface handles any string key.

**Integration points:**
- `CsvAiSection.tsx` — before Q&A loop, call `getMerchantBucket(t.description)` to pre-classify known transactions
- `CsvAiSection.tsx` — after each Q&A answer, call `upsertMerchant()`
- `App.tsx` / `bootstrap.ts` — call `merchantStore.getState().loadMerchants()` alongside other store loads at startup

**Merchant matching strategy:** Store normalised lowercase fragments (e.g. `"lidl"`, `"netflix"`) not full description strings. Match with `description.toLowerCase().includes(pattern)`. This handles bank descriptions with varying transaction IDs appended.

---

### Feature 3: AI Floor Item Detection

**What it needs:** A second AI pass on the parsed CSV to detect recurring expenses and suggest them as new floor items, with an "Add to floor items" flow that pre-fills the floor item form.

**Integration point:** `CsvAiSection.tsx` — a new collapsible section below the existing bucket analysis.

**New function in `anthropicClient.ts`:**
```typescript
export interface FloorItemSuggestion {
  name: string;
  amountCents: number;
  reasoning: string;
  frequency: 'monthly' | 'quarterly' | 'annual';
}

export async function callFloorItemDetection(
  apiKey: string,
  transactions: ParsedTransaction[],
): Promise<FloorItemSuggestion[]>
```

**UI flow:**
```
After main AI analysis completes
    ↓
"Detect Recurring Expenses" button appears
    ↓
callFloorItemDetection() → FloorItemSuggestion[]
    ↓
Suggestion list: each item has Accept/Skip button
    ↓
User accepts → pre-fills FloorItemsSection form
```

**Pre-fill handoff mechanism:** Lift `pendingFloorItem: FloorItemSuggestion | null` state to `SettingsPage`. Pass a setter callback down to `CsvAiSection` (producer) and the value down to `FloorItemsSection` (consumer). When `FloorItemsSection` receives a non-null `pendingFloorItem`, it populates the add-floor-item form fields automatically.

This is plain lifted state — no new store, no context, no event bus. `SettingsPage` is the natural coordination point since both sections are its direct children.

```typescript
// SettingsPage.tsx
const [pendingFloorItem, setPendingFloorItem] = useState<FloorItemSuggestion | null>(null);

<CsvAiSection onFloorItemSuggested={setPendingFloorItem} />
<FloorItemsSection pendingFloorItem={pendingFloorItem} onPendingConsumed={() => setPendingFloorItem(null)} />
```

---

### Feature 4: Invoice Source (client name)

**What it needs:** Optional `source?: string` field on the invoice form, propagated to `AllocationRecord` and displayed in history.

**Schema changes — `src/types/domain.ts`:**
```typescript
export interface AllocationRecord {
  id: string;
  date: string;
  invoiceAmountCents: number;
  invoiceCurrency: string;
  invoiceEurEquivalentCents: number;
  mode: 'stabilize' | 'distribute';
  moves: AllocationMove[];
  source?: string;           // NEW — optional client/project name
}
```

**Component changes:**
- `InvoiceForm.tsx` — add optional text input "From (client / project)", include `source?: string` in the `onSubmit` data object
- `InvoicePage.tsx` — thread `source` from form data into `AllocationRecord` construction inside `handleDone()`
- `HistoryPage.tsx` — render `record.source` in the collapsed row (next to date and mode badge) when present

**No store changes needed.** `allocationStore` persists `AllocationRecord[]` as-is — the optional field is transparent.

**Backward compatibility:** `source` is optional. Existing `history.json` files without the field deserialise cleanly. TypeScript optional prevents any runtime crash. No migration logic required.

---

### Feature 5: History Search/Filter

**What it needs:** Client-side filtering of `allocationStore.history` by date range, source (client name), and amount range.

**Integration point:** `HistoryPage.tsx` — add a filter panel above the accordion list, replace the raw `history` array with a `useMemo`-derived filtered list.

**No new store needed.** Filter state is ephemeral UI state (`useState` in `HistoryPage`).

**Filter state shape:**
```typescript
interface HistoryFilters {
  dateFrom: string;   // ISO date or '' (no filter)
  dateTo: string;     // ISO date or '' (no filter)
  source: string;     // substring match or ''
  minAmount: string;  // euro string or ''
  maxAmount: string;  // euro string or ''
}
```

**Derived list:**
```typescript
const filteredHistory = useMemo(() =>
  history.filter(record => {
    if (filters.dateFrom && record.date < filters.dateFrom) return false;
    if (filters.dateTo && record.date > filters.dateTo) return false;
    if (filters.source && !record.source?.toLowerCase().includes(
      filters.source.toLowerCase()
    )) return false;
    if (filters.minAmount) {
      const min = parseCents(filters.minAmount);
      if (record.invoiceEurEquivalentCents < min) return false;
    }
    if (filters.maxAmount) {
      const max = parseCents(filters.maxAmount);
      if (record.invoiceEurEquivalentCents > max) return false;
    }
    return true;
  }),
  [history, filters]
);
```

**New component:** `HistoryFilters.tsx` inside `src/features/history/` — a collapsible filter panel with date inputs and text/number fields. Controlled by `HistoryPage` state.

**Performance:** History is a small local array (realistically hundreds of records). `useMemo` is sufficient. No virtualisation, debouncing, or server-side pagination needed.

---

### Feature 6: Dark Mode

**What it needs:** A CSS class-based theme toggle persisted across sessions via `settingsStore`.

**Schema changes — `src/types/domain.ts`:**
```typescript
export interface Settings {
  taxPct: number;
  taxAccountId: string;
  bufferAccountId: string;
  bufferTargetCents: number;
  overflowRatios: OverflowRatio[];
  floorItems: FloorItem[];
  theme?: 'light' | 'dark' | 'system';   // NEW — optional for backward compat
}
```

**Tailwind v4 dark mode:** Tailwind v4 supports class-based dark mode via the `dark` variant, activated by the `dark` class on `<html>`. This is the same mechanism as Tailwind v3's `darkMode: 'class'` config. No Tailwind config changes needed — add/remove `dark` class on `document.documentElement`.

**Implementation pattern:**
```typescript
// A pure function (not a React effect):
function applyTheme(theme: 'light' | 'dark' | 'system') {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', useDark);
}
```

**Where to call it:**
- In `settingsStore.loadSettings()` — apply persisted theme immediately on startup (before first render completes avoids a flash)
- In `settingsStore.updateSettings()` — call `applyTheme()` as a side-effect when the `theme` field changes

**Store changes — `settingsStore.ts`:**
```typescript
const DEFAULT_SETTINGS: Settings = {
  taxPct: 37,
  taxAccountId: '',
  bufferAccountId: '',
  bufferTargetCents: 0,
  overflowRatios: [],
  floorItems: [],
  theme: 'system',   // NEW default
};

loadSettings: async () => {
  const data = await storage.read<PersistedSettings>('settings') ?? DEFAULT_SETTINGS;
  set({ settings: data, initialized: true });
  applyTheme(data.theme ?? 'system');   // NEW — apply on load
},

updateSettings: async (patch) => {
  // ... existing write logic ...
  if (patch.theme !== undefined) {
    applyTheme(patch.theme);   // NEW — apply on change
  }
},
```

**UI placement:** A theme toggle button in the `App.tsx` header (sun/moon icon alongside the "Money Flow" wordmark). Header placement is preferred over a settings page option — discoverability without navigation. Uses a simple 3-way cycle: `system → light → dark → system`.

**Backward compatibility:** `theme?: ...` is optional. Old `settings.json` files without the field default to `'system'` via `?? 'system'`. No migration needed.

---

## Store Summary: v1.1 Changes

| Store | Status | Changes |
|-------|--------|---------|
| `accountStore` | Unchanged | No changes needed |
| `allocationStore` | Unchanged | Schema change in `domain.ts`; store serialises/deserialises transparently |
| `settingsStore` | Modified | `Settings.theme` field + `applyTheme()` side-effect |
| `merchantStore` | New | `MerchantEntry[]` persisted under key `'merchants'` |

---

## Schema Summary: v1.1 Changes

| Type | Status | Change |
|------|--------|--------|
| `AllocationRecord` | Modified | Add `source?: string` (optional, backward compat) |
| `Settings` | Modified | Add `theme?: 'light' \| 'dark' \| 'system'` (optional, backward compat) |
| `MerchantEntry` | New | New type in `domain.ts` |
| `PersistedMerchants` | New | Add to `persistence.ts` |
| `UncertainTransaction` | New | Ephemeral — component state only, no persistence |
| `QAAnswer` | New | Ephemeral — component state only, no persistence |
| `FloorItemSuggestion` | New | Ephemeral — component state only, no persistence |

All changes to existing persisted types (`AllocationRecord`, `Settings`) use optional fields. No migration logic required. Old JSON files on disk deserialise without issue.

---

## Component Summary: New vs Modified

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TransactionQACard.tsx` | `src/features/settings/` | Renders one uncertain transaction + context input + bucket selector for Q&A loop |
| `HistoryFilters.tsx` | `src/features/history/` | Collapsible filter panel (date range, source, amount) |
| `merchantStore.ts` | `src/stores/` | Zustand store for merchant→bucket memory, persisted as `merchants` |

### Modified Components

| Component | What Changes |
|-----------|-------------|
| `anthropicClient.ts` | Add `callUncertainTransactionDetection()`, `callFloorItemDetection()`, extend `callAnthropicAPI()` to accept Q&A context; add JSON schemas for new response shapes |
| `CsvAiSection.tsx` | Add Q&A state machine, merchant pre-classification, floor item detection section, `onFloorItemSuggested` callback prop |
| `SettingsPage.tsx` | Lift `pendingFloorItem` state; pass setter to `CsvAiSection`, value + clear handler to `FloorItemsSection` |
| `FloorItemsSection.tsx` | Accept `pendingFloorItem` prop to pre-fill add-floor-item form |
| `InvoiceForm.tsx` | Add optional "From (client / project)" text input; include `source?` in `onSubmit` data |
| `InvoicePage.tsx` | Thread `source` from form data into `AllocationRecord` construction |
| `HistoryPage.tsx` | Add `HistoryFilters` component, `useMemo` derived filtered list, render `record.source` in collapsed row |
| `settingsStore.ts` | `applyTheme()` side-effect on `loadSettings` and `updateSettings`; `DEFAULT_SETTINGS.theme = 'system'` |
| `App.tsx` | Theme toggle button in header; call `merchantStore.getState().loadMerchants()` at startup |
| `domain.ts` | Add `source?` to `AllocationRecord`; add `theme?` to `Settings`; add `MerchantEntry` type |
| `persistence.ts` | Add `PersistedMerchants = MerchantEntry[]` type alias |

---

## Data Flow: New Flows

### CSV Import → AI Q&A → Merchant Memory

```
User uploads CSV
    ↓
csvParser → ParsedTransaction[]
    ↓
merchantStore.getMerchantBucket(t.description) for each transaction
    ↓ (pre-classified transactions skip Q&A)
Unknown transactions → callUncertainTransactionDetection() → UncertainTransaction[]
    ↓
Q&A loop (component state in CsvAiSection):
  TransactionQACard renders current UncertainTransaction
  User types context + selects bucket → QAAnswer
      ↓
  merchantStore.upsertMerchant({ merchantPattern, bucket }) — persisted immediately
  Move to next in remaining[]
    ↓ (loop ends when remaining is empty)
callAnthropicAPI(key, transactions, qaAnswers) — enriched prompt
    ↓
AIAnalysisResult → suggestion cards (existing flow)
```

### CSV → Floor Item Detection → Settings Pre-fill

```
After main AI analysis (or triggered separately)
    ↓
"Detect Recurring Expenses" button in CsvAiSection
    ↓
callFloorItemDetection(apiKey, transactions) → FloorItemSuggestion[]
    ↓
CsvAiSection renders suggestion list
User clicks "Add as floor item" on one suggestion
    ↓
onFloorItemSuggested(suggestion) prop callback → SettingsPage.pendingFloorItem state
    ↓
FloorItemsSection receives pendingFloorItem prop → pre-fills add form
User adjusts values, clicks "Add" → settingsStore.updateSettings({ floorItems: [...] })
SettingsPage.onPendingConsumed() → clears pendingFloorItem
```

### Invoice → AllocationRecord with Source

```
InvoiceForm — user fills amount, currency, EUR equiv, optional "From" source
    ↓
onSubmit({ amountCents, currency, eurEquivalentCents, source? })
    ↓
InvoicePage.handleFormSubmit() — computeAllocation() unchanged
    ↓
handleDone() — AllocationRecord constructed:
  { id, date, invoiceAmountCents, invoiceCurrency, invoiceEurEquivalentCents,
    mode, moves, source: data.source }   // source is undefined if not entered
    ↓
appendAllocation(record) → allocationStore → storage.write('history', ...)
    ↓
HistoryPage — collapsed row shows source when record.source is truthy
```

### Dark Mode Apply

```
App startup:
  settingsStore.loadSettings()
      ↓
  applyTheme(data.theme ?? 'system')
  document.documentElement.classList.toggle('dark', useDark)
  Tailwind dark: variants activate/deactivate

User clicks theme toggle in App header:
  settingsStore.updateSettings({ theme: nextTheme })
      ↓
  applyTheme(nextTheme) side-effect fires
  Persisted to storage (existing write path)
```

---

## Recommended Build Order

Dependencies drive this order. Features are grouped by what they block.

### Phase 1: Foundation — schema and merchant store (no feature deps)

Build first because all other v1.1 features depend on these types existing.

- Add `source?: string` to `AllocationRecord` in `domain.ts`
- Add `theme?: 'light' | 'dark' | 'system'` to `Settings` in `domain.ts` + `DEFAULT_SETTINGS`
- Add `MerchantEntry` type to `domain.ts`
- Add `PersistedMerchants` to `persistence.ts`
- Create `merchantStore.ts` with full load/upsert/lookup implementation
- Wire `loadMerchants()` into app startup (`App.tsx` or `bootstrap.ts`)

**Tests:** Unit tests for `getMerchantBucket()` normalisation logic.

### Phase 2: Quick wins — independent features, no AI calls

These three features are independent of each other and of the AI work. Ship them before touching the more complex AI state machines.

**Invoice source:**
- Extend `InvoiceForm.tsx` with optional source input
- Thread `source` through `InvoicePage.handleDone()` into `AllocationRecord`
- Render `record.source` in `HistoryPage` collapsed rows

**Dark mode:**
- Add `applyTheme()` side-effect to `settingsStore`
- Add theme toggle button to `App.tsx` header

**History filter:**
- Create `HistoryFilters.tsx` component
- Wire into `HistoryPage` with `useMemo` filtered list

**Tests:** Test `parseCents` integration in amount filter logic. Visual test for dark class toggle.

### Phase 3: AI extensions — requires merchant store from Phase 1

The most complex state. Build last to keep Phase 2 features independently shippable.

- Extend `anthropicClient.ts`: `callUncertainTransactionDetection()`, `callFloorItemDetection()`, enrich existing `callAnthropicAPI()` with Q&A context parameter
- Create `TransactionQACard.tsx` component
- Extend `CsvAiSection.tsx`: Q&A state machine, merchant pre-classification before Q&A, floor item detection section
- Lift `pendingFloorItem` state to `SettingsPage.tsx`
- Extend `FloorItemsSection.tsx` with `pendingFloorItem` prop

**Tests:** Unit tests for merchant pattern normalisation. Mock Anthropic responses for Q&A flow tests.

### Dependency graph

```
Phase 1: domain.ts types → merchantStore
    ↓
Phase 2a: invoice source (needs AllocationRecord.source)
Phase 2b: dark mode (needs Settings.theme + applyTheme)
Phase 2c: history filter (needs AllocationRecord.source for source filter)
    ↓
Phase 3: AI Q&A (needs merchantStore + UncertainTransaction + QAAnswer types)
         floor item detection (needs FloorItemSuggestion type + SettingsPage pre-fill)
```

---

## Architectural Patterns

### Pattern 1: Optional fields for backward-compatible schema evolution

**What:** New fields added to persisted types are always optional (`field?: Type`). Defaults applied at read time with `?? defaultValue`.
**When to use:** Every time a field is added to `AllocationRecord`, `Settings`, or any other type serialised to FSA/IDB.
**Rationale:** Existing JSON files on disk will not have the new field. TypeScript optional + nullish coalescing handles this without migration code.

```typescript
// Good
const theme = settings.theme ?? 'system';

// Bad — crashes on old settings.json files
const theme = settings.theme;  // could be undefined at runtime
```

### Pattern 2: Ephemeral AI state in component; persist only outcomes

**What:** AI conversation state (Q&A answers, floor item suggestions, uncertain transactions) lives in `CsvAiSection` `useState`. Only final outcomes (merchant entries via `upsertMerchant`, accepted floor items via `updateSettings`) go into stores.
**Rationale:** AI session state doesn't survive page reload anyway — the API call must be repeated. Persisting intermediate state adds complexity with no user benefit.

### Pattern 3: Lift state to shared parent for cross-section communication

**What:** `SettingsPage` holds `pendingFloorItem` shared between `CsvAiSection` (producer) and `FloorItemsSection` (consumer). No store, no context, no event bus.
**When to use:** Two sibling components need to share ephemeral UI state. The parent is the natural owner.
**Rationale:** A Zustand store for a `FloorItemSuggestion | null` value is overkill. The parent (`SettingsPage`) is already the coordination point for all settings sub-sections.

### Pattern 4: Batch AI calls, not per-item AI calls

**What:** Detect all uncertain transactions in one `callUncertainTransactionDetection()` call. The Q&A loop is then pure UI — no additional API calls until the final enriched analysis.
**Rationale:** N uncertain transactions should not mean N+1 API calls. Batch detection is one call; user Q&A is free UI interaction; final analysis is one call. Total: 2 API calls per CSV session instead of N+1.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: AI intermediate state in Zustand stores

**What people do:** Put Q&A answers, floor item suggestions, or `UncertainTransaction[]` into a Zustand store.
**Why it's wrong:** This state is ephemeral per AI session. It does not need cross-component sharing or persistence. Stores add unnecessary persistence overhead and state that becomes stale across reloads.
**Do this instead:** Keep AI intermediate state in `CsvAiSection` component `useState`. Write final outcomes (merchant entries, accepted settings changes) to stores.

### Anti-Pattern 2: Required fields on persisted types

**What people do:** Add `theme: 'light' | 'dark'` (non-optional) to `Settings`.
**Why it's wrong:** Existing `settings.json` files on disk lack the field. TypeScript won't catch this at runtime — `settings.theme` is `undefined`, causing silent failures or crashes.
**Do this instead:** `theme?: 'light' | 'dark' | 'system'` with `DEFAULT_SETTINGS.theme = 'system'` and `data.theme ?? 'system'` at every read site.

### Anti-Pattern 3: One API call per Q&A turn

**What people do:** Call Anthropic for each uncertain transaction during the Q&A loop (to get a bucket suggestion per transaction).
**Why it's wrong:** 10 uncertain transactions = 10 API calls = 10× the cost and latency. Users notice delays between questions.
**Do this instead:** Batch-detect uncertain transactions once. Q&A loop is pure UI. Final enriched analysis is one more call. Total: 2 API calls regardless of how many uncertain transactions exist.

### Anti-Pattern 4: Exact string merchant matching

**What people do:** Store full bank description strings and match with `===`.
**Why it's wrong:** Bank descriptions include transaction IDs, branch codes, and date suffixes. "LIDL AMSTERDAM 20260228 123456" and "LIDL AMSTERDAM 20260301 789012" are the same merchant but won't match.
**Do this instead:** Normalise to lowercase, store a fragment (e.g. `"lidl amsterdam"`), match with `description.toLowerCase().includes(pattern)`. Trims at word boundary if needed.

### Anti-Pattern 5: Theme toggle using React state instead of DOM class

**What people do:** Store `isDark` in React state, conditionally apply CSS classes in JSX.
**Why it's wrong:** Tailwind dark mode variants respond to the `dark` class on `<html>`, not on individual components. Trying to replicate this with React state requires threading a prop/context through the entire component tree.
**Do this instead:** `document.documentElement.classList.toggle('dark', useDark)` — one DOM mutation, Tailwind handles the rest. Persist the intent in `settingsStore` only.

---

## Integration Points: External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic API | Direct browser fetch (`anthropic-dangerous-direct-browser-access: true` header) | Existing pattern confirmed working in v1.0. Extend with new function signatures in `anthropicClient.ts`. |
| File System Access API | `fsaDriver.ts` reads/writes JSON per store key | New `merchants` key added automatically. No driver changes needed. |
| IndexedDB | `idbDriver.ts` stores by string key | Same — `merchants` key works with existing driver interface. |

## Integration Points: Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `CsvAiSection` → `merchantStore` | Direct store hook | `getMerchantBucket()` pre-classification; `upsertMerchant()` after each Q&A answer |
| `CsvAiSection` → `SettingsPage` | Prop callback `onFloorItemSuggested` | Producer → parent |
| `SettingsPage` → `FloorItemsSection` | Prop `pendingFloorItem` + `onPendingConsumed` | Parent → consumer |
| `settingsStore` → `<html>` DOM | `applyTheme()` side-effect | Called from `loadSettings` and `updateSettings`. Not a React effect — fires synchronously as part of the store action. |
| `InvoiceForm` → `InvoicePage` | Existing `onSubmit` prop extended with `source?: string` | Backward compat — `InvoicePage` passes `source` to `AllocationRecord` only when present |
| `App.tsx` → all stores | Calls `loadX()` on each store at startup | `loadMerchants()` added to startup sequence alongside existing `loadAccounts`, `loadSettings`, `loadHistory` |

---

## Current File Structure with v1.1 Additions Annotated

```
src/
├── App.tsx                          MODIFIED — theme toggle in header; loadMerchants() at startup
├── components/ui/                   Unchanged
├── domain/                          Unchanged — pure functions
│   ├── allocationEngine.ts
│   ├── floorCalculator.ts
│   └── modeDetection.ts
├── features/
│   ├── dashboard/                   Unchanged
│   ├── history/
│   │   ├── HistoryFilters.tsx       NEW — filter panel (date range, source, amount)
│   │   └── HistoryPage.tsx          MODIFIED — add HistoryFilters, useMemo filtered list, source in collapsed row
│   ├── invoice/
│   │   ├── InvoiceForm.tsx          MODIFIED — add optional source input
│   │   ├── InvoicePage.tsx          MODIFIED — thread source into AllocationRecord
│   │   └── AllocationResult.tsx     Unchanged
│   └── settings/
│       ├── CsvAiSection.tsx         MODIFIED — Q&A state machine, merchant pre-classification, floor item detection, onFloorItemSuggested prop
│       ├── FloorItemsSection.tsx    MODIFIED — accept pendingFloorItem prop, pre-fill form
│       ├── SettingsPage.tsx         MODIFIED — lift pendingFloorItem state
│       ├── TransactionQACard.tsx    NEW — renders one uncertain transaction for Q&A
│       └── (AccountsSection, OverflowRatiosSection, StorageSection, TaxBufferSection — all unchanged)
├── lib/
│   ├── anthropicClient.ts           MODIFIED — 2 new API functions + JSON schemas; enrich existing callAnthropicAPI
│   ├── storage/                     Unchanged
│   ├── csvParser.ts                 Unchanged
│   └── cents.ts                     Unchanged
├── stores/
│   ├── accountStore.ts              Unchanged
│   ├── allocationStore.ts           Unchanged
│   ├── merchantStore.ts             NEW — MerchantEntry persistence under key 'merchants'
│   └── settingsStore.ts             MODIFIED — applyTheme() side-effect on load/update; DEFAULT_SETTINGS.theme
└── types/
    ├── domain.ts                    MODIFIED — AllocationRecord.source, Settings.theme, new MerchantEntry type
    └── persistence.ts               MODIFIED — add PersistedMerchants type alias
```

---

## Sources

- Direct inspection of `/home/linda/projects/money-flow/src/` — HIGH confidence
- Files read: `domain.ts`, `persistence.ts`, all store files, `anthropicClient.ts`, `CsvAiSection.tsx`, `HistoryPage.tsx`, `InvoicePage.tsx`, `InvoiceForm.tsx`, `App.tsx`, `storage.ts`
- Tailwind v4 class-based dark mode: MEDIUM confidence — consistent with documented v4 dark mode variant behaviour; `document.documentElement.classList.toggle('dark', ...)` is the standard approach
- Anthropic direct browser fetch pattern: HIGH confidence — `anthropic-dangerous-direct-browser-access: true` confirmed working in v1.0 production build

---
*Architecture research for: Money Flow v1.1 — AI-Powered Insights feature integration*
*Researched: 2026-02-28*
