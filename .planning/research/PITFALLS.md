# Pitfalls Research

**Domain:** Adding v1.1 features to an existing Vite 7 + React 19 + Tailwind v4 + Zustand 5 + FSA/IDB local-first app
**Researched:** 2026-02-28
**Confidence:** HIGH (verified against existing codebase + official docs)

---

## Critical Pitfalls

### Pitfall 1: Tailwind v4 @custom-variant Selector Excludes the Root Element Itself

**What goes wrong:**
The existing `index.css` uses `@custom-variant dark (&:is(.dark *));`. Note the space before `*` — this selector matches only descendants of `.dark`, NOT the element that has `.dark` on it. If you add `.dark` to `<html>`, any utility on `<html>` itself (or `<body>` styled with `@apply bg-background`) will not be dark-themed on the root element.

The correct Tailwind v4 selector is `(&:where(.dark, .dark *))` which matches BOTH the `.dark` root AND all its descendants. The existing codebase was generated with the narrower `(&:is(.dark *))` form, so the `.dark` class on `<html>` will color the body correctly (because `body` is a child of `html`) — but any attempt to add `dark:` utilities to the `<html>` element or document root will silently not apply.

**Why it happens:**
Tailwind's generated shadcn config often uses the narrower form. Developers copy it without checking the selector semantics. The difference is invisible until you try to style the `<html>` or `<body>` element directly.

**How to avoid:**
Change line 5 of `src/index.css` from:
```css
@custom-variant dark (&:is(.dark *));
```
to:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
This is the canonical Tailwind v4 form confirmed in official docs. Do this as the first step of the dark mode phase before writing any dark: utilities.

**Warning signs:**
- `dark:bg-background` on `<html>` or `<body>` has no effect
- Body background flickers between light/dark because the CSS variable update hits the wrong element
- Hardcoded colors like `bg-amber-50` in IDB notice banner do not respond to `.dark` toggle

**Phase to address:** Phase implementing Dark Mode (first task: fix selector)

---

### Pitfall 2: Flash of Wrong Theme on Page Load (FOUC)

**What goes wrong:**
React renders client-side. If you persist dark mode preference in `localStorage` and restore it in a `useEffect` or component `useState` initializer, the HTML will render in light mode first (the default), then switch to dark after React hydrates — causing a visible flash.

This is especially bad because `App.tsx` wraps everything inside React; there is no SSR here, but the DOM paint still happens before the JS bundle executes.

**Why it happens:**
`localStorage` reads inside `useState(() => ...)` or `useEffect` happen after the initial render. The browser paints the initial HTML (no `.dark` class) before the JS corrects it.

**How to avoid:**
Inject an inline script directly in `index.html` `<head>`, before any React scripts. This runs synchronously before first paint:

