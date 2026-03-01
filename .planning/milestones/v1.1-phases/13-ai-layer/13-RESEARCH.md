# Phase 13: AI Layer - Research

**Researched:** 2026-03-01
**Domain:** Anthropic API structured outputs, React state machine extension, merchant memory persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API call budget:**
- The entire CSV session makes at most 2 Anthropic API calls
- Call 1 (combined): Classify all transactions — returns `uncertain_transactions[]` (for Q&A) + bucket ratio suggestions (replaces the existing standalone `callAnthropicAPI` bucket analysis)
- Call 2: Floor item detection — runs after Q&A answers are collected; receives clarification context so already-answered transactions are not re-flagged
- The existing `callAnthropicAPI` for bucket analysis is removed or superseded by the combined Call 1

**Q&A card presentation:**
- All uncertain transactions shown at once as a scrollable list of cards
- Consistent with the existing 4-bucket suggestion card pattern in `CsvAiSection`
- Each card shows: transaction description, date, amount, a context text input, and a bucket selector
- No wizard / one-at-a-time navigation needed

**Pre-classified merchant feedback:**
- When a merchant is already in `merchantStore` and skipped from Q&A, show a summary line: `"N merchants auto-classified from memory"` above the Q&A cards
- Transparent without being verbose — aligns with the app's transparency-first value
- No override affordance needed in this phase

**Floor item pre-fill UX:**
- When user accepts a floor item suggestion, scroll to `FloorItemsSection` and open the Add form with name, amount, and destination account pre-filled
- Reuses existing `FloorItemsSection` Add form; no duplicate inline form in `CsvAiSection`
- Mechanism: `SettingsPage` passes a `onFloorItemSuggested` callback that sets a pending floor item in a lifted-state slot; `FloorItemsSection` reads it, opens the form pre-filled, and clears the pending slot after save
- A brief visual highlight (e.g. ring or scroll-to) draws attention to the opened form

**Q&A → floor detection sequencing:**
- Q&A cards appear first; user answers them all (or skips)
- "Done with Q&A" triggers Call 2 (floor detection), passing answered-merchant names as context
- Floor item suggestions appear below the Q&A section once detected

### Claude's Discretion
- Exact prompt wording for the combined Call 1 and Call 2
- Loading/spinner states during each API call
- Error handling UX (retry button, error message placement)
- Number of uncertain transactions that triggers a "too many to classify" warning (if any)
- Exact scroll behavior and highlight animation for floor item pre-fill

### Deferred Ideas (OUT OF SCOPE)
- Editing or deleting merchant memory entries — separate settings sub-section, future phase
- Override of auto-classified merchants during import — would add complexity; note for future
- Multi-CSV session caching (avoiding re-classification on same file re-upload) — future optimization
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIAN-01 | After CSV import, AI identifies transactions it cannot confidently categorize | Call 1 combined schema: `uncertainTransactions[]` field; structured JSON output via `output_config.format` with `json_schema` type |
| AIAN-02 | User can provide context and assign a bucket for each uncertain transaction | Q&A card pattern (per CONTEXT.md): text input + bucket selector per card, consistent with existing suggestion card pattern in `CsvAiSection` |
| AIAN-03 | Merchant→bucket assignments persist across future imports | `useMerchantStore.upsertMerchant()` already persists to FSA/IndexedDB; no schema changes needed |
| AIAN-04 | Known merchants are pre-classified on future imports (skipping Q&A) | `useMerchantStore.lookupMerchant()` at start of handleAnalyse; exact-match on `merchantName` (case-sensitive per STATE.md Phase 11-02 decision) |
| AIAN-05 | AI detects recurring expenses from CSV and suggests them as floor items | Call 2 schema: `floorItemSuggestions[]` field; receives Q&A answers as context to avoid re-flagging clarified transactions |
| AIAN-06 | Confirming a floor item suggestion pre-fills the floor item form | Lifted state in `SettingsPage`: `pendingFloorItem` state slot + `onFloorItemSuggested` callback passed to `CsvAiSection`; `FloorItemsSection` reads `pendingFloorItem` prop, opens Add form pre-filled |
</phase_requirements>

---

## Summary

