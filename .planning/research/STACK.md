# Stack Research

**Domain:** Local-first browser app — freelance budget allocator (v1.1 additions)
**Researched:** 2026-02-28
**Confidence:** HIGH (all findings verified against official docs and live codebase)

---

## Context: What This File Covers

v1.0 stack is locked and validated. This file documents ONLY the stack additions and
behavioral clarifications needed for v1.1 features:

1. Dark mode — Tailwind v4 class strategy, how it differs from v3
2. Merchant-to-bucket label persistence — storage approach using existing idb infrastructure
3. History search/filter — client-side filtering pattern, no additional library
4. AI transaction Q&A — streaming vs batch for conversational UX

Existing validated stack (do not re-research or change):
Vite 7 + React 19 + TypeScript + Tailwind v4.2.1 + shadcn/ui New York + Zustand 5 +
idb 8 + File System Access API + Vitest 4 + Anthropic direct browser API + Papa.parse

---

## v1.1 Stack Additions

### New Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| None required | — | — | All v1.1 features build on the existing stack |

**Zero new npm dependencies needed.** Every v1.1 feature is achievable with what is
already installed. Details follow per feature area.

---

## Feature Area 1: Dark Mode with Tailwind v4

### How v4 Dark Mode Differs from v3

**v3 approach (do not use):**
```js
// tailwind.config.js — does not exist in this project
module.exports = { darkMode: 'class' }
```

**v4 approach (CSS-first):**
```css
/* src/index.css */
@custom-variant dark (&:where(.dark, .dark *));
```

The `darkMode: 'class'` config key is gone in v4. Dark mode strategy is declared with
`@custom-variant dark` in CSS. The `@tailwindcss/vite` plugin picks it up automatically —
no JS config file changes needed.

### Current State in This Codebase

`src/index.css` already has:
```css
@custom-variant dark (&:is(.dark *));
```

This works but uses `:is()` instead of the official recommended `:where()`. The
difference is specificity: `:is()` inherits specificity from its most specific argument,
while `:where()` has zero specificity. For utility-first CSS `:where()` is preferred
to avoid specificity conflicts. The existing `:is(.dark *)` variant will work correctly
for dark mode — changing it to `:where(.dark, .dark *)` is low risk and matches the
official recommendation.

The `.dark` CSS class block is already defined in `src/index.css` (lines 85–117) with
OKLCH dark mode token values for all shadcn/ui components. No CSS changes are needed
to add dark mode — the styles are already there. The gap is the toggle mechanism.

### Implementation Pattern: Class Toggle + localStorage

Toggle the `.dark` class on `<html>`. Persist the preference in `localStorage` (not
FSA/idb — theme is device-local UI state, not financial data).

**Three-state logic (light / dark / system):**
```typescript
// lib/theme.ts — pure module, no React dependency
export type ThemePreference = 'light' | 'dark' | 'system';

export function applyTheme(pref: ThemePreference): void {
  const isDark =
    pref === 'dark' ||
    (pref === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export function getStoredTheme(): ThemePreference {
  return (localStorage.getItem('theme') as ThemePreference) ?? 'system';
}

export function setStoredTheme(pref: ThemePreference): void {
  localStorage.setItem('theme', pref);
  applyTheme(pref);
}
```

**No-flash initialization in `index.html` `<head>`:**
```html
<script>
  (function () {
    var pref = localStorage.getItem('theme') || 'system';
    var isDark =
      pref === 'dark' ||
      (pref === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  })();
</script>
```

This inline script runs synchronously before React hydrates, preventing flash of
wrong theme. Must be in `<head>` before any CSS loads.

**Zustand store addition** (no separate store needed — add to existing settingsStore
or create a tiny uiStore):
```typescript
// Option A: tiny dedicated uiStore (preferred — keeps theme orthogonal to financial settings)
interface UiState {
  theme: ThemePreference;
  setTheme: (pref: ThemePreference) => void;
}

const useUiStore = create<UiState>()((set) => ({
  theme: getStoredTheme(),
  setTheme: (pref) => {
    setStoredTheme(pref);  // writes localStorage + updates <html> class
    set({ theme: pref });
  },
}));
```

**Why localStorage, not FSA/idb?**
Theme is device-local UI preference, not financial data. It should survive independently
of the FSA directory picker workflow. localStorage is appropriate for UI preferences
and avoids the async complexity of idb reads before first render (which causes flash
of wrong theme). The no-flash `<head>` script already reads from localStorage directly.

### shadcn/ui dark: variant usage

