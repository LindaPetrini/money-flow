# Phase 12: Quick Wins - Research

**Researched:** 2026-02-28
**Domain:** Dark mode toggle + FOUC prevention, invoice source field, history filtering
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| THEME-01 | User can toggle between light, dark, and system preference | `settingsStore.updateSettings({ theme })` + `applyTheme()` already wired; header toggle UI is the only gap |
| THEME-02 | Theme preference persists across sessions (no flash on reload) | `settings.theme` already persisted via `storage.write('settings', ...)`; persistence is already correct |
| THEME-03 | Page loads in correct theme with no visible flash of wrong theme | Requires inline `<script>` in `index.html` `<head>` that reads localStorage and sets `.dark` class before React hydrates; `settingsStore.loadSettings()` runs *after* React renders — too late |
| INVSRC-01 | Optional "From" field (client/project name) on invoice entry | `InvoiceForm` gains optional `source` input; `onSubmit` prop extended with `source?: string` |
| INVSRC-02 | Client name displayed in allocation history log | `AllocationRecord.source` already typed (Phase 11); history row reads `record.source` |
| HIST-01 | Filter history by date range | `useMemo` + `Array.filter` on `record.date`; native `<input type="date">` for range inputs |
| HIST-02 | Search history by client/source name | `record.source.toLowerCase().includes(query.toLowerCase())`; no library needed |
| HIST-03 | Filter history by amount range | `record.invoiceAmountCents` comparison against parsed min/max cents |
</phase_requirements>

---

## Summary

Phase 12 implements three independent feature clusters — dark mode, invoice source, and history filters — none of which requires AI interaction or new npm packages. All three build on Phase 11's schema work: `Settings.theme` is already persisted, `AllocationRecord.source` is already typed with migration, and `merchantStore` is already wired into startup.

The most technically precise requirement is THEME-03 (no FOUC). React-managed state cannot solve this: `settingsStore.loadSettings()` fires after React renders, meaning the page briefly shows the wrong theme on every reload. The solution is a single inline `<script>` block in `index.html` `<head>` that reads `localStorage` synchronously and adds the `.dark` class before any CSS paint. This is the canonical FOUC prevention pattern documented by Tailwind v4 and matches the constraint already recorded in STATE.md.

History filtering (HIST-01/02/03) is pure `useMemo` + `Array.filter` — no external library. The data set is ~50–200 records; client-side filtering is instant. Filters live in a new `HistoryFilters.tsx` component that lifts its state to `HistoryPage.tsx` via props. The invoice source field (INVSRC-01/02) is a minimal extension: add an optional text input to `InvoiceForm`, thread `source` through `InvoicePage.handleDone()` into `AllocationRecord`, and render it in the collapsed history row.

**Primary recommendation:** Implement in three waves in dependency order: (1) FOUC inline script + CSS variant fix + theme toggle, (2) invoice source field + history display, (3) history filters panel.

---

## Standard Stack

### Core (unchanged from v1.0 — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19.2.4 | UI components | Already installed |
| Tailwind v4 | ^4.2.1 | Dark mode class strategy | `@custom-variant dark` + `.dark {}` already in `index.css` |
| Zustand 5 | ^5.0.11 | `settingsStore.updateSettings({ theme })` | Already used for theme persistence |
| shadcn/ui | installed | Input component for filters, buttons for toggle | Already installed |
| lucide-react | ^0.575.0 | Icons for theme toggle (Sun/Moon/Monitor) | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage | browser native | Theme preference read synchronously in FOUC script | ONLY in the inline `<head>` script; settingsStore owns the authoritative value |
| `useMemo` | React built-in | Memoize filtered history list | History page filter computation |
| native `<input type="date">` | browser native | Date range filter inputs | Avoids react-datepicker / shadcn Calendar complexity |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| native `<input type="date">` | shadcn Calendar + DatePicker | Calendar adds 20-40kB; native is sufficient for personal app with <200 records |
| inline `<head>` script for FOUC | React `useEffect` / settingsStore only | `useEffect` fires after render — cannot prevent FOUC. Not a viable alternative. |
| `useMemo` for filter | Fuse.js / minisearch | Overkill for <1000 records; adds 10-50kB; simple `includes()` is fine |
| Sun/Moon/Monitor icons | Custom SVG | lucide-react already installed |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended File Changes