Phase 13 extends `CsvAiSection.tsx` with a three-phase AI state machine: (1) combined classification + Q&A, (2) merchant memory lookup + pre-classification, (3) floor item detection. The entire session budget is 2 Anthropic API calls, both using the existing `output_config.format` / `json_schema` structured output pattern already in `anthropicClient.ts`.

The Anthropic Structured Outputs API is generally available (GA) for `claude-haiku-4-5-20251001`, the model already used in this project. The existing `callAnthropicAPI` function is superseded by a new combined `callCombinedAnalysis()` function that returns `{ uncertainTransactions, bucketSuggestions }` in one call. A second function `callFloorDetection()` handles floor suggestion after Q&A completes.

The most complex integration point is the floor item pre-fill UX: lifting state from `FloorItemsSection` up through `SettingsPage` requires restructuring how `SettingsPage` renders its children — adding a `pendingFloorItem` state slot and passing an `onFloorItemSuggested` callback down to `CsvAiSection` and a `pendingFloorItem` prop down to `FloorItemsSection`.

**Primary recommendation:** Split work into 3 plans: (1) `anthropicClient.ts` extension with new schemas and functions + unit tests, (2) `CsvAiSection` state machine extension with Q&A cards and merchant memory, (3) floor detection + `SettingsPage` pre-fill wiring.

---

## Standard Stack

### Core (already installed — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Anthropic Messages API | REST via fetch | AI classification and floor detection | Already integrated; project uses raw fetch per CLAUDE.md constraint (zero new deps) |
| Zustand 5 | `^5.0.11` | `useMerchantStore` for merchant persistence | Already in use; `upsertMerchant` / `lookupMerchant` ready to use |
| React 19 | `^19.2.4` | State machine in `CsvAiSection`, lifted state in `SettingsPage` | Project stack |
| TypeScript | `^5.9.3` | Type-safe schemas for both API call response shapes | Project stack |

### No New Dependencies
The entire phase requires zero new npm packages. All capabilities (fetch, Zustand, React state, `parseCents`) are already installed.

**Installation:**
```bash
# No new packages to install
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── anthropicClient.ts     # Add callCombinedAnalysis() + callFloorDetection() + new schemas/types
├── features/settings/
│   ├── CsvAiSection.tsx       # Extend state machine: add Q&A phase + floor phase
│   ├── FloorItemsSection.tsx  # Add pendingFloorItem prop support
│   └── SettingsPage.tsx       # Lift pendingFloorItem state; pass callback + prop
```

### Pattern 1: Combined Call 1 JSON Schema

**What:** A single Anthropic API call returns both `uncertainTransactions[]` and `bucketSuggestions` (the existing 4-bucket analysis output).
**When to use:** At "Analyse with AI" click — replaces the existing `callAnthropicAPI` call.

```typescript
// Source: verified against Anthropic Structured Outputs docs (platform.claude.com)
// GA for claude-haiku-4-5-20251001 as of 2026

// New types in anthropicClient.ts
export interface UncertainTransaction {
  description: string;   // original CSV description
  date: string;          // ISO date
  amountEur: number;     // negative for expenses
  reason: string;        // why AI is uncertain (shown in Q&A card)
}

export interface CombinedAnalysisResult {
  uncertainTransactions: UncertainTransaction[];
  everydayEssentials: BucketSuggestion;
  funDiscretionary: BucketSuggestion;
  oneOffTravel: BucketSuggestion;
  recurringFixed: BucketSuggestion;
}

// JSON Schema (flat top-level object)
const UNCERTAIN_TRANSACTION_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    date: { type: 'string' },
    amountEur: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['description', 'date', 'amountEur', 'reason'],
  additionalProperties: false,
};

const COMBINED_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    uncertainTransactions: {
      type: 'array',
      items: UNCERTAIN_TRANSACTION_SCHEMA,
    },
    everydayEssentials: BUCKET_SCHEMA,
    funDiscretionary: BUCKET_SCHEMA,
    oneOffTravel: BUCKET_SCHEMA,
    recurringFixed: BUCKET_SCHEMA,
  },
  required: [
    'uncertainTransactions',
    'everydayEssentials',
    'funDiscretionary',
    'oneOffTravel',
    'recurringFixed',
  ],
  additionalProperties: false,
};
```