```html
<!-- index.html <head> -->
<script>
  (function() {
    var theme = localStorage.getItem('money-flow-theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

The React dark mode hook then reads the already-set class rather than setting it during render. This is the only reliable prevention — there is no React-only fix.

**Warning signs:**
- White flash before dark background appears on page load
- Flash only happens on first load, not on React state updates
- Wrapping the toggle logic in `useLayoutEffect` still flashes (fires too late)

**Phase to address:** Dark Mode phase

---

### Pitfall 3: AllocationRecord Schema Change Silently Breaks Existing Persisted History

**What goes wrong:**
Adding an optional `source?: string` field to `AllocationRecord` in `src/types/domain.ts` is backward-compatible in TypeScript, but existing FSA JSON files (and IDB entries) contain records without that field. If any code path does `record.source.toLowerCase()` or similar without an undefined guard, it will throw at runtime on old records.

More subtly: the `PersistedHistory` type in `src/types/persistence.ts` is currently a direct alias for `AllocationRecord[]`. If you add the field to `AllocationRecord` without a migration read-transform, all old records will load as `{ source: undefined }`, not `{ source: null }` or `{ source: '' }`. These are different values in filter predicates.

**Why it happens:**
TypeScript's optional field (`source?: string`) allows `undefined`. But when you JSON-serialize and then deserialize a record that never had `source`, the field is simply absent — `record.source` returns `undefined`, not `''`. Filter code like `record.source === searchTerm` will behave correctly (falsy), but sort or display code like `record.source ?? 'Unknown'` requires the nullish coalescing to be present everywhere.

The real trap: if you add `source` to the form, save one new record, and test — it works. Then you check history and see old records look fine too. The bug only surfaces when you try to FILTER by source, because `undefined !== ''` and `undefined !== 'Client A'`.

**How to avoid:**
Apply a read-time migration in `allocationStore.ts` `loadHistory`:
```typescript
loadHistory: async () => {
  const raw = await storage.read<PersistedHistory>('history') ?? [];
  // Migrate: ensure source field exists on all records
  const migrated = raw.map(r => ({ source: '', ...r }));
  set({ history: migrated, initialized: true });
},
```
This is a pure read-time transform — it does NOT rewrite the file, so old records stay untouched on disk. New records written via `appendAllocation` will include `source` naturally.

Do NOT bump any version numbers or run a destructive migration. This is additive.

**Warning signs:**
- `record.source` is `undefined` for old records when you `console.log(history)`
- History filter by client returns zero results even when "all" is selected
- TypeScript does not catch this — `source?: string` is valid for both states

**Phase to address:** Invoice Source Tracking phase (add field + migration simultaneously)

---

### Pitfall 4: Multi-Turn AI Q&A Grows the Messages Array Without a Token Budget

**What goes wrong:**
The Anthropic Messages API is stateless — you send the full conversation history with every request. For the AI transaction Q&A flow (AI asks about uncertain transactions, user answers, repeat), each turn appends two messages (assistant question + user answer) to the array. After 20–30 turns on a large CSV, the token count balloons.

`claude-haiku-4-5-20251001` has a 200K token context window. A CSV with 500 transactions (~6,000 tokens of input data) + system prompt + 30 Q&A turns (~3,000 tokens) is well within limits. But the current `callAnthropicAPI` function sends ALL transactions as a flat string in the prompt. If a user imports 12 months of Wise data (potentially 1,500+ transactions), the initial prompt alone can hit 15,000–20,000 tokens. Add 30 turns and you approach 50,000 tokens — expensive, but not over the limit.

The actual risk is: the current code sets `max_tokens: 2048` (hardcoded). If the AI needs to ask about many transactions in one response (e.g., list 20 uncertain items), it will hit the output cap mid-response. The structured output (`output_config.format`) will then fail validation because the JSON is truncated.

**Why it happens:**
`max_tokens` was sized for the single-pass analysis (4 bucket suggestions). The multi-turn Q&A needs a higher output budget because the AI may produce a list of uncertain transactions, not just a structured JSON blob.

**How to avoid:**
- For the Q&A flow, use a separate `callAnthropicQA` function with `max_tokens: 8192` (not 2048)
- Implement a rolling window: if conversation exceeds N turns, drop the oldest Q&A pairs from the messages array while keeping the system prompt and transaction data
- Add token estimation (rough: 1 token ≈ 4 chars) before the call and warn if approaching 150K
- Do NOT reuse the structured output schema for conversational turns — use plain text for Q&A

**Warning signs:**
- API returns `stop_reason: "max_tokens"` instead of `"end_turn"`
- JSON parsing fails on the AI response with SyntaxError (truncated JSON)
- AI asks about fewer transactions than expected in a single turn

**Phase to address:** AI Transaction Q&A phase

---

### Pitfall 5: Merchant Memory Store Key Collides with Existing FSA JSON Files

**What goes wrong:**
The existing storage driver uses a simple `key + ".json"` naming scheme. Current keys are `accounts`, `settings`, `history`. Adding merchant memory as a new key `merchantMemory` creates `merchantMemory.json` in the user's chosen data folder.

The collision risk is not with existing files but with the **IDB driver**: the IDB driver (`money-flow-data` DB, version 1, `app-data` object store) uses the same key string as the lookup key. A new `merchantMemory` key will be written to IDB normally. However, if the user is in FSA mode and the new store initializes before FSA is ready (before `bootstrapStorage()` resolves), the first write will throw `FsaDriver: not initialized — no directory handle`.

The deeper pitfall: if `merchantMemoryStore` initializes and calls `storage.write('merchantMemory', {})` in its own `init()` without checking `initialized`, it will write an empty object to storage, overwriting any previously saved merchant memory from a prior session.

**Why it happens:**
All three existing stores (accountStore, allocationStore, settingsStore) guard writes with `if (!get().initialized) return`. A new store added without that guard will write empty state on mount, before the FSA load resolves. The storage driver singleton (`storage` in `storage.ts`) is set by `bootstrapStorage()` in `main.tsx` before React renders, but each store's `load*` action must be called explicitly and awaited in `bootstrap.ts`.

**How to avoid:**
```typescript
// merchantMemoryStore.ts — always include the initialized guard pattern
loadMerchantMemory: async () => {
  const data = await storage.read<MerchantMemory>('merchantMemory') ?? {};
  set({ memory: data, initialized: true });
},
saveMerchantMemory: async (key: string, bucket: string) => {
  if (!get().initialized) return;  // CRITICAL: guard every write
  const updated = { ...get().memory, [key]: bucket };
  set({ memory: updated });
  await storage.write('merchantMemory', updated);
},
```
Also add `loadMerchantMemory()` call to `bootstrap.ts` alongside the other store loads.

**Warning signs:**
- `merchantMemory.json` is always empty after reload
- Console shows "FsaDriver: not initialized" on first visit
- Other stores' data is unaffected (the new store silently overwrites only its own key)

**Phase to address:** Merchant Memory phase

---

### Pitfall 6: History Filter Re-renders on Every Keystroke Without Memoization

**What goes wrong:**
The current `HistoryPage.tsx` renders the full history array directly from Zustand. When history search/filter is added (date range, client name, amount), the filter function runs on every render. If a user has 200 allocation records and types a search term, each keystroke triggers a full array scan + JSX re-render of all visible records.

At 200 records this is imperceptible. But the pattern is: the search input triggers a `useState` update in `HistoryPage`, which re-renders the component, which re-runs the filter function, which also constructs new JSX for all filtered records. Without `useMemo`, the filter runs even when `history` hasn't changed (e.g., if a parent re-renders for unrelated reasons).

The secondary pitfall: if the filter state (search query, date range, client) is stored in Zustand instead of local component state, every keystroke writes to Zustand, which notifies all subscribers, which can cause cross-component re-renders.

**Why it happens:**
It is tempting to put filter state in the global store because "that's where other state lives." But filter state is ephemeral UI state — it should live in local `useState`. The Zustand selector for history (`s => s.history`) should use a stable reference, not a derived filtered value.

**How to avoid:**
```typescript
// HistoryPage.tsx
const history = useAllocationStore(s => s.history);
const [query, setQuery] = useState('');
const [dateFrom, setDateFrom] = useState('');
const [dateTo, setDateTo] = useState('');