```
src/
├── index.html                         MODIFIED — inline FOUC script in <head>
├── index.css                          MODIFIED — fix @custom-variant dark selector (optional, low risk)
├── App.tsx                            MODIFIED — theme toggle in header (Sun/Moon/Monitor icon button)
├── features/
│   ├── history/
│   │   ├── HistoryFilters.tsx         NEW — date range, source search, amount range inputs
│   │   └── HistoryPage.tsx            MODIFIED — HistoryFilters, useMemo filtered list, source in collapsed row
│   └── invoice/
│       ├── InvoiceForm.tsx            MODIFIED — add optional "From" source input field
│       └── InvoicePage.tsx            MODIFIED — thread source through handleFormSubmit + handleDone into record
└── stores/
    └── settingsStore.ts               No changes needed — applyTheme() already called on load and update
```

### Pattern 1: FOUC Prevention via Inline Head Script

**What:** A synchronous `<script>` in `<head>` (before any CSS link or module script) that reads the persisted theme from `localStorage` and immediately sets `.dark` on `<html>`. Runs before paint.

**Why localStorage and not FSA/idb:** FSA and idb reads are async. `<head>` inline scripts must be synchronous to prevent FOUC. `settingsStore.loadSettings()` reads from FSA/idb but fires after React renders — it is the authoritative source but cannot prevent the flash.

**Critical detail:** `settings` is persisted as a JSON object via `storage.write('settings', ...)`. In FSA mode it lands on disk as `settings.json`. However, neither FSA nor idb can be read synchronously in a `<head>` script. The FOUC script must use a **separate** `localStorage` key (e.g. `mf_theme`) as a fast mirror. `settingsStore.updateSettings({ theme })` must write to `localStorage` in addition to calling `applyTheme()`. On `loadSettings()`, also sync `localStorage` with the loaded theme value.

**Example:**
```html
<!-- index.html — inside <head>, before any stylesheet or module script -->
<script>
  (function() {
    try {
      var t = localStorage.getItem('mf_theme');
      if (t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
</script>
```

```typescript
// settingsStore.ts — extend applyTheme() to mirror to localStorage
function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia != null &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  // Mirror for FOUC script:
  try { localStorage.setItem('mf_theme', theme); } catch (e) {}
}
```

### Pattern 2: Theme Toggle in App Header

**What:** A cycle button (system → light → dark → system) or three-state picker in the header bar. Reads `settings.theme` from `useSettingsStore`, calls `updateSettings({ theme: next })`.

**Current header state:** `App.tsx` header only has `<span className="font-semibold text-sm">Money Flow</span>`. The toggle goes in the right side of the existing `flex items-center justify-between` header.

**Example:**
```typescript
// App.tsx — import useSettingsStore
const theme = useSettingsStore(s => s.settings.theme ?? 'system');
const updateSettings = useSettingsStore(s => s.updateSettings);

const nextTheme = (current: 'light' | 'dark' | 'system') => {
  const cycle = { system: 'light', light: 'dark', dark: 'system' } as const;
  return cycle[current];
};

// In header JSX:
<button
  onClick={() => void updateSettings({ theme: nextTheme(theme) })}
  aria-label={`Theme: ${theme}`}
>
  {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
</button>
```

### Pattern 3: Tailwind v4 Dark Mode Selector Fix

**What:** Change `@custom-variant dark (&:is(.dark *))` to `@custom-variant dark (&:where(.dark, .dark *))` in `index.css`.

**Why:** The `:is()` variant excludes the root element itself (only matches elements *inside* `.dark`, not the `.dark` element). `:where(.dark, .dark *)` matches both the `.dark` element and all its descendants, plus has zero specificity (`:where()` always has specificity 0). This is the Tailwind v4 official recommended pattern per STATE.md research note.

**Risk:** LOW. The `.dark {}` CSS block is already defined correctly and covers the `<html>` element directly via plain CSS class selector. The `@custom-variant` only affects Tailwind utility classes with `dark:` prefix. Changing it is a correctness improvement, not a breaking change.