**JSON Schema limitation to respect:** `additionalProperties` must be `false` on every nested object. `minItems` only supports 0 or 1. `minimum`/`maximum` numerical constraints are NOT supported (use prompt instructions instead). Arrays of objects ARE supported.

### Pattern 2: Call 2 Floor Detection Schema

**What:** A separate Anthropic API call that receives the full transaction list plus Q&A answers as context and returns floor item suggestions.
**When to use:** After user clicks "Done with Q&A".

```typescript
// New types in anthropicClient.ts
export interface FloorItemSuggestion {
  name: string;               // suggested floor item name (e.g. "Rent")
  amountEur: number;          // detected recurring amount
  frequency: string;          // "monthly" | "quarterly" etc. — for prompt transparency
  confidence: string;         // "high" | "medium" — for display
  reason: string;             // why this looks like a floor item
}

export interface FloorDetectionResult {
  suggestions: FloorItemSuggestion[];
}

const FLOOR_ITEM_SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    amountEur: { type: 'number' },
    frequency: { type: 'string' },
    confidence: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['name', 'amountEur', 'frequency', 'confidence', 'reason'],
  additionalProperties: false,
};

const FLOOR_DETECTION_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: FLOOR_ITEM_SUGGESTION_SCHEMA,
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

// Function signature
export async function callFloorDetection(
  apiKey: string,
  transactions: ParsedTransaction[],
  clarifications: Array<{ merchantName: string; bucketAccountId: string; context?: string }>,
): Promise<FloorDetectionResult>
```

### Pattern 3: CsvAiSection State Machine Extension

**What:** Extend the existing `CsvAiSection` state machine from 2 phases (idle → analysing → results) to 5 phases covering Q&A and floor detection.
**When to use:** The existing component's state is flat; adding a phase discriminant prevents invalid UI states.

```typescript
// Extend CsvAiSection state machine
type CsvAiPhase =
  | 'idle'
  | 'analysing'           // Call 1 in flight
  | 'qa'                  // Q&A cards visible; user answering
  | 'detecting-floors'    // Call 2 in flight (after "Done with Q&A")
  | 'floor-suggestions'   // Floor cards visible; user accepting/skipping
  | 'complete';           // All done

// Q&A card state per uncertain transaction
interface QACardState {
  transaction: UncertainTransaction;
  context: string;           // user input
  bucketAccountId: string;   // user selection
  answered: boolean;         // true when user picks a bucket
  skipped: boolean;          // true when user explicitly skips
}
```

### Pattern 4: Merchant Lookup Before Call 1

**What:** Before firing Call 1, look up each transaction's description in `merchantStore`. Known merchants are excluded from the `uncertainTransactions` list sent to AI.
**When to use:** In `handleAnalyse` before calling `callCombinedAnalysis`.

```typescript
// In handleAnalyse, before API call:
const merchants = useMerchantStore.getState().merchants;  // read outside render
const { known, unknown } = transactions.reduce(
  (acc, t) => {
    const match = useMerchantStore.getState().lookupMerchant(t.description);
    if (match) acc.known.push({ transaction: t, merchant: match });
    else acc.unknown.push(t);
    return acc;
  },
  { known: [] as Array<{transaction: ParsedTransaction; merchant: MerchantEntry}>, unknown: [] as ParsedTransaction[] }
);
// Pass only `unknown` to callCombinedAnalysis
// Show "N merchants auto-classified from memory" summary when known.length > 0
```

**Case sensitivity:** Per STATE.md Phase 11-02 decision: `upsertMerchant` and `lookupMerchant` use exact case-sensitive matching on `merchantName`. The description from CSV is stored and looked up as-is. Phase 13 does not change this strategy.

### Pattern 5: Lifted Floor Item Pre-Fill State

**What:** `SettingsPage` holds a `pendingFloorItem` state slot. When the user accepts a floor suggestion in `CsvAiSection`, it calls `onFloorItemSuggested(draft)`, which sets `pendingFloorItem` in `SettingsPage`. `FloorItemsSection` receives `pendingFloorItem` as a prop, opens its Add form pre-filled, and clears it after save.
**When to use:** Floor item acceptance in `CsvAiSection`.

