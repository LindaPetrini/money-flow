# Feature Research

**Domain:** Personal finance / freelance budget allocator — v1.1 new capabilities
**Researched:** 2026-02-28
**Confidence:** MEDIUM-HIGH (most findings verified against official docs or multiple sources; AI Q&A UX patterns are LOW confidence where only WebSearch evidence exists)

---

## Context: This Is a Subsequent-Milestone Research

v1.0 is complete. Do NOT re-research: invoice flow, Stabilize/Distribute modes, account dashboard,
settings, history log, CSV upload, or FSA/IndexedDB persistence.

The five v1.1 features being added:

1. AI transaction Q&A (uncertain transactions ask user for context + bucket; answers persist as merchant memory)
2. AI floor item detection (recurring expenses detected from CSV, suggested as floor items)
3. Invoice source tracking ("from" / client name field on invoice entry, shown in history)
4. History search/filter (date range, client, amount)
5. Dark mode (toggle, persisted across sessions)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that belong to their category. Missing = product feels incomplete or half-baked.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dark mode toggle | Every 2025 app has dark mode; absence is jarring | LOW | Tailwind v4 uses `@custom-variant dark (&:where(.dark, .dark *))` in CSS; toggle adds `.dark` class to `<html>`; persist preference in `localStorage` (not FSA — UI preference, not financial data) |
| History text search | Standard on any list longer than ~10 items | LOW | Filter in-memory on `history[]` array already in `allocationStore`; no backend needed |
| History date range filter | Finance apps universally offer "this month / last 3 months / custom" | MEDIUM | Preset ranges ("This month", "Last 3 months", "All time") + custom date pickers covers all cases; shadcn/ui has `Popover` + `Calendar` components |
| History amount filter | Users want to find "that big invoice" | LOW | Simple min/max number inputs; filter client-side |
| Client name visible in history | If you record it on entry, you must show it | LOW | Depends on invoice "from" field being added first |
| Optional "from" field on invoice | Once client tracking exists, recording is expected | LOW | Optional `string` field added to `AllocationRecord`; empty = no display; no validation needed |

### Differentiators (Competitive Advantage)

Features specific to Money Flow's value proposition: AI-assisted allocation with full transparency.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI transaction Q&A (ask + persist) | Turns a one-shot AI suggestion into a learning system; AI improves with each import | HIGH | Two sub-problems: (1) LLM identifies low-confidence transactions and asks questions in a structured dialog; (2) answers saved as `merchantMemory: Record<string, bucketId>` in settings storage, applied on next import. No competitor in the personal-budget space does this locally/client-side. |
| AI floor item detection from CSV | Translates passive CSV analysis into actionable configuration; shortcut that saves 10 minutes of manual floor setup | HIGH | Algorithm: group transactions by normalized merchant name, compute periodicity and amount consistency, threshold for "recurring" (3+ occurrences at ~monthly interval with <20% amount variance). Pre-fills floor item form on confirm — tight integration with existing settings UI. |
| Merchant memory across imports | AI category decisions persist; each import is smarter than the last | MEDIUM | Storage: new `merchantMemory` key in settings JSON (FSA-backed). Structure: `{ [normalizedMerchantName: string]: { bucketLabel: string, lastSeen: string } }`. Applied as pre-categorization before LLM call to reduce tokens and improve consistency. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-categorize all transactions silently | Feels faster; no user interaction | Breaks transparency — the core value prop. Users cannot trust allocations they did not review. Silent errors compound over time. | AI asks only about genuinely uncertain transactions (confidence below threshold); pre-assigns high-confidence ones but shows them in a review list |
| Editable merchant memory management UI | Power users want full CRUD on the memory store | Scope creep for v1.1; premature optimization — memory store is small and self-correcting via re-import | Implicit corrections: if user reassigns a transaction, update the memory entry. No separate management page needed yet. |
| Complex multi-field filter combinations ("AND/OR") | Tables feel more powerful | Disproportionate complexity for a list of ~50-200 allocation records; shadcn/ui does not have compound filter UI out-of-box | Simple independent filters (date range + client text search + amount range) that all apply together (implicit AND). No boolean logic UI. |
| Mandatory client name on invoice | Seems like good data hygiene | Freelancers sometimes get paid by platforms (Stripe, PayPal) with no "client" concept; forcing a field they do not need creates friction | Optional field with placeholder "Client (optional)"; omitted entries show no client column in history |
| System-level dark mode auto-detect only | "Just follow the OS preference" | Inconsistent — user may want the app light while OS is dark; OS preference is a default for new users only | Initialize from `localStorage` first, fall back to `prefers-color-scheme` for first visit only |