### Pattern 4: Invoice Source Field

**What:** Optional text input added below existing InvoiceForm fields. Not validated (can be blank).

**Data flow:** `InvoiceForm.onSubmit` prop extended with `source?: string`. `InvoicePage.handleFormSubmit` stores it in local state (alongside `invoiceAmountCents` etc). `handleDone` includes it in the `AllocationRecord`:

```typescript
// InvoicePage.tsx — PageState extended
type PageState =
  | { phase: 'entry' }
  | {
      phase: 'result';
      result: AllocationResult;
      invoiceAmountCents: number;
      invoiceCurrency: string;
      invoiceEurEquivalentCents: number;
      source: string;  // ADD
    };

// In handleDone, the record construction:
const record: AllocationRecord = {
  id: crypto.randomUUID(),
  date: new Date().toISOString().slice(0, 10),
  invoiceAmountCents: state.invoiceAmountCents,
  invoiceCurrency: state.invoiceCurrency,
  invoiceEurEquivalentCents: state.invoiceEurEquivalentCents,
  mode: state.result.mode,
  moves: state.result.moves,
  source: state.source,  // ADD — Phase 11 typed this as optional string
};
```

**Important:** Phase 11 migration guarantees `record.source ?? ''` for pre-v1.1 records. New records written with `source: ''` (when field is empty) or `source: 'Client Name'` (when filled). No null check needed in history display — `record.source` is always a string after Phase 11 migration.

### Pattern 5: History Source Display

**What:** Show `record.source` in the collapsed history row when non-empty.

**Current collapsed row layout:** `[date badge] [mode badge]` on left, `[amount] [move count] [chevron]` on right. Add source between date and mode badge if non-empty.

```typescript
// HistoryPage.tsx — in the collapsed row
{record.source && (
  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
    {record.source}
  </span>
)}
```

### Pattern 6: History Filters with useMemo

**What:** Three filter inputs (date range, text search on source, amount range) stored as `useState` in `HistoryPage`. Filtered list derived with `useMemo`.

**Filter state:**
```typescript
const [filters, setFilters] = useState({
  dateFrom: '',    // YYYY-MM-DD or ''
  dateTo: '',      // YYYY-MM-DD or ''
  sourceQuery: '', // free text or ''
  amountMin: '',   // decimal euros string or ''
  amountMax: '',   // decimal euros string or ''
});
```

**Filtered list:**
```typescript
const filteredHistory = useMemo(() => {
  return history.filter(r => {
    if (filters.dateFrom && r.date < filters.dateFrom) return false;
    if (filters.dateTo && r.date > filters.dateTo) return false;
    if (filters.sourceQuery && !r.source.toLowerCase().includes(filters.sourceQuery.toLowerCase())) return false;
    if (filters.amountMin && r.invoiceAmountCents < parseCents(filters.amountMin)) return false;
    if (filters.amountMax && r.invoiceAmountCents > parseCents(filters.amountMax)) return false;
    return true;
  });
}, [history, filters]);
```

**Key:** ISO date strings compare lexicographically — `'2026-01-15' < '2026-03-01'` is correct. No date parsing needed for range comparison.

**Amount filter:** Compare against `record.invoiceAmountCents` using `parseCents()` from `src/lib/cents.ts`. This handles both integer and decimal euro input (same function used by InvoiceForm).

### Anti-Patterns to Avoid