All shadcn/ui components already use `dark:` Tailwind variants internally. The `.dark`
class on `<html>` activates them. No component changes needed — adding `.dark` to
`<html>` is the only integration point.

---

## Feature Area 2: Merchant-to-Bucket Label Persistence

### What needs persisting

A map of merchant names/patterns to bucket IDs: `{ "Netflix": "fun", "AH": "everyday" }`.
This survives across CSV imports so the user is not re-asked about the same merchants.

### Recommended Approach: FSA JSON file (same pattern as all other app data)

Write a `labels.json` file using the existing `storage.write()` / `storage.read()`
interface. This is the correct approach because:

1. It follows the existing store pattern exactly (see `accountStore.ts`, `settingsStore.ts`)
2. It is included in FSA directory backups alongside financial data
3. No new library needed — `idb` + `storage.ts` already handle the persistence contract
4. Human-readable JSON in the user's chosen directory

```typescript
// types/domain.ts addition
export interface MerchantLabel {
  merchantPattern: string;   // exact match or lowercase normalized
  bucketId: string;          // matches FloorItem.id or overflow ratio key
  bucketName: string;        // human-readable, stored for display without lookup
  confirmedAt: string;       // ISO date — for debugging stale labels
}

// types/persistence.ts addition
export type PersistedMerchantLabels = MerchantLabel[];

// stores/merchantLabelStore.ts — follows exact pattern of accountStore.ts
const useMerchantLabelStore = create<MerchantLabelState>()((set, get) => ({
  initialized: false,
  labels: [],
  loadLabels: async () => {
    const data = await storage.read<PersistedMerchantLabels>('labels') ?? [];
    set({ labels: data, initialized: true });
  },
  addLabel: async (label: MerchantLabel) => {
    const updated = [...get().labels.filter(l =>
      l.merchantPattern !== label.merchantPattern), label];
    set({ labels: updated });
    await storage.write<PersistedMerchantLabels>('labels', updated);
  },
}));
```

**Why not a separate idb object store?**
The existing `IdbDriver` uses a single `app-data` object store with string keys. The
FSA driver writes named JSON files. Both work identically behind `storage.write('labels', data)`.
No schema migration, no new object store — just a new key. This is the established pattern.

**Why not localStorage?**
Labels are financial/operational data (merchant memory), not UI state. They belong with
the rest of the app's data in the FSA directory, not in browser storage that doesn't
travel with file exports.

**Merchant matching strategy (runtime, no library):**
```typescript
function findMatchingLabel(
  description: string,
  labels: MerchantLabel[]
): MerchantLabel | undefined {
  const normalized = description.toLowerCase();
  return labels.find(l => normalized.includes(l.merchantPattern.toLowerCase()));
}
```

Exact contains-match on normalized strings is sufficient for v1.1. Full fuzzy matching
(Fuse.js etc.) is not needed and would add a new dependency.

---

## Feature Area 3: History Search/Filter

### What needs filtering

`AllocationRecord[]` from `allocationStore.history`. Fields available for filtering:
- `date: string` (ISO date — range filter)
- `invoiceAmountCents: number` (amount filter)
- `invoiceCurrency: string`
- `mode: 'stabilize' | 'distribute'`
- `moves[].reason` (text search)
- `clientName?: string` (new field from v1.1 invoice source tracking)

### Recommended Pattern: useMemo filter in component, no library

```typescript
// In HistoryPage.tsx — add filter state + useMemo derived list
const [searchQuery, setSearchQuery] = useState('');
const [dateFrom, setDateFrom] = useState('');
const [dateTo, setDateTo] = useState('');

const filteredHistory = useMemo(() => {
  return history.filter(record => {
    if (dateFrom && record.date < dateFrom) return false;
    if (dateTo && record.date > dateTo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesClient = record.clientName?.toLowerCase().includes(q);
      const matchesMoves = record.moves.some(m => m.reason.toLowerCase().includes(q));
      if (!matchesClient && !matchesMoves) return false;
    }
    return true;
  });
}, [history, searchQuery, dateFrom, dateTo]);
```

**Why useMemo is correct here:**
- History list is bounded (personal app — hundreds of records, not millions)
- Filter is synchronous, no I/O, runs in <1ms for realistic data sizes
- React Compiler (enabled by default in React 19 with Vite + babel plugin) auto-memoizes
  this pattern — the explicit useMemo is insurance, not a performance critical decision
- No library (lunr, Fuse.js, minisearch) needed for simple substring + date-range filter