---

## Feature Dependencies

```
[Invoice "from" field]
    └──required-by──> [Client name in history]
    └──required-by──> [History filter by client]

[CSV import — v1.0, already exists]
    └──required-by──> [AI transaction Q&A]
                           └──required-by──> [Merchant memory persist]
    └──required-by──> [AI floor item detection]
                           └──required-by──> [Floor item pre-fill on confirm]

[Merchant memory persist]
    └──enhances──> [AI transaction Q&A] (future imports use memory; fewer questions)

[Floor item form — v1.0, already exists]
    └──required-by──> [AI floor item detection pre-fill]
```

### Dependency Notes

- **Invoice "from" field has no prerequisites.** It is the leaf dependency for all client-tracking features; implement it first within that cluster.
- **AI transaction Q&A requires the existing CSV import flow.** The post-upload analysis flow is the entry point; the Q&A dialog extends that flow, not a standalone page.
- **AI floor item detection requires the existing floor item settings UI.** Detection is only useful if confirming a suggestion can pre-fill the existing floor item form. Tight integration, not a separate flow.
- **Merchant memory enhances AI Q&A** — they can ship independently, but merchant memory without Q&A is useless. Q&A without memory works but repeats questions on every import.
- **Dark mode has zero dependencies** — it is an independent visual layer; implement in isolation.
- **History filter has no dependencies on new features** — it works against the existing `history[]` array in `allocationStore`. Adding client name to `AllocationRecord` before implementing the filter is advisable so the client filter is functional at launch, but it is not a hard blocker.

---

## MVP Definition for v1.1

All five feature areas ship together as the v1.1 milestone. No features are deferred.

### Launch With (v1.1)

- [x] Dark mode toggle (persisted via localStorage) — lowest complexity, zero dependencies, high visibility
- [x] Invoice "from" field (optional) — minimal addition to InvoiceForm + AllocationRecord type
- [x] Client name in history — display-only change to HistoryPage
- [x] History search/filter — date range + client text search + amount range, all in-memory
- [x] AI transaction Q&A + merchant memory — extends existing CSV analysis flow
- [x] AI floor item detection — extends existing CSV analysis; pre-fills floor item form

### Add After Validation (v1.x)

- [ ] Merchant memory management UI (view/delete entries) — only if users report stale/wrong memory
- [ ] History export to CSV — natural next step after filter
- [ ] Client analytics (total received per client over time) — needs multiple data points first

### Future Consideration (v2+)

- [ ] Transaction-level expense tracking — major scope expansion beyond current model
- [ ] Budget vs actuals comparison — requires bank sync or manual transaction entry
- [ ] Recurring expense auto-scheduling — predict next invoice based on history

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dark mode | MEDIUM | LOW | P1 — polish, easy win, high visibility |
| Invoice "from" field | MEDIUM | LOW | P1 — unlocks client filter |
| Client name in history | MEDIUM | LOW | P1 — direct display of "from" field |
| History filter (date + client + amount) | HIGH | MEDIUM | P1 — frequently-used affordance |
| AI transaction Q&A + merchant memory | HIGH | HIGH | P1 — core differentiator of v1.1 |
| AI floor item detection + pre-fill | HIGH | HIGH | P1 — direct action value (saves setup time) |

All six feature areas are P1 for v1.1. No P2/P3 items in v1.1 scope.

---

## Competitor Feature Analysis