- **FOUC via React state only:** `settingsStore.loadSettings()` fires after React renders. Any dark mode state stored only in Zustand will cause a visible flash on every reload. Must have an inline `<head>` script.
- **localStorage as primary persistence for theme:** `localStorage` should only be the fast-read FOUC mirror. The authoritative theme value stays in `settingsStore.settings.theme` (persisted to FSA/idb). Do not let the two drift.
- **Async reads in FOUC script:** The inline `<head>` script must be synchronous. Do not use `await`, `fetch`, or IndexedDB APIs there.
- **Treating `record.source` as potentially null:** Phase 11 migration guarantees all records have `source` as a string (empty string for pre-v1.1). Call `.toLowerCase()` directly without null check.
- **Complex AND/OR filter logic:** The requirements explicitly exclude this (see REQUIREMENTS.md Out of Scope). Keep filters independent — each one narrows the list, applied in sequence.
- **Uncontrolled filter inputs:** Date range `<input type="date">` should be controlled inputs feeding into `useState`, not refs or uncontrolled.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date comparison for range filter | Custom date parser | ISO string lexicographic comparison (`r.date < filters.dateFrom`) | ISO `YYYY-MM-DD` strings sort correctly as strings |
| Amount parsing in filters | Custom decimal parser | `parseCents()` from `src/lib/cents.ts` | Already handles euro decimal input; consistent with rest of app |
| Dark mode media query detection | Custom listener | `window.matchMedia('(prefers-color-scheme: dark)').matches` (already in `applyTheme()`) | Built-in browser API; already implemented in `settingsStore.ts` |
| Fuzzy search for source filter | Fuse.js or similar | `String.prototype.includes()` | Personal app data; exact substring match is expected UX |

**Key insight:** Every problem in this phase has a native or already-installed solution. The only new concept is the synchronous `<head>` script for FOUC prevention — everything else is wiring existing pieces together.

---

## Common Pitfalls

### Pitfall 1: FOUC Because localStorage Key is Only Written by FOUC Script
**What goes wrong:** Developer writes `mf_theme` to localStorage in the inline script but forgets to write it in `settingsStore.updateSettings()` and `loadSettings()`. When the user changes the theme in-app, `localStorage` still holds the old value. On next page load, the FOUC script reads the stale value and flashes the wrong theme.
**Why it happens:** Two code locations need to stay in sync: the inline script (reads) and `applyTheme()` (writes).
**How to avoid:** In `applyTheme()`, add `localStorage.setItem('mf_theme', theme)` before or after the DOM class toggle. Also call it from `loadSettings()` after reading the persisted value.
**Warning signs:** Theme toggle works in-session but page reloads show wrong theme after a theme change.

### Pitfall 2: `@custom-variant dark` Selector Excludes Root Element
**What goes wrong:** With `@custom-variant dark (&:is(.dark *))`, Tailwind `dark:` utility classes applied to `<html>` itself do not activate. This is unlikely in this codebase (the dark tokens are in plain `.dark {}` CSS, not utility classes) but is a latent bug for any future `dark:` usage on the root.
**Why it happens:** `:is(.dark *)` matches elements *inside* `.dark` only. `:where(.dark, .dark *)` matches the element itself OR any descendant.
**How to avoid:** Fix to `@custom-variant dark (&:where(.dark, .dark *))`.
**Warning signs:** `dark:` utility on `<html>` or `<body>` has no effect.

### Pitfall 3: InvoiceForm `onSubmit` Prop Not Extended
**What goes wrong:** Developer adds the `source` input to `InvoiceForm` but passes the value via a separate prop or ref instead of extending the existing `onSubmit` data shape.
**Why it happens:** Not reading existing `onSubmit` interface carefully.
**How to avoid:** Extend `InvoiceFormProps.onSubmit` to `onSubmit: (data: { amountCents: number; currency: string; eurEquivalentCents: number; source: string }) => void`. Field is always a string (empty string when blank).
**Warning signs:** TypeScript error in `InvoicePage.handleFormSubmit` parameter destructuring.

### Pitfall 4: `parseCents` Called on Empty String in Amount Filter
**What goes wrong:** When `filters.amountMin` or `filters.amountMax` is `''`, calling `parseCents('')` may return 0, causing all records to fail the `>= 0` check or similar boundary condition.
**Why it happens:** Forgetting to guard on empty string before parsing.
**How to avoid:** Gate: `if (filters.amountMin && r.invoiceAmountCents < parseCents(filters.amountMin)) return false`. The `&&` short-circuit skips the filter when the field is empty.
**Warning signs:** Empty filter inputs cause history to show 0 records.

### Pitfall 5: useMemo Dependency Array Missing `filters`
**What goes wrong:** `useMemo` for filtered history lists `[history]` as dependency but omits `filters`, causing the list to not update when filter inputs change.
**Why it happens:** React doesn't error on missing deps in `useMemo` (unlike `useEffect` with ESLint rules).
**How to avoid:** `useMemo(() => ..., [history, filters])`. If filters is an object, use the whole object reference (it changes on each `setFilters` call since we use a fresh object spread).
**Warning signs:** Changing a filter input does not update the history list.