**Date input component:** Use shadcn/ui `Input` with `type="date"` — no date picker
library needed. Native `<input type="date">` provides adequate UX for a personal app
and avoids a 20–40kB calendar widget dependency.

**Amount filter (optional):** Filter by `invoiceAmountCents >= minAmount && <= maxAmount`
using parseCents() on user input — consistent with existing money math pattern.

### What NOT to add

| Avoid | Why |
|-------|-----|
| Fuse.js | Fuzzy search is overkill for a personal history log |
| lunr.js | Full-text indexing is overkill for <1000 records |
| TanStack Table | Virtualization and column sorting not needed for personal data volumes |
| react-datepicker | Native `<input type="date">` sufficient; avoids 30kB dependency |

---

## Feature Area 4: AI Transaction Q&A — Streaming vs Batch

### The UX requirement

The AI asks about uncertain transactions one at a time. User provides context + bucket
assignment. The conversation is a multi-turn exchange within a single CSV import session.
Labels are persisted after confirmation.

### Recommendation: Streaming for conversational turns, batch for initial analysis

**Initial CSV analysis (existing pattern):** Keep batch (non-streaming). The current
`callAnthropicAPI()` in `anthropicClient.ts` uses structured JSON output (`output_config`
with `json_schema`). Structured outputs are NOT compatible with streaming — the API
requires the full response to validate the JSON schema. Keep this as-is.

**Q&A conversational turns:** Use streaming (`stream: true`) with raw fetch and
`ReadableStream`. This gives the "AI is typing" feel that makes Q&A feel interactive
rather than making the user wait for a batched response.

### Streaming implementation pattern (raw fetch, no SDK)

The existing codebase uses raw `fetch` (not the `@anthropic-ai/sdk` npm package).
Continue this pattern — adding `@anthropic-ai/sdk` for streaming would add ~100kB and
introduce a new dependency.

```typescript
// lib/anthropicStreaming.ts
export async function* streamAnthropicMessage(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): AsyncGenerator<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',  // keep consistent with existing client
      max_tokens: 512,   // Q&A turns are short
      stream: true,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { type?: string } };
    throw new AnthropicAPIError(response.status, body?.error?.type ?? 'unknown_error');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const event = JSON.parse(data) as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          yield event.delta.text ?? '';
        }
      } catch {
        // malformed SSE line — skip
      }
    }
  }
}
```

**React consumption pattern:**
```typescript
// In the Q&A component
const [streamedText, setStreamedText] = useState('');
const [isStreaming, setIsStreaming] = useState(false);

async function askQuestion(question: string) {
  setIsStreaming(true);
  setStreamedText('');
  for await (const chunk of streamAnthropicMessage(apiKey, [...conversationHistory, { role: 'user', content: question }])) {
    setStreamedText(prev => prev + chunk);
  }
  setIsStreaming(false);
}
```

### Multi-turn conversation state management

The API is stateless — send the full conversation history on every turn.

```typescript
// Conversation state: kept in React component state, NOT persisted (session-only)
type ConversationMessage = { role: 'user' | 'assistant'; content: string };
const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
```

Conversation history lives in component state only — it is ephemeral within a single
CSV import session. Only the confirmed merchant→bucket labels are persisted (to `labels.json`
via `merchantLabelStore`). Do NOT persist conversation history to FSA or idb.

### When to use structured output (batch) vs streaming

| Use Case | Method | Why |
|----------|--------|-----|
| Initial CSV bucket-split analysis | Batch + `output_config.json_schema` | Structured JSON output requires batch; validates response shape |
| Floor item detection from CSV | Batch + `output_config.json_schema` | Same — structured output for pre-fill form data |
| Transaction Q&A conversational turns | Streaming + `stream: true` | Conversational UX; free-text responses don't need schema validation |
| Multi-turn refinement questions | Streaming + `stream: true` | Same |

**SSE event flow for streaming (verified against official docs):**
1. `message_start` — ignore for text extraction
2. `content_block_start` — ignore
3. `content_block_delta` with `delta.type === 'text_delta'` — extract `delta.text`, yield it
4. `content_block_stop` — ignore
5. `message_delta` — contains usage stats, ignore for text extraction
6. `message_stop` — end of stream

**Note on EventSource:** The browser `EventSource` API cannot be used for Anthropic
streaming because `EventSource` only supports GET requests. Use `fetch` + `ReadableStream`
as shown above.

---

## No-Change Decisions

These stack choices from v1.0 are explicitly confirmed unchanged for v1.1:

| Item | v1.0 Decision | v1.1 Status |
|------|--------------|-------------|
| Integer cents | All money as `number` (cents) | Unchanged — invoice "from" field is a string, no money math change |
| FSA + idb storage pattern | `storage.write()` / `storage.read()` | Unchanged — labels.json follows same pattern |
| Anthropic API key in localStorage | User-provided, stored in `localStorage` | Unchanged |
| Anthropic model | `claude-haiku-4-5-20251001` | Unchanged — use same model for Q&A turns |
| No React Router | State-driven view rendering | Unchanged |
| No TanStack Query | No server state | Unchanged |
| Papa.parse | CSV parsing | Unchanged |
| Zustand 5 `useShallow` for object selectors | Required in Zustand 5 | Unchanged |

---

## Installation

No new packages needed for v1.1. All four feature areas are achievable with the
existing dependency set.

```bash
# Verify: no new deps needed
# dark mode: @custom-variant already in index.css, localStorage built-in
# label persistence: storage.ts pattern, idb already installed
# history filter: useMemo, no library
# AI streaming: raw fetch, no SDK
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Raw fetch + ReadableStream for streaming | `@anthropic-ai/sdk` npm package | Adds ~100kB bundle; existing code uses raw fetch successfully; SDK has no browser-specific streaming advantage over the raw pattern |
| localStorage for theme preference | FSA/idb for theme preference | Theme is UI state, not financial data; idb reads are async and cause flash of wrong theme before React mounts; inline `<head>` script requires synchronous localStorage access |
| useMemo + Array.filter for history | Fuse.js / lunr / minisearch | Personal app data volumes (<1000 records); fuzzy search overhead not justified; adds 10–50kB |
| `storage.write('labels', ...)` via existing StorageDriver | New idb object store | Existing single-store pattern works; no schema migration needed; labels travel with other FSA data |
| `:where(.dark, .dark *)` selector | `:is(.dark *)` (current in codebase) | `:where()` has zero specificity per official docs recommendation; reduces risk of specificity conflicts with custom styles |
| Native `<input type="date">` for date filter | react-datepicker / shadcn Calendar | Calendar widget adds 20–40kB; native input sufficient for personal app; shadcn DatePicker is complex to wire for range selection |

---

## Version Compatibility Notes (v1.1 specific)

| Concern | Verdict | Notes |
|---------|---------|-------|
| Tailwind v4 `@custom-variant dark` + existing `.dark {}` block | Compatible | `.dark {}` in CSS works with both class strategies; no change needed |
| `stream: true` Anthropic API + `anthropic-dangerous-direct-browser-access` header | Verified compatible | CORS header applies to streaming requests identically to batch requests |
| `ReadableStream` browser support | High — all modern browsers | Chrome 43+, Firefox 65+, Safari 10.1+. App already requires Chrome (FSA), so no concern |
| `TextDecoder` with `{ stream: true }` option | Supported in all target browsers | Required for correct multi-byte UTF-8 handling in streaming; native browser API |

---

## Sources

- [Tailwind CSS v4 Dark Mode official docs](https://tailwindcss.com/docs/dark-mode) — `@custom-variant` syntax, `:where()` recommendation, three-state localStorage pattern **[HIGH confidence — official docs]**
- [Anthropic Messages Streaming API docs](https://platform.claude.com/docs/en/api/messages-streaming) — SSE event flow, `stream: true`, browser fetch pattern, EventSource limitation **[HIGH confidence — official docs]**
- [Anthropic Messages API reference](https://docs.anthropic.com/en/api/messages) — multi-turn messages array, API statefulness model **[HIGH confidence — official docs]**
- Codebase inspection `src/index.css` — confirmed `.dark {}` OKLCH token block already present, `@custom-variant dark (&:is(.dark *))` already declared **[HIGH confidence — direct read]**
- Codebase inspection `src/lib/storage/storage.ts`, `src/lib/storage/idbDriver.ts` — confirmed single-store pattern, `storage.write(key, data)` interface **[HIGH confidence — direct read]**
- Codebase inspection `src/lib/anthropicClient.ts` — confirmed raw fetch pattern, `output_config.json_schema` structured output, model `claude-haiku-4-5-20251001` **[HIGH confidence — direct read]**
- Codebase inspection `src/stores/allocationStore.ts`, `src/types/domain.ts` — confirmed `AllocationRecord` shape, history array structure for filter design **[HIGH confidence — direct read]**
- React `useMemo` official docs — memoized derived list pattern **[HIGH confidence — official docs]**

---

*Stack research for: Money Flow v1.1 — AI Q&A, label persistence, history filter, dark mode toggle*
*Researched: 2026-02-28*