| Feature | YNAB | Copilot Money | Lunch Money | Money Flow v1.1 Approach |
|---------|------|----------------|-------------|--------------------------|
| Uncertain transaction handling | Manual categorize + payee renaming rule created on edit; no "ask me" dialog | Prompts to create rule when you recategorize; "Copilot Intelligence" per-user ML model (cloud) | Manual category assignment; no AI Q&A | LLM identifies low-confidence transactions and presents a targeted Q&A dialog; answers persist as local merchant memory |
| Merchant-to-category memory | Payee rename rules (invisible after creation; cannot be viewed or managed; user complaints documented) | Per-user ML model (cloud, not local) + explicit name rules | No automatic learning | Local `merchantMemory` map in FSA-backed settings JSON; applied before LLM call; user corrections update memory |
| Recurring expense detection | None built-in; requires manual floor/subscription tracking | None | None | LLM-assisted heuristic: group by normalized merchant name, check monthly frequency (25-35 day intervals) and amount consistency (<20% variance), threshold 3+ occurrences |
| History filter | Full transaction search: payee, date, memo, amount | Search + date range filters | Filter by category, merchant, date, tags | In-memory filter on `history[]`: preset date ranges + custom, client text search, amount min/max |
| Dark mode | Yes | Yes | Yes | `@custom-variant dark` (Tailwind v4), `.dark` class on `<html>`, localStorage persisted, falls back to `prefers-color-scheme` for first visit |

---

## Implementation Notes by Feature

### 1. AI Transaction Q&A + Merchant Memory

**What "uncertain" means:** A transaction where the LLM cannot confidently assign a bucket based on merchant name and amount alone. Signals: generic merchant names ("Transfer", "Online payment"), amounts that span multiple categories, new merchants not in memory.

**Recommended flow:**
1. After CSV upload, LLM receives full transaction list plus existing `merchantMemory`
2. LLM response includes two arrays: `confident[]` (auto-assigned) and `uncertain[]` (needs user input)
3. User sees a dialog: uncertain transactions presented as a scrollable form, each with suggested bucket and a free-text note field
4. On submit, answers are saved: `merchantMemory[normalizedMerchant] = { bucket, lastSeen: today }`
5. On next import, pre-populated assignments are shown in a "review" state rather than asking again

**Storage:** Add `merchantMemory` key to the settings JSON file (FSA-backed). Structure:
```typescript
type MerchantMemory = Record<string, { bucket: string; note?: string; lastSeen: string }>;
```

**LLM prompt design is the highest-risk part.** The storage and UI patterns are well-understood. The prompt must produce a structured JSON response distinguishing confident from uncertain transactions. Needs careful prompt engineering and possibly a small validation layer.

**Confidence level:** MEDIUM — pattern is emerging (Expensify does something similar for B2B expense management; no direct consumer personal finance app does this locally).

### 2. AI Floor Item Detection

**Detection algorithm (heuristic, LLM-assisted):**
- Group CSV transactions by normalized merchant name (lowercase, strip trailing numbers/dates)
- For each group: count occurrences, compute median amount, compute inter-transaction intervals
- Flag as "recurring candidate" if: count >= 3, median interval 25-35 days (monthly), amount variance <= 20%
- Pass candidates to LLM for labeling (LLM names the floor item, suggests amount)
- Present as a dismissible suggestion list; "Add as floor item" pre-fills the existing floor item form

**Key integration point:** The floor item form is in `src/features/settings/`. The detection output must navigate to settings and pass pre-fill data. Use Zustand ephemeral state or router search params to carry pre-fill context.

**Heuristic thresholds (25-35 day window, 20% variance) are starting-point estimates** derived from industry research (Subaio, Plaid recurring detection). May need tuning. Flag for phase-specific validation.

**Confidence level:** MEDIUM — core algorithm is well-documented in fintech literature; threshold values are approximate.

### 3. Invoice "from" Field

**Minimal change:**
- Add optional `clientName?: string` to `AllocationRecord` type in `src/types/domain.ts`
- Add optional text input to `InvoiceForm.tsx` (below currency, above submit button)
- Pass through `clientName` to `appendAllocation` call
- Display in `HistoryPage.tsx` collapsed row alongside date and mode badge

**Backward compatibility:** `clientName` is optional; existing history records without it render without a client badge. No migration needed.

### 4. History Search/Filter