```typescript
// In SettingsPage.tsx
type PendingFloorItem = {
  name: string;
  amountStr: string;      // EUR amount as string e.g. "850.00"
  destinationAccountId: string;
};

// Add to SettingsPage state:
const [pendingFloorItem, setPendingFloorItem] = useState<PendingFloorItem | null>(null);
const floorItemsSectionRef = useRef<HTMLDivElement>(null);

const handleFloorItemSuggested = (item: PendingFloorItem) => {
  setPendingFloorItem(item);
  setActiveSection('floor-items');  // switch to floor items tab
  // Scroll after tab switch (setTimeout or useEffect with dependency)
  setTimeout(() => floorItemsSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
};

// Pass to children:
// <CsvAiSection onFloorItemSuggested={handleFloorItemSuggested} />
// <FloorItemsSection pendingFloorItem={pendingFloorItem} onPendingFloorItemConsumed={() => setPendingFloorItem(null)} />
```

**FloorItemsSection change:** Add a `useEffect` that watches `pendingFloorItem`:
```typescript
// In FloorItemsSection.tsx
useEffect(() => {
  if (pendingFloorItem) {
    setNewItem({
      name: pendingFloorItem.name,
      amountStr: pendingFloorItem.amountStr,
      priorityStr: String((floorItems.length + 1)),  // next priority
      destinationAccountId: pendingFloorItem.destinationAccountId || accounts[0]?.id || '',
      expiryDate: '',
    });
    setShowAddForm(true);
    // highlight: ring on the form div for 2s
  }
}, [pendingFloorItem]);

// After handleAdd completes, call onPendingFloorItemConsumed()
```

### Pattern 6: Merchant Upsert After Q&A

**What:** After user completes Q&A for each uncertain transaction, call `upsertMerchant` to save the answer. This happens per-card as the user answers, or in a batch when "Done with Q&A" is clicked.
**When to use:** Q&A card "Done" / "Done with Q&A" action.

```typescript
// For each answered QA card:
await useMerchantStore.getState().upsertMerchant({
  merchantName: card.transaction.description,  // exact case from CSV
  bucketAccountId: card.bucketAccountId,
  context: card.context || undefined,
});
```

### Anti-Patterns to Avoid

- **Calling API per-transaction:** The 2-call budget is locked. Never call Anthropic once per transaction or once per uncertainty. Batch everything into Call 1, pass Q&A context into Call 2.
- **Using `minimum`/`maximum` in JSON Schema:** These numerical constraints cause 400 errors. Use prompt instructions instead (e.g. "amountEur is always negative, representing expense magnitude").
- **Calling `lookupMerchant` inside render:** Call it once in the handler before firing the API call, not on each render cycle.
- **Setting `newItem` in `FloorItemsSection` without clearing `pendingFloorItem`:** Will cause infinite `useEffect` re-trigger. Always call `onPendingFloorItemConsumed()` after consuming.
- **Storing `amountEur` from AI as cents directly:** Floor suggestion amounts from AI are EUR floats. Always convert via `parseCents(String(suggestion.amountEur))` before storing in `FloorItem.amountCents`.
- **Tab switching without scroll delay:** The `FloorItemsSection` is conditionally rendered; it doesn't exist in the DOM until the tab is active. Use `setTimeout(fn, 50)` or a `useEffect` with a ref to scroll after mount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation of API responses | Custom validator | `output_config.format` / `json_schema` (GA, already in use) | Anthropic guarantees schema compliance via constrained decoding |
| Merchant fuzzy matching | Levenshtein / soundex | Exact case-sensitive match via `lookupMerchant` (project decision) | Phase 11-02 decision is locked; Phase 13 does not change normalization strategy |
| Floor item amount parsing | `parseFloat(suggestion.amountEur)` cast to cents | `parseCents(String(suggestion.amountEur))` from `@/lib/cents` | Project rule: all money math via `parseCents`/`formatCents` throughout |
| Spinner component | Custom CSS animation | Existing SVG spinner pattern from `CsvAiSection` (`animate-spin`) | Already implemented in the component; copy the pattern |
| State persistence | Manual localStorage | `useMerchantStore.upsertMerchant()` | Already persists to FSA/IndexedDB via `storage.write` |

