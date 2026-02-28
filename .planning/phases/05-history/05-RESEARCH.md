# Phase 5: History - Research

**Researched:** 2026-02-28
**Domain:** React accordion UI, Zustand state mutation, inline date formatting
**Confidence:** HIGH

## Summary

Phase 5 is the smallest and lowest-risk phase in the roadmap. The data layer is already fully implemented: `allocationStore.ts` stores `AllocationRecord[]` in reverse chronological order (most recent first), and `settingsStore.ts` holds `floorItems` with `coveredThisMonth` booleans. All types are defined and stable. There is nothing new to install.

The entire phase reduces to: (1) replacing the `HistoryPage.tsx` stub with an accordion list that renders directly from the existing store, and (2) adding a "New Month" button that calls `updateSettings` with all floor items' `coveredThisMonth` flipped to `false`. No new stores, no new types, no new libraries.

The key risk is choosing the accordion pattern correctly — React 19 has no built-in accordion, shadcn/ui has one but it is NOT currently installed (only `button`, `card`, `badge`, `input` exist), so the accordion must be built with `useState` on each row or a single `expandedId` state. Given the context decisions lock in "inline accordion — no modal or sheet" and delegate icon choice to Claude, the correct implementation uses `lucide-react` (already in dependencies) `ChevronDown`/`ChevronUp` icons with a `useState<string | null>` for the currently-open entry.

**Primary recommendation:** Build the entire phase as a single `HistoryPage.tsx` file using `useState`, `lucide-react` chevrons, and the existing `Card`/`CardContent`/`Button`/`Badge` components. No new dependencies needed.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reverse chronological list of allocation entries (most recent first)
- Each entry is a clickable row that expands/collapses inline (accordion — no modal or sheet)
- Collapsed state shows: formatted date, invoice amount + currency, mode badge (Stabilize/Distribute), move count (e.g. "4 moves")
- Date format: human-readable short form, e.g. "28 Feb 2026"
- Reuse the Stabilize/Distribute badge color conventions from AllocationResult.tsx (amber = stabilize, emerald = distribute)
- Expanded entry shows all moves exactly as they appeared at confirmation time: destination account name, amount, calculation string, reason string
- Reuse the Card layout pattern from AllocationResult.tsx for move items
- No re-running of allocation logic — render from stored AllocationRecord.moves array directly
- "New Month" button lives at the top of the History page (not in Settings)
- Button triggers a browser `confirm()` dialog with exact text: "Reset floor coverage for new month? This marks all floor items as uncovered. Account balances and history are unchanged."
- On confirm: set `coveredThisMonth = false` on all floor items in settingsStore, persist settings
- No other data is touched (balances, history records, configuration all unchanged)
- When `history.length === 0`: show a single centered message — "No allocations yet. Process an invoice to get started."
- No illustration, no pagination

### Claude's Discretion
- Exact chevron/arrow icon used for expand/collapse toggle
- Animation timing on accordion expand
- Whether to show the total allocated amount in the collapsed row (add if it fits cleanly)

### Deferred Ideas (OUT OF SCOPE)
- Filtering history by date range, mode, or amount — future phase
- Exporting history as CSV — Phase 6 scope or standalone
- Deleting individual history records — not planned
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-01 | History log records every confirmed allocation: date, invoice details (amount, currency, EUR equivalent), mode used, and every move made | Data already in `allocationStore.history: AllocationRecord[]` — fully persisted. Render directly. |
| HIST-02 | User can view history list (most recent first) and expand any entry to see full move details | `useState<string \| null>` accordion pattern. `history` is already stored most-recent-first via `appendAllocation`. |
| HIST-03 | "New Month" reset clears floor coverage toggles (marks all floor items as uncovered) while preserving account balances, history, and configuration | `useSettingsStore.getState().updateSettings({ floorItems: currentSettings.floorItems.map(f => ({ ...f, coveredThisMonth: false })) })` — no other stores touched. |
</phase_requirements>

---

## Standard Stack