### Pitfall 6: Source Field Shows `""` in History Instead of Nothing
**What goes wrong:** History collapsed row renders an empty string `record.source` as a visible space or empty badge.
**Why it happens:** Forgetting `{record.source && ...}` conditional render.
**How to avoid:** Gate source display on truthiness: `{record.source && <span>...</span>}`.
**Warning signs:** Collapsed rows for pre-v1.1 allocations show an empty element or extra spacing.

---

## Code Examples

Verified patterns from codebase inspection and official sources:

### FOUC Prevention Inline Script
```html
<!-- index.html — place as FIRST <script> inside <head> -->
<script>
  (function() {
    try {
      var t = localStorage.getItem('mf_theme');
      if (t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) { /* localStorage blocked (e.g. private browsing with strict settings) */ }
  })();
</script>
```

### applyTheme with localStorage Mirror (settingsStore.ts)
```typescript
// Source: direct codebase read + Tailwind v4 official dark mode pattern
function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia != null &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  try { localStorage.setItem('mf_theme', theme); } catch (_) {}
}
```

### Theme Toggle Button (App.tsx header)
```typescript
// Source: direct codebase read of App.tsx header structure
import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

// Inside App component:
const theme = useSettingsStore(s => s.settings.theme ?? 'system');
const updateSettings = useSettingsStore(s => s.updateSettings);
const THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' } as const;
type Theme = 'light' | 'dark' | 'system';

// In JSX header (right side of flex justify-between):
<button
  type="button"
  onClick={() => void updateSettings({ theme: THEME_CYCLE[theme] as Theme })}
  className="p-1.5 rounded hover:bg-muted transition-colors"
  aria-label={`Current theme: ${theme}. Click to switch.`}
>
  {theme === 'dark' ? <Moon className="h-4 w-4" />
    : theme === 'light' ? <Sun className="h-4 w-4" />
    : <Monitor className="h-4 w-4" />}
</button>
```

### InvoiceForm Source Field Addition
```typescript
// InvoiceForm.tsx — add to state and JSX
const [source, setSource] = useState('');

// In onSubmit data:
onSubmit({
  amountCents,
  currency: currency.trim(),
  eurEquivalentCents,
  source: source.trim(),  // always a string, may be ''
});

// Reset on successful submit:
setSource('');

// JSX (add between EUR Equivalent and Submit button):
<div className="space-y-1.5">
  <label htmlFor="source" className="block text-sm font-medium text-foreground">
    From <span className="text-muted-foreground font-normal">(optional)</span>
  </label>
  <Input
    id="source"
    type="text"
    placeholder="Client or project name"
    value={source}
    onChange={e => setSource(e.target.value)}
  />
</div>
```

### History Filter State and useMemo (HistoryPage.tsx)
```typescript
// Source: React useMemo official docs + direct inspection of AllocationRecord type
const [filters, setFilters] = useState({
  dateFrom: '',
  dateTo: '',
  sourceQuery: '',
  amountMin: '',
  amountMax: '',
});

const filteredHistory = useMemo(() => {
  return history.filter(r => {
    if (filters.dateFrom && r.date < filters.dateFrom) return false;
    if (filters.dateTo && r.date > filters.dateTo) return false;
    if (filters.sourceQuery &&
        !r.source.toLowerCase().includes(filters.sourceQuery.toLowerCase())) return false;
    if (filters.amountMin && r.invoiceAmountCents < parseCents(filters.amountMin)) return false;
    if (filters.amountMax && r.invoiceAmountCents > parseCents(filters.amountMax)) return false;
    return true;
  });
}, [history, filters]);
```