**Key insight:** The project has deliberately avoided any new npm dependencies for v1.1. Every problem in this phase has an in-project solution: `parseCents` for money, the existing spinner pattern for loading states, the existing `fetch` wrapper pattern for API calls, and the existing `useMerchantStore` for persistence.

---

## Common Pitfalls

### Pitfall 1: `additionalProperties` Missing on Nested Objects
**What goes wrong:** API returns 400 error with "schema validation failed" for nested object schemas that omit `additionalProperties: false`.
**Why it happens:** Anthropic's constrained decoding requires ALL objects in the schema to have `additionalProperties: false`, including nested ones (e.g., items within an array).
**How to avoid:** Every object schema literal in `COMBINED_ANALYSIS_SCHEMA` and `FLOOR_DETECTION_SCHEMA` must include `additionalProperties: false`, not just the top-level schema.
**Warning signs:** 400 error immediately on API call with mention of schema validation.

### Pitfall 2: Numerical Constraints in JSON Schema
**What goes wrong:** Using `minimum`, `maximum`, `minLength`, `maxLength` in the schema causes 400 errors. Official docs confirm these are NOT supported.
**Why it happens:** Constrained decoding can't enforce arbitrary numerical bounds at the token level — only types and structure.
**How to avoid:** Put constraints in prompt instructions: "amountEur is always a negative number representing an expense in EUR". Do not use JSON Schema numerical constraints.
**Warning signs:** 400 error mentioning unsupported constraint keywords.

### Pitfall 3: Stale `pendingFloorItem` in `FloorItemsSection`
**What goes wrong:** `useEffect` on `pendingFloorItem` fires repeatedly because `onPendingFloorItemConsumed` is not called after consuming, causing infinite re-render loops.
**Why it happens:** The prop changes on every render if parent doesn't clear it.
**How to avoid:** `onPendingFloorItemConsumed()` must be called inside the `useEffect` AFTER setting form state. Alternatively, use `useRef` to track whether the current pending item has been consumed.
**Warning signs:** Add form opens and immediately closes, or console shows excess re-renders.

### Pitfall 4: Merchant Lookup Case Mismatch
**What goes wrong:** "LIDL" in the CSV doesn't match "Lidl" saved from a previous Q&A session.
**Why it happens:** `lookupMerchant` does exact case-sensitive matching (STATE.md Phase 11-02 decision). CSV descriptions can vary in casing between bank exports.
**How to avoid:** This is a known limitation, documented in STATE.md. Do NOT add normalization in Phase 13 — it is out of scope. The prompt should use the description verbatim when constructing Q&A cards to match what the user will see saved.
**Warning signs:** Same merchant appearing in Q&A even after being saved — check exact case of stored `merchantName` vs CSV `description`.