### Core (all already installed, no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19.2.4 | Component rendering, `useState` for accordion | Already in project |
| lucide-react | ^0.575.0 | ChevronDown / ChevronUp icons | Already in `package.json` dependencies |
| Zustand 5 | ^5.0.11 | `useAllocationStore`, `useSettingsStore` | Already wired, pattern established |
| shadcn/ui Card | installed | Move item card layout | Already in `src/components/ui/card.tsx` |
| shadcn/ui Button | installed | "New Month" button | Already in `src/components/ui/button.tsx` |
| shadcn/ui Badge | installed | Mode badges (amber/emerald) | Already in `src/components/ui/badge.tsx` |
| formatCents | src/lib/cents.ts | Money formatting | Already used everywhere |

### NOT Installed (do not try to use)

| Component | Status | Reason |
|-----------|--------|--------|
| shadcn/ui Accordion | NOT installed | Only button/card/badge/input are present |
| shadcn/ui Sheet | NOT installed | Deferred by user decision anyway |
| shadcn/ui Dialog | NOT installed | Not needed |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended File Structure

Only one file changes:

```
src/features/history/
└── HistoryPage.tsx     ← Replace stub entirely
```

No new files. No new stores. No new types.

### Pattern 1: Single-open Accordion with useState

**What:** Track which history entry is currently expanded using `useState<string | null>(null)`. Clicking a row toggles it open/closed — clicking an already-open row closes it.

**When to use:** When shadcn's Accordion component is not installed and the accordion behavior is simple (single-open, no keyboard nav requirements).

**Example:**
```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);

function toggleEntry(id: string) {
  setExpandedId(prev => prev === id ? null : id);
}

// In JSX:
<button onClick={() => toggleEntry(record.id)}>
  {/* collapsed row content */}
  <ChevronDown className={expandedId === record.id ? 'rotate-180' : ''} />
</button>
{expandedId === record.id && (
  <div>{/* expanded move cards */}</div>
)}
```

### Pattern 2: Date Formatting — No External Library

**What:** Format ISO date string "2026-02-28" to "28 Feb 2026" using `Intl.DateTimeFormat`.

**Why no library:** The project has no date library (no date-fns, no dayjs). `Intl.DateTimeFormat` is available in all modern browsers and handles this case cleanly.

**Important pitfall:** Parsing `"2026-02-28"` with `new Date("2026-02-28")` gives UTC midnight, which will display as the day before in some timezones when using `toLocaleDateString`. Use a safe parser that appends `T00:00:00` or build the date parts manually.

```typescript
// Safe: parse as local date to avoid UTC-midnight timezone shift
function formatHistoryDate(isoDate: string): string {
  // "2026-02-28" → "28 Feb 2026"
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day)); // local time, no UTC shift
}
```

### Pattern 3: Mode Badge — Inline Classes (not ModeBadge component)

**What:** The existing `ModeBadge.tsx` uses `shadcn/ui Badge` with `variant: 'outline'` and `'default'` — these don't produce amber/emerald colors. The amber/emerald color convention used in `AllocationResult.tsx` is implemented as inline Tailwind classes directly, not via a shared component.

**Implementation:** Copy the inline badge pattern from `AllocationResult.tsx`:
```typescript
const modeBadgeClass =
  record.mode === 'stabilize'
    ? 'bg-amber-100 text-amber-800'
    : 'bg-emerald-100 text-emerald-800';

const modeLabel = record.mode === 'stabilize' ? 'Stabilize' : 'Distribute';

<span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${modeBadgeClass}`}>
  {modeLabel}