### Source in Collapsed History Row
```typescript
// In the collapsed row JSX flex container, after the date span:
{record.source && (
  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={record.source}>
    {record.source}
  </span>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `darkMode: 'class'` in `tailwind.config.js` | `@custom-variant dark` in CSS | Tailwind v4 (2024) | No JS config file needed; CSS-first |
| Theme in component state (`useState`) | Theme in `settingsStore` + DOM class toggle | v1.1 design | One `classList.toggle` call, Tailwind handles rest |
| `:is(.dark *)` custom variant | `:where(.dark, .dark *)` | Tailwind v4 recommendation | Matches root element, zero specificity |
| Emoji-based or complex filter libraries | `useMemo` + `Array.filter` + native inputs | Evergreen for personal apps | Zero bundle cost for <1000 records |

**Already correct in this codebase:**
- `settingsStore.ts`: `applyTheme()` is already implemented and called on `loadSettings` and `updateSettings`
- `allocationStore.ts`: read-time migration already injects `source: record.source ?? ''`
- `domain.ts`: `AllocationRecord.source?: string` already typed
- `.dark {}` CSS block is fully defined in `index.css`

**Gaps to close in this phase:**
- `index.html`: no FOUC prevention script
- `applyTheme()`: does not write to `localStorage` (so FOUC script has nothing to read)
- `App.tsx` header: no theme toggle control
- `InvoiceForm.tsx`: no source input field
- `InvoicePage.tsx`: `source` not threaded through `handleFormSubmit` or `handleDone`
- `HistoryPage.tsx`: source not shown in collapsed row; no filter UI; shows all records (no filtering)

---

## Open Questions

1. **System preference change listener (THEME-01 edge case)**
   - What we know: `applyTheme('system')` reads `window.matchMedia` once at call time
   - What's unclear: If the user has 'system' selected and changes their OS dark mode preference while the app is open, should the theme update live?
   - Recommendation: Out of scope for this phase — THEME-01 says "applied immediately" on toggle, not "reacts to OS changes live". Add a `matchMedia.addEventListener('change', ...)` listener in a future phase if desired. Skip for now.

2. **`parseCents` behavior on filter edge inputs**
   - What we know: `parseCents('')` behavior depends on its implementation
   - What's unclear: Whether `parseCents('')` returns 0 or throws
   - Recommendation: Always guard with `if (filters.amountMin && ...)` before calling `parseCents`. This prevents the call entirely for empty strings. Verify `parseCents` behavior during implementation.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` (only `workflow.research`, `plan_check`, `verifier`, `auto_advance` are present). No Nyquist validation section required.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `src/stores/settingsStore.ts` — `applyTheme()` implementation, `loadSettings`, `updateSettings`
- Direct codebase read: `src/types/domain.ts` — `AllocationRecord.source`, `Settings.theme` types
- Direct codebase read: `src/stores/allocationStore.ts` — `source ?? ''` migration in `loadHistory`
- Direct codebase read: `src/features/history/HistoryPage.tsx` — current collapsed row structure
- Direct codebase read: `src/features/invoice/InvoiceForm.tsx` — existing form + `onSubmit` prop
- Direct codebase read: `src/features/invoice/InvoicePage.tsx` — `handleDone` + `AllocationRecord` construction
- Direct codebase read: `src/App.tsx` — header structure
- Direct codebase read: `src/index.css` — `@custom-variant dark (&:is(.dark *))`, `.dark {}` token block
- Direct codebase read: `src/index.html` — no current FOUC script
- `.planning/research/STACK.md` — v1.1 dark mode, FOUC, localStorage pattern, useMemo filter approach (researched 2026-02-28)
- `.planning/research/ARCHITECTURE.md` — file change map, `applyTheme()` DOM side-effect, InvoiceForm extension pattern
- `.planning/STATE.md` — recorded decisions: `@custom-variant dark` selector fix, FOUC requires inline `<head>` script, `source ?? ''` migration, `localStorage` for theme FOUC only

### Secondary (MEDIUM confidence)
- [Tailwind v4 Dark Mode docs](https://tailwindcss.com/docs/dark-mode) — `@custom-variant` syntax, `:where()` recommendation, localStorage three-state pattern (referenced in STACK.md research)

### Tertiary (LOW confidence — not needed, findings fully supported by primary sources)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all libraries already installed and in use
- Architecture: HIGH — based on direct codebase inspection of every file being modified
- Pitfalls: HIGH — based on direct inspection of current code gaps and recorded decisions in STATE.md

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable domain — React, Tailwind v4, localStorage, useMemo are not fast-moving)