### Pitfall 5: Scroll to `FloorItemsSection` Before It Mounts
**What goes wrong:** Calling `scrollIntoView` immediately after switching the tab to "floor-items" fails silently because the section's DOM node doesn't exist yet (it's conditionally rendered).
**Why it happens:** `SettingsPage` only renders the active section: `{activeSection === 'floor-items' && <FloorItemsSection ... />}`. The ref is null until the next render.
**How to avoid:** Use a `setTimeout(() => ref.current?.scrollIntoView(), 50)` after calling `setActiveSection`, or a `useEffect` inside `FloorItemsSection` that calls `scrollIntoView` when `pendingFloorItem` is truthy.
**Warning signs:** Scroll does nothing; ref is null in the handler.

### Pitfall 6: Token Budget for Large CSV Files
**What goes wrong:** A CSV with 500+ transactions may exhaust `max_tokens: 2048` set in the existing API call.
**Why it happens:** The combined prompt includes every transaction's date, description, and amount plus the schema, plus the Q&A context in Call 2.
**How to avoid:** Increase `max_tokens` to 4096 for Call 1 (covering up to ~300 transactions). For Call 2, pass only the Q&A answers as context strings, not the full transaction list again. If the list is very large (>200 transactions), consider truncating to the most recent 6 months — the existing `CsvAiSection` already warns about "6+ months for best results."
**Warning signs:** API error `{"type":"error","error":{"type":"overloaded_error"}}` or truncated JSON responses.

### Pitfall 7: `upsertMerchant` Guard Before `loadMerchants` Completes
**What goes wrong:** If the page is freshly loaded and merchant store hasn't finished initializing, `upsertMerchant` silently no-ops because of its `if (!get().initialized) return` guard.
**Why it happens:** `loadMerchants` is async and called in the startup `Promise.all` in `bootstrap.ts`.
**How to avoid:** The UI flow guarantees that `upsertMerchant` is called only after the user has gone through file upload and AI analysis — by which time `loadMerchants` has long since completed. No additional guard needed, but document this timing assumption in code comments.
**Warning signs:** Merchant answers disappear on the next import even though the user saved them.

---

## Code Examples

### Combined Analysis API Call

```typescript
// Source: anthropicClient.ts extension pattern (verified against existing code)
export async function callCombinedAnalysis(
  apiKey: string,
  transactions: ParsedTransaction[],
): Promise<CombinedAnalysisResult> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildCombinedAnalysisPrompt(transactions) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: COMBINED_ANALYSIS_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { type?: string } };
    throw new AnthropicAPIError(response.status, body?.error?.type ?? 'unknown_error');
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  return JSON.parse(data.content[0].text) as CombinedAnalysisResult;
}
```

### Floor Detection API Call with Q&A Context

```typescript
// Source: anthropicClient.ts extension pattern
export async function callFloorDetection(
  apiKey: string,
  transactions: ParsedTransaction[],
  clarifications: Array<{ merchantName: string; bucketAccountId: string; context?: string }>,
): Promise<FloorDetectionResult> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildFloorDetectionPrompt(transactions, clarifications) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: FLOOR_DETECTION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { type?: string } };
    throw new AnthropicAPIError(response.status, body?.error?.type ?? 'unknown_error');
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  return JSON.parse(data.content[0].text) as FloorDetectionResult;
}
```

### Floor Item Amount Conversion (EUR float → cents)

```typescript
// Source: project convention — parseCents for all money math (CLAUDE.md)
import { parseCents } from '@/lib/cents';

// AI returns amountEur: 850 (positive float, representing monthly amount)
// Convert to cents for FloorItemDraft.amountStr (which FloorItemsSection.handleAdd parses via parseCents):
const amountStr = String(Math.abs(suggestion.amountEur).toFixed(2));
// e.g. "850.00" — matches the amountStr format FloorItemsSection expects
```

### Merchant Lookup Before API Call

```typescript
// Source: useMerchantStore.ts — lookupMerchant, upsertMerchant
import { useMerchantStore } from '@/stores/merchantStore';

// In handleAnalyse (before API call):
const state = useMerchantStore.getState();
const autoClassified: Array<{ transaction: ParsedTransaction; merchant: MerchantEntry }> = [];
const toClassify: ParsedTransaction[] = [];

for (const t of transactions) {
  const match = state.lookupMerchant(t.description);  // exact case-sensitive match
  if (match) autoClassified.push({ transaction: t, merchant: match });
  else toClassify.push(t);
}
```

### SettingsPage Lifted State Wiring

```typescript
// Source: React 19 pattern — lifted state + callback props
// In SettingsPage.tsx

const [pendingFloorItem, setPendingFloorItem] = useState<PendingFloorItem | null>(null);
const floorSectionRef = useRef<HTMLDivElement>(null);

const handleFloorItemSuggested = useCallback((item: PendingFloorItem) => {
  setPendingFloorItem(item);
  setActiveSection('floor-items');
  // Delay scroll until after FloorItemsSection has mounted
  setTimeout(() => {
    floorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}, []);

// Render:
{activeSection === 'floor-items' && (
  <div ref={floorSectionRef}>
    <FloorItemsSection
      pendingFloorItem={pendingFloorItem}
      onPendingConsumed={() => setPendingFloorItem(null)}
    />
  </div>
)}
{activeSection === 'csv-ai' && (
  <CsvAiSection onFloorItemSuggested={handleFloorItemSuggested} />
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `output_format` parameter (beta) | `output_config.format` (GA) | 2025 GA release | Old header `structured-outputs-2025-11-13` deprecated; current code uses `output_config` already — no migration needed |
| Separate beta header required | No beta header needed | 2025 GA release | The existing code already uses GA format; no changes to headers needed |
| Retrying on JSON parse failure | Constrained decoding guarantees | GA for Haiku 4.5 | No retry logic needed for schema compliance |

**Current model:** `claude-haiku-4-5-20251001` — supports structured outputs (GA as of the Anthropic docs, confirmed for "Claude Haiku 4.5"). Haiku 4.5 is the correct tier for this task: cheap, fast, and sufficient for classification + floor detection.

**Deprecated:**
- `ANALYSIS_SCHEMA` exported from `anthropicClient.ts`: still needed for tests but `callAnthropicAPI` is superseded by `callCombinedAnalysis`. Keep the old function in a deprecated state or remove it after tests are migrated.

---

## Open Questions

1. **Max token budget for very large CSVs**
   - What we know: Current `max_tokens: 2048` is fine for typical 3-6 month CSV (~50-150 transactions). Combined prompt is larger (transactions + schema overhead).
   - What's unclear: Exact token count per transaction for `claude-haiku-4-5-20251001`.
   - Recommendation: Set `max_tokens: 4096` for Call 1. If tests reveal truncation, add a warning in the prompt: "If there are more than 200 transactions, prioritize the most recent 6 months."

2. **Floor item destination account selection**
   - What we know: `FloorItemSuggestion` returns `name` and `amountEur`. There's no account information in the AI response — the AI doesn't know account IDs.
   - What's unclear: Should the pre-fill use `accounts[0]` as default, or leave destinationAccountId blank?
   - Recommendation: Pre-fill with `accounts[0]?.id ?? ''` — same default as `EMPTY_DRAFT` in `FloorItemsSection`. User reviews and can change before saving.

3. **`callAnthropicAPI` deprecation path**
   - What we know: Existing function is tested in unit tests (implied by existing test files in `src/lib/`). No test file for `anthropicClient.ts` was found in the glob scan.
   - What's unclear: Whether to delete `callAnthropicAPI` or leave it in place.
   - Recommendation: Mark it as deprecated with a JSDoc comment in Plan 1, delete it in Plan 3 after all references are migrated. Keep `ANALYSIS_SCHEMA` export (still useful as reference for the bucket fields in the combined schema).

---

## Sources

### Primary (HIGH confidence)
- Anthropic Structured Outputs docs (platform.claude.com/docs/en/build-with-claude/structured-outputs) — GA status for Haiku 4.5, `output_config.format` / `json_schema` API shape, JSON Schema limitations
- Existing `src/lib/anthropicClient.ts` — current fetch pattern, model name, headers, response parsing
- Existing `src/stores/merchantStore.ts` — `upsertMerchant`, `lookupMerchant`, `MerchantEntry` type
- Existing `src/features/settings/CsvAiSection.tsx` — state machine, card pattern, suggestion state
- Existing `src/features/settings/FloorItemsSection.tsx` — `showAddForm`, `newItem`, `handleAdd`, `FloorItemDraft`
- Existing `src/features/settings/SettingsPage.tsx` — tab/section rendering, conditional mount pattern
- Existing `src/types/domain.ts` — `MerchantEntry`, `FloorItem`, `FloorItemDraft`
- `.planning/phases/13-ai-layer/13-CONTEXT.md` — locked decisions, code insights, specifics
- `.planning/STATE.md` — Phase 11-02 case-sensitivity decision, merchant store write guard note

### Secondary (MEDIUM confidence)
- WebSearch: Anthropic Structured Outputs GA announcement (November 2025) — confirms Haiku 4.5 supported

### Tertiary (LOW confidence)
- None — all claims are verified against official docs or existing project code.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing code confirmed, no new deps, GA API verified
- Architecture: HIGH — patterns derived directly from existing code; CONTEXT.md decisions are locked
- Pitfalls: HIGH — JSON Schema limitations verified against official Anthropic docs; state management pitfalls derived from existing component code analysis

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (Anthropic API is stable; structured outputs are GA — 30 days is appropriate)