</span>
```

### Pattern 4: New Month Reset

**What:** Call `useSettingsStore.getState().updateSettings()` directly (outside React render cycle, inside an event handler) to flip all floor items.

**When to use:** Same pattern as used in `InvoicePage.tsx` line 96 — `useSettingsStore.getState()` is the correct Zustand v5 pattern for accessing state inside async event handlers.

```typescript
const handleNewMonth = async () => {
  const confirmed = window.confirm(
    'Reset floor coverage for new month? This marks all floor items as uncovered. Account balances and history are unchanged.'
  );
  if (!confirmed) return;
  const { settings, updateSettings } = useSettingsStore.getState();
  await updateSettings({
    floorItems: settings.floorItems.map(f => ({ ...f, coveredThisMonth: false })),
  });
};
```

### Pattern 5: Account Name Lookup

**What:** `AllocationMove.destinationAccountId` is a UUID. To display the account name in expanded moves, need to look up `accounts` from `useAccountStore`. Same approach as `AllocationResult.tsx` line 54-56.

```typescript
const accounts = useAccountStore(s => s.accounts);
// In render:
const accountName =
  accounts.find(a => a.id === move.destinationAccountId)?.name
  ?? move.destinationAccountId
  || '(unallocated)';
```

### Pattern 6: Move Cards (Expanded Content)

Directly adapted from `AllocationResult.tsx` lines 58-73:

```typescript
<Card key={index} className="py-4">
  <CardContent className="px-4 space-y-1">
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-medium text-sm">{accountName}</span>
      <span className="font-semibold text-sm tabular-nums">
        {formatCents(move.amountCents as Cents)}
      </span>
    </div>
    <p className="text-xs text-foreground/80">{move.calculation}</p>
    <p className="text-xs text-muted-foreground">{move.reason}</p>
  </CardContent>