**Implementation pattern (in-memory, no library needed):**
```typescript
const filtered = history.filter(r => {
  if (dateFrom && r.date < dateFrom) return false;
  if (dateTo && r.date > dateTo) return false;
  if (clientQuery && !r.clientName?.toLowerCase().includes(clientQuery.toLowerCase())) return false;
  if (amountMin && r.invoiceEurEquivalentCents < amountMin * 100) return false;
  if (amountMax && r.invoiceEurEquivalentCents > amountMax * 100) return false;
  return true;
});
```

**UI:** Filter bar above history list. Preset date range buttons ("This month", "Last 3 months", "All time") + optional custom date inputs. Client text input. Amount min/max in euros. "Clear filters" button. Active filter count badge when filters are applied.

**No new library needed.** `history[]` is in memory, filtering is synchronous, shadcn/ui provides all needed input components.

### 5. Dark Mode

**Tailwind v4 approach (HIGH confidence — verified against official docs):**

Add to `src/index.css`:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

**Toggle hook:**
```typescript
// useDarkMode hook
const [dark, setDark] = useState(() => {
  const saved = localStorage.getItem('theme');
  if (saved) return saved === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
});
useEffect(() => {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}, [dark]);
```

**shadcn/ui compatibility:** shadcn/ui New York variant uses CSS custom properties for all colors; dark mode overrides are already present in the default CSS variables. Adding the `@custom-variant dark` directive and toggling `.dark` on `<html>` activates them without touching component files.

**Persistence:** `localStorage` (not FSA). UI preference is not financial data; localStorage is appropriate, survives FSA permission loss, zero quota concerns.

---

## Phasing Recommendation

Given dependencies and relative complexity:

| Phase | Features | Rationale |
|-------|----------|-----------|
| Phase A — Quick wins | Dark mode + Invoice "from" field + Client in history + History filter | Zero or minimal dependencies; low-to-medium complexity; high visibility. Establishes client name in `AllocationRecord` before the filter needs it. |
| Phase B — AI layer | AI transaction Q&A + Merchant memory + AI floor item detection | All extend the existing CSV import flow; high complexity; ship together to avoid a half-finished AI layer that asks questions but does not remember answers. |

This ordering ships usable improvements immediately without blocking on the higher-risk AI work.

---

## Sources

- [YNAB: Categorizing Transactions Guide](https://support.ynab.com/en_us/categorizing-transactions-a-guide-HyRl60sks) — MEDIUM confidence
- [YNAB: How to Rename Payees (renaming rules)](https://support.ynab.com/en_us/how-to-rename-payees-BkotNUSyo) — MEDIUM confidence
- [Copilot Money: Transaction Name Rules](https://help.copilot.money/en/articles/3971270-transaction-name-rules-for-categorization) — HIGH confidence (official docs, verified via WebFetch)
- [Copilot Money Changelog: Copilot Intelligence ML system](https://changelog.copilot.money/log/transaction-category-rules) — MEDIUM confidence
- [Lunch Money: Transaction Enhancements](https://support.lunchmoney.app/finances/transactions/transaction-enhancements) — HIGH confidence (official docs, verified via WebFetch)
- [Subaio: How Recurring Payments Are Detected](https://subaio.com/subaio-explained/how-does-subaio-detect-recurring-payments) — MEDIUM confidence (official vendor page, verified via WebFetch; 98.7% accuracy figure is self-reported)
- [Plaid: Recurring Transactions](https://plaid.com/blog/recurring-transactions/) — MEDIUM confidence (official Plaid blog)
- [Tailwind CSS v4: Dark Mode](https://tailwindcss.com/docs/dark-mode) — HIGH confidence (official docs, verified via WebFetch)
- [Expensify: AI Expense Management — uncertain transaction clarification UX](https://use.expensify.com/ai-expense-management) — LOW confidence (WebSearch only, B2B context not directly comparable)
- Industry pattern: in-memory compound filter (date + text + amount) — HIGH confidence (standard React pattern, multiple sources consistent)

---

*Feature research for: Money Flow v1.1 AI-Powered Insights milestone*
*Researched: 2026-02-28*