const filtered = useMemo(() => {
  return history.filter(r => {
    if (query && !r.source?.toLowerCase().includes(query.toLowerCase())) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });
}, [history, query, dateFrom, dateTo]);
```
Keep filter state local. Use `useMemo` with correct dependencies. Do NOT store filter predicates in Zustand.

**Warning signs:**
- Typing in the search box feels laggy (unlikely at 200 records, but still wrong)
- React DevTools Profiler shows `HistoryPage` re-rendering on unrelated state changes
- `history` Zustand selector returns a new array reference on each render (selector is using inline `.filter()`)

**Phase to address:** History Search/Filter phase

---

### Pitfall 7: AI Floor Item Detection Prompt Conflicts with Q&A Prompt in the Same CSV Session

**What goes wrong:**
Both the Q&A feature and the floor item detection feature consume the same CSV transaction data. If both are implemented as separate `callAnthropicAPI`-style calls that run in the same settings session, the user will experience two separate Anthropic API calls on the same data. This is fine for correctness, but the UX becomes confusing: the AI asks Q&A questions, the user answers, THEN the AI runs floor item detection — which ignores the user's Q&A context.

The deeper problem: the floor item detection prompt should ideally use the Q&A session context (what the user said about "that subscription" or "those hotel charges"). If floor detection runs independently, it may flag the same transactions the user already clarified as uncertain.

**Why it happens:**
Designing the two AI features in separate phases without planning their interaction. The Q&A conversation enriches the transaction context; floor detection should benefit from that enrichment.

**How to avoid:**
Design the CSV AI flow as a two-pass pipeline within a single component flow:
1. Pass 1: Q&A (multi-turn, enriches transaction labels in-memory)
2. Pass 2: Floor item detection (runs after Q&A, uses the enriched labels as additional context)

Pass 2 should include the Q&A conversation summary in its system prompt: "The user has clarified the following transactions: [Q&A answers]."

If shipping both in the same milestone, architect the state so the Q&A component exposes `enrichedTransactions` or `clarifications` that the floor detection component can consume.

**Warning signs:**
- Floor detection flags transactions the user just labeled in Q&A as "that's my gym"
- Two separate loading spinners visible at the same time during CSV analysis
- User asked to review floor suggestions for items they explicitly dismissed in Q&A

**Phase to address:** AI Q&A phase (design the data handoff), AI Floor Detection phase (consume it)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `max_tokens: 2048` for all AI calls | Simple, already works for v1.0 | Multi-turn Q&A truncates responses mid-JSON | Never — split into per-use-case constants |
| Store filter state in Zustand | Consistent with other state | Cross-component re-renders on every keystroke | Never for ephemeral UI state |
| Skip read-time migration for `source` field | Simpler code | `undefined !== ''` breaks filter predicates | Never — migration is 2 lines |
| Use the same `callAnthropicAPI` function for Q&A | Less code | Wrong max_tokens, wrong output schema | Never — create a Q&A-specific function |
| Dark mode toggle in a `useEffect` without head script | Simpler React code | Visible FOUC on every page load | MVP only if FOUC is acceptable |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic API (multi-turn) | Sending only the latest message, expecting the API to remember context | Send the full `messages[]` array every call; API is stateless |
| Anthropic API (token limits) | Using `max_tokens: 2048` for Q&A responses | Use `max_tokens: 8192` for Q&A; 2048 is only for structured bucket analysis |
| Anthropic API (streaming errors) | Assuming a 200 response means success | A 200 response can be followed by an SSE error event; parse the stream and handle `error` event type |
| FSA storage (new keys) | Writing to a new key before `initialized: true` | Every store must guard all writes with `if (!get().initialized) return` |
| Tailwind v4 dark mode | Toggling `.dark` in a React `useEffect` | Apply class in an inline `<head>` script before React renders to prevent FOUC |
| IndexedDB (new store) | Creating a new `IdbDriver` database for merchant memory | Reuse existing `money-flow-data` DB via the `storage` singleton with a new key string |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unmoized history filter | Laggy search input, excessive renders | `useMemo` on filter result, local useState for filter params | 50+ records with complex filter |
| Full conversation history in every AI Q&A call | Slow subsequent turns, high token costs | Rolling window: keep system + last N turns | After ~15 Q&A exchanges |
| No transaction deduplication in Q&A | AI asked about same transaction twice in different sessions | Merchant memory lookup before Q&A: skip already-labeled transactions | Any multi-session usage |
| Re-rendering accordion rows on history page | Each expand/collapse re-filters the whole list | `expandedId` local state already correct; keep filter memoized | 100+ history records |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging AI conversation turns to console | API key exposure if included in any log; also leaks user financial data | Never `console.log` messages array; only log error status codes |
| Storing merchant memory in FSA folder as `merchantMemory.json` | Human-readable merchant labels visible to anyone with folder access | This is acceptable for a local-first app — no server means no leak beyond the local machine |
| Passing the full raw CSV text to a second AI call for floor detection | Large prompt = higher cost; no data leaves device anyway | Cost concern only; acceptable for local-first |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Q&A flow with no progress indicator | User sees no feedback while AI decides which transactions to ask about | Show "Analyzing transactions..." spinner before first AI response |
| Dark mode toggle in Settings (buried) | User expects it in header/nav, not Settings | Add toggle to the existing `<header>` in App.tsx |
| Floor item suggestions appear but form is elsewhere | User clicks "Add as floor item" but has to navigate to Settings > Floor Items manually | Pre-fill and navigate to the form inline, or open an inline form in the CSV section |
| History filter resets on tab navigation | User filters history, switches to Invoice, returns — filter is gone | This is acceptable (local state), but document as expected behavior |
| No "clear merchant memory" option | Mistakenly labeled transaction persists forever | Add a "Reset merchant labels" button in Settings > CSV section |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dark mode:** Toggle applies `.dark` to `<html>` — verify IDB notice banner (`bg-amber-50`) and mode badges (`bg-amber-100`, `bg-emerald-100`) also receive dark variants. Hardcoded color classes throughout the app will NOT automatically flip — they need explicit `dark:` variants.
- [ ] **Dark mode persistence:** Preference survives page reload — verify `localStorage.getItem('money-flow-theme')` is set and the head script applies the class before React renders.
- [ ] **Invoice source field:** Old records in history display correctly (empty source = no client shown, not "undefined") — verify read-time migration applied in `loadHistory`.
- [ ] **History filter:** Filtering by client name works for both old records (source = '') and new records (source = 'ClientName') — verify the filter predicate handles empty strings.
- [ ] **Merchant memory:** Labels survive page reload — verify `loadMerchantMemory()` is called in `bootstrap.ts` and is awaited before React renders stores.
- [ ] **Q&A flow:** After answering 10+ transactions, subsequent API calls still succeed — verify token budget is sufficient and the rolling window works.
- [ ] **Floor detection:** Suggestions do not duplicate active floor items — verify that the AI prompt includes the current floor items so it can deduplicate.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong @custom-variant selector (`&:is(.dark *)`) | LOW | Change one line in `index.css`, rebuild |
| FOUC in production | LOW | Add 5-line inline script to `index.html` `<head>` |
| Old history records with undefined source | LOW | Add 1-line read-time migration in `loadHistory` |
| New store overwrites empty data on init | MEDIUM | Restore from FSA JSON file (user-accessible), add initialized guard |
| Q&A truncated by max_tokens | LOW | Increase `max_tokens`, re-run the Q&A turn |
| Floor detection ignores Q&A context | MEDIUM | Refactor to pass Q&A summary to floor detection prompt |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong @custom-variant selector | Dark Mode phase (first commit) | `document.querySelector('html').classList.add('dark')` in console — confirm all cards flip |
| FOUC | Dark Mode phase (add head script to index.html) | Hard reload with dark preference set — no flash visible |
| AllocationRecord schema change | Invoice Source Tracking phase | Load history with 10 pre-v1.1 records — all display without errors; `source` is `''` not `undefined` |
| New store init race | Merchant Memory phase | Add console.assert that `initialized` is true before any write |
| History filter performance | History Search/Filter phase | React DevTools profiler — filter re-render only when `history` or filter params change |
| Q&A token budget | AI Transaction Q&A phase | Run 20-question Q&A session on 500-transaction CSV — verify no truncation |
| Floor detection / Q&A context conflict | AI Floor Detection phase | User labels "subscription" in Q&A — floor detection does not re-flag same merchant |

---

## Sources

- Tailwind CSS v4 dark mode official docs: https://tailwindcss.com/docs/dark-mode
- Tailwind v4 @custom-variant exact selector semantics (confirmed `:where(.dark, .dark *)` form)
- Anthropic API error reference: https://platform.claude.com/docs/en/api/errors
- Anthropic models overview (claude-haiku-4-5-20251001, 200K context, 64K output): https://platform.claude.com/docs/en/about-claude/models/overview
- Existing codebase inspection: `src/index.css` line 5, `src/types/domain.ts`, `src/stores/allocationStore.ts`, `src/lib/anthropicClient.ts`, `src/lib/storage/fsaDriver.ts`
- v1.0 PITFALLS.md (pitfalls 1–8 already addressed, this document covers v1.1 additions only)

---
*Pitfalls research for: Money Flow v1.1 — adding features to existing local-first React app*
*Researched: 2026-02-28*