</Card>
```

### Pattern 7: Total Allocated (Claude's Discretion — Recommend YES)

The collapsed row has space to show the total amount allocated. `addCents` is already imported in `AllocationResult.tsx` and can be reused. Showing the total makes the collapsed row more useful at a glance.

```typescript
import { addCents, formatCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';

const total = addCents(...record.moves.map(m => m.amountCents as Cents));
```

### Anti-Patterns to Avoid

- **Do NOT use `new Date(record.date)` directly for display:** ISO-only strings parse as UTC, which can shift the displayed day. Use the split-and-reconstruct pattern above.
- **Do NOT try to import shadcn Accordion:** It is not installed. Build accordion with `useState`.
- **Do NOT re-run `computeAllocation`:** CONTEXT.md explicitly says to render from stored data only.
- **Do NOT call `useSettingsStore` inside JSX without `useState`/`useCallback`:** Always access `useSettingsStore.getState()` inside event handlers (not render body) when you need the latest state at click time.
- **Do NOT use `key={index}` for the outer accordion rows:** Use `key={record.id}` (UUID) for stable reconciliation. `key={index}` is only acceptable for the inner moves array where there is no stable ID.
- **Do NOT use `<Card>` for the outer accordion row wrapper:** The collapsible row should be a plain div or button with border styling to avoid nested card-in-card visual confusion. Reserve `<Card>` for the inner move items.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion expand/collapse | Custom animation system | `useState` + CSS `transition` on height or simple show/hide | Sufficient for a personal finance tool; no keyboard nav requirements stated |
| Date formatting | Custom date parser | `Intl.DateTimeFormat` with year/month/day components | Already in browser, handles locale correctly |
| Money formatting | Raw division | `formatCents` from `@/lib/cents` | Already used everywhere; maintains consistency |
| Store access in handlers | Direct Zustand state mutation | `useSettingsStore.getState().updateSettings(...)` | Established pattern in InvoicePage.tsx |

---

## Common Pitfalls

### Pitfall 1: UTC Date Shift
**What goes wrong:** `new Date("2026-02-28")` parses as UTC midnight. In UTC+1 or later, this renders as "27 Feb 2026".
**Why it happens:** ISO 8601 date-only strings default to UTC in the JS Date constructor.
**How to avoid:** Use `new Date(year, month - 1, day)` after splitting the ISO string manually.
**Warning signs:** Date appears one day early in testing from Europe/Berlin timezone.

### Pitfall 2: Empty Moves Array
**What goes wrong:** `addCents(...[])` with spread over empty array — `addCents` expects at least one Cents argument in practice.
**Why it happens:** If an `AllocationRecord` somehow has zero moves (e.g., edge case in early development data).
**How to avoid:** Guard with `record.moves.length > 0` before calling `addCents`, or initialize with `0 as Cents` as fallback: `record.moves.length > 0 ? addCents(...record.moves.map(...)) : 0 as Cents`.

### Pitfall 3: Missing Account Name Fallback
**What goes wrong:** `accounts.find(...)?.name` returns `undefined` if the account was deleted after the allocation was confirmed.
**Why it happens:** History is append-only; account config can change.
**How to avoid:** Always provide fallback: `?.name ?? move.destinationAccountId`. The ID is ugly but better than blank.

### Pitfall 4: Accordion Key Stability
**What goes wrong:** Using `key={index}` on the outer list causes React to lose expand state on re-render if history is prepended.
**Why it happens:** Array index shifts when new items are prepended.
**How to avoid:** Always use `key={record.id}` (UUID) on the outer accordion rows.

### Pitfall 5: confirm() in Tests
**What goes wrong:** `window.confirm()` returns `undefined` in jsdom (not `true`/`false`), so tests that trigger the New Month handler may behave unexpectedly.
**Why it happens:** jsdom doesn't implement native dialogs.
**How to avoid:** Mock `window.confirm` in any test that exercises `handleNewMonth`. Not a runtime issue — only affects test environment.

---

## Code Examples

### Complete HistoryPage Structure

```typescript
// src/features/history/HistoryPage.tsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAllocationStore } from '@/stores/allocationStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addCents, formatCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';
import type { AllocationRecord } from '@/types/domain';

function formatHistoryDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function HistoryPage() {
  const history = useAllocationStore(s => s.history);
  const accounts = useAccountStore(s => s.accounts);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleNewMonth = async () => {
    const confirmed = window.confirm(
      'Reset floor coverage for new month? This marks all floor items as uncovered. Account balances and history are unchanged.'
    );
    if (!confirmed) return;
    const { settings, updateSettings } = useSettingsStore.getState();
    await updateSettings({
      floorItems: settings.floorItems.map(f => ({ ...f, coveredThisMonth: false })),
    });
  };

  // Empty state
  if (history.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">History</h1>
          <Button variant="outline" size="sm" onClick={() => void handleNewMonth()}>
            New Month
          </Button>
        </div>
        <p className="text-center text-muted-foreground py-12">
          No allocations yet. Process an invoice to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">History</h1>
        <Button variant="outline" size="sm" onClick={() => void handleNewMonth()}>
          New Month
        </Button>
      </div>

      <div className="space-y-2">
        {history.map((record) => {
          const isOpen = expandedId === record.id;
          const modeLabel = record.mode === 'stabilize' ? 'Stabilize' : 'Distribute';
          const modeBadgeClass = record.mode === 'stabilize'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-emerald-100 text-emerald-800';
          const total = record.moves.length > 0
            ? addCents(...record.moves.map(m => m.amountCents as Cents))
            : 0 as Cents;

          return (
            <div key={record.id} className="rounded-lg border border-border">
              {/* Collapsed row (always visible) */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
                onClick={() => setExpandedId(isOpen ? null : record.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium">
                    {formatHistoryDate(record.date)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${modeBadgeClass}`}>
                    {modeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatCents(record.invoiceAmountCents as Cents)} {record.invoiceCurrency}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {record.moves.length} move{record.moves.length === 1 ? '' : 's'}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  {/* Invoice summary line */}
                  <p className="text-xs text-muted-foreground mb-2">
                    {formatCents(record.invoiceAmountCents as Cents)} {record.invoiceCurrency}
                    {' → '}
                    {formatCents(record.invoiceEurEquivalentCents as Cents)} EUR equivalent
                  </p>

                  {/* Move cards */}
                  {record.moves.map((move, i) => {
                    const accountName =
                      accounts.find(a => a.id === move.destinationAccountId)?.name
                      ?? move.destinationAccountId
                      || '(unallocated)';
                    return (
                      <Card key={i} className="py-4">
                        <CardContent className="px-4 space-y-1">
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="font-medium text-sm">{accountName}</span>
                            <span className="font-semibold text-sm tabular-nums">
                              {formatCents(move.amountCents as Cents)}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80">{move.calculation}</p>
                          <p className="text-xs text-muted-foreground">{move.reason}</p>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Total line */}
                  <div className="flex items-center justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">Total allocated</span>
                    <span className="font-semibold tabular-nums">{formatCents(total)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn Accordion component | useState-based inline accordion | N/A (shadcn Accordion not installed) | Must hand-build; simple enough not to matter |
| `new Date(isoString)` for display | Split-and-reconstruct for local date | Always a best practice | Avoids UTC midnight timezone shift |
| Zustand persist middleware | Manual `storage.write` calls in store actions | Project convention from Phase 1 | No persist middleware; follow existing pattern |

---

## Open Questions

1. **Animation on accordion expand**
   - What we know: User delegated timing to Claude. `transition-all` on height is complex in CSS without JS measurement.
   - What's unclear: Whether the user expects smooth animation or is fine with instant show/hide.
   - Recommendation: Use instant show/hide (`{isOpen && <div>...</div>}`). For a personal finance tool used occasionally, animation adds complexity without significant UX benefit. If desired later, add `animate-in fade-in-0` from `tw-animate-css` (already in devDependencies).

2. **Total in collapsed row vs invoice amount**
   - What we know: User said "add if it fits cleanly". Collapsed row already shows invoice amount + currency + move count + chevron.
   - Recommendation: Show invoice amount (the raw invoice amount + currency) in the collapsed row. The "total allocated" (EUR equivalent total) is visible when expanded. This avoids cramming too many numbers into the collapsed view.

---

## Validation Architecture

Note: `workflow.nyquist_validation` is NOT present in `.planning/config.json` (only `research`, `plan_check`, `verifier`, `auto_advance` keys exist). Treating as false — skipping this section.

---

## Integration Points (No Changes Needed)

| File | Status | Action |
|------|--------|--------|
| `src/stores/allocationStore.ts` | Complete | Read-only — no changes |
| `src/stores/settingsStore.ts` | Complete | Read-only — no changes |
| `src/stores/accountStore.ts` | Complete | Read-only — no changes |
| `src/types/domain.ts` | Complete | Read-only — no changes |
| `src/App.tsx` | Complete | Read-only — tab wiring already done, HistoryPage already imported |
| `src/features/history/HistoryPage.tsx` | **Stub** | **Replace entirely — this is the only file that changes** |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/stores/allocationStore.ts`, `src/stores/settingsStore.ts`, `src/types/domain.ts` — all types and store APIs verified by reading actual source
- Direct codebase inspection: `src/features/invoice/AllocationResult.tsx` — badge color pattern and move card pattern confirmed
- Direct codebase inspection: `src/features/invoice/InvoicePage.tsx` line 96 — `useSettingsStore.getState()` pattern confirmed
- Direct codebase inspection: `package.json` — `lucide-react ^0.575.0` confirmed as installed dependency
- Direct codebase inspection: `src/components/ui/` — only button/card/badge/input exist; shadcn Accordion not installed
- MDN Web Docs knowledge: `Intl.DateTimeFormat` and `new Date(year, month-1, day)` for local time parsing — well-established JS standard

### Secondary (MEDIUM confidence)
- Training knowledge: `lucide-react` exports `ChevronDown` — standard icon used across shadcn documentation and examples; confirmed version 0.575 is installed

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by reading actual package.json and installed component files
- Architecture: HIGH — all store APIs verified by reading source; patterns confirmed from existing code
- Pitfalls: HIGH — UTC date pitfall is well-documented JS behavior; others confirmed from codebase patterns

**Research date:** 2026-02-28
**Valid until:** Stable — no fast-moving dependencies; all findings based on project's own source code
