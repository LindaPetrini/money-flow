# Project Research Summary

**Project:** Money Flow v1.1 — AI-Powered Insights
**Domain:** Local-first browser app — freelance budget allocator with AI-assisted CSV analysis
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

Money Flow v1.1 adds five capability clusters to an already-shipped v1.0 product: dark mode, invoice source tracking, history search/filter, AI transaction Q&A with merchant memory persistence, and AI floor item detection from CSV. The existing stack (Vite 7 + React 19 + TypeScript + Tailwind v4 + Zustand 5 + FSA/IDB + Anthropic direct browser fetch) covers all v1.1 requirements without any new npm dependencies. Every new feature builds on established patterns already proven in v1.0, and the architecture docs confirm these patterns through direct codebase inspection rather than inference.

The recommended approach is a three-phase build ordered by dependency. Phase 1 establishes schema foundations and the merchant store that later phases require. Phase 2 ships four high-visibility, low-risk features — dark mode, invoice source field, client display in history, and history filter — before any AI complexity is introduced. Phase 3 adds the AI Q&A pipeline and floor item detection as a single cohesive unit, ensuring merchant memory and conversation context are properly connected. This ordering means usable v1.1 improvements are available as soon as Phase 2 completes, while Phase 3 can be developed and tested without destabilizing already-working features.

Key risks concentrate in Phase 3. The AI Q&A flow involves multi-turn conversation state management, Anthropic API token budget concerns, and an interaction between Q&A context and floor item detection that must be architecturally planned upfront. Two lower-risk but easy-to-miss bugs sit in Phase 1 and Phase 2: the AllocationRecord schema change silently breaks filter predicates for pre-v1.1 history records (fixed with a 1-line read-time migration), and the Tailwind v4 `@custom-variant dark` selector in `index.css` must be updated from `(&:is(.dark *))` to `(&:where(.dark, .dark *))` to include the root element itself.

## Key Findings

### Recommended Stack

The v1.0 stack requires zero new npm dependencies for all v1.1 features. Dark mode is handled by Tailwind v4's CSS-first `@custom-variant dark` mechanism combined with a `localStorage`-backed toggle and an inline `<head>` script to prevent flash of wrong theme. AI streaming for conversational Q&A turns uses raw `fetch` + `ReadableStream` (the same pattern as the existing `anthropicClient.ts`), avoiding the ~100kB `@anthropic-ai/sdk` package. History filter uses `useMemo` + `Array.filter` — no search library needed at personal-app data volumes. Merchant label persistence follows the established `storage.write(key, data)` pattern that all existing stores use, creating a new `merchants.json` file via the FSA driver or a new key in IDB.

**Core technologies (all existing, confirmed unchanged):**
- Vite 7 + React 19 + TypeScript: app build, no change
- Tailwind v4 + shadcn/ui New York: dark mode styles already declared in `index.css`; `.dark {}` OKLCH token block already present; only the CSS selector and a toggle mechanism need to be added
- Zustand 5: one new store (`merchantStore`); `settingsStore` gets a `theme` field and `applyTheme()` side-effect
- FSA + IDB (`idb 8`) via `storage.ts`: new `merchants` key added transparently; no driver changes needed
- Anthropic direct browser fetch: two new call functions added to `anthropicClient.ts`; streaming added for Q&A turns; structured JSON schema retained for batch analysis calls
- `localStorage`: used for theme preference only (UI state, not financial data — appropriate to keep separate from FSA)

### Expected Features

**Must have (table stakes for v1.1):**
- Dark mode toggle — absence is jarring in any 2025 app; styles already in codebase, only the toggle mechanism is missing
- History date range filter — universal expectation for finance apps
- History text search — standard for any list longer than ~10 items
- Client name visible in history — once the "from" field is recorded on invoice entry, users expect to see it

**Should have (competitive differentiators):**
- AI transaction Q&A with merchant memory — local, learning system; no competitor does this client-side; turns one-shot AI into a system that improves per import
- AI floor item detection from CSV — translates passive import data into actionable settings configuration; saves manual floor setup; no direct competitor for local-first personal finance
- Invoice "from" (client/project) field — unlocks all client tracking features; minimal implementation

**Defer to v2+:**
- Merchant memory management UI (view/edit/delete entries) — only if users report stale labels
- History export to CSV — natural next step, not blocking anything
- Client analytics (totals per client over time) — needs multiple data points to be useful
- Transaction-level expense tracking — major scope expansion beyond current model

**Explicit anti-features (do not add):**
- Silent auto-categorization of all transactions — breaks the transparency that is Money Flow's core value proposition
- Mandatory client name field — freelancers paid via Stripe/PayPal have no "client" concept
- Complex AND/OR filter logic — disproportionate complexity for ~50-200 history records

### Architecture Approach

v1.1 integrates cleanly into the existing four-layer architecture (React UI → Zustand stores → StorageDriver → FSA/IDB). No new architectural patterns are introduced. The two AI sub-features (Q&A and floor detection) both extend `CsvAiSection.tsx` and share the `merchantStore`. Cross-section communication for floor item pre-fill uses plain lifted state in `SettingsPage` (the natural common parent), not a new store or context. All new persisted schema fields use optional TypeScript types with nullish-coalescing defaults to guarantee backward compatibility with existing JSON files on disk.

**New and modified components:**
1. `merchantStore.ts` (new) — `MerchantEntry[]` persisted under `'merchants'` key; load/upsert/lookup API
2. `TransactionQACard.tsx` (new) — renders one uncertain transaction + context input + bucket selector for Q&A loop
3. `HistoryFilters.tsx` (new) — collapsible filter panel (date range, client/source, amount min/max)
4. `anthropicClient.ts` (modified) — two new functions: `callUncertainTransactionDetection()` and `callFloorItemDetection()`; existing `callAnthropicAPI()` enriched with Q&A context parameter
5. `CsvAiSection.tsx` (modified) — Q&A state machine, merchant pre-classification before Q&A, floor item detection section, `onFloorItemSuggested` callback prop
6. `SettingsPage.tsx` (modified) — `pendingFloorItem` lifted state passed to `CsvAiSection` (producer) and `FloorItemsSection` (consumer)
7. `settingsStore.ts` (modified) — `applyTheme()` side-effect on `loadSettings` and `updateSettings`; `Settings.theme` field
8. `HistoryPage.tsx` (modified) — `HistoryFilters` component, `useMemo` derived filtered list, `record.source` in collapsed rows
9. `domain.ts` (modified) — `AllocationRecord.source?: string`, `Settings.theme?: ...`, new `MerchantEntry` type
10. `App.tsx` (modified) — theme toggle in header; `loadMerchants()` added to startup sequence

### Critical Pitfalls

1. **Tailwind v4 `@custom-variant dark` wrong selector** — `(&:is(.dark *))` (current in `index.css`) excludes the root element itself; fix to `(&:where(.dark, .dark *))` as the very first commit of the dark mode phase. Silent failure: `dark:` utilities on `<html>` or `<body>` do nothing with the wrong selector.

2. **Flash of wrong theme on page load (FOUC)** — any React-only dark mode implementation (useState, useEffect, useLayoutEffect) causes a visible flash before dark background appears. Prevention: inject a 5-line inline script in `index.html` `<head>` that runs synchronously before first paint. There is no React-only fix.

3. **AllocationRecord schema migration missing** — adding optional `source?: string` to the type is backward-compatible in TypeScript but `undefined !== ''` breaks filter predicates for old records. Fix: 1-line read-time migration in `allocationStore.loadHistory()` — `raw.map(r => ({ source: '', ...r }))`. Does not rewrite disk files. Must be added simultaneously with the field addition.

4. **New merchant store writes empty state before FSA is ready** — stores added without the `if (!get().initialized) return` guard overwrite previously-saved merchant memory with empty data on every app reload. Every write in `merchantStore` must be guarded; `loadMerchants()` must be added to `bootstrap.ts`.

5. **AI token budget and Q&A/floor detection context conflict** — `max_tokens: 2048` (current hardcoded value) is insufficient for Q&A responses enumerating 20+ uncertain transactions; use `max_tokens: 8192` for Q&A calls. Floor detection must run after Q&A and receive Q&A context in its system prompt to avoid re-flagging transactions the user already clarified.

## Implications for Roadmap

Based on combined research, a three-phase structure is recommended. Dependencies are the primary ordering constraint.

### Phase 1: Schema Foundation + Merchant Store

**Rationale:** All v1.1 features depend on the new types being present. `merchantStore` must exist before the AI Q&A phase can use it. This phase has zero UI surface area and no user-visible output — it is pure infrastructure that unblocks everything else.

**Delivers:** All modified types in `domain.ts` and `persistence.ts`; `merchantStore.ts` with full load/upsert/lookup implementation; `loadMerchants()` wired into app startup.

**Addresses:** `AllocationRecord.source?: string`, `Settings.theme?: ...`, `MerchantEntry` type, `PersistedMerchants` type alias.

**Avoids pitfalls:** Merchant store init race (Pitfall 4 — `initialized` guard built in from the start); backward-compatible optional fields on persisted types prevent runtime crashes on existing user data.

### Phase 2: Quick Wins — Dark Mode, Invoice Source, Client History Display, History Filter

**Rationale:** These four features are independent of each other and of the AI work. They depend only on the types from Phase 1. Shipping them before Phase 3 delivers visible value immediately and keeps Phase 3 development isolated from already-working features. Dark mode and history filter are the two highest-visibility features by user perception.

**Delivers:** Three-state dark mode toggle in header (light/dark/system, persisted via `localStorage`, no FOUC); optional "From (client/project)" field on invoice entry; client name displayed in history collapsed rows; filter panel above history list (date range, client search, amount min/max) with `useMemo`-derived result.

**Addresses:** All six table-stakes features from FEATURES.md. All four P1 low-complexity items shipped before touching high-complexity AI work.

**Avoids pitfalls:** Tailwind `@custom-variant` selector fix (Pitfall 1 — first commit of this phase); FOUC prevention via `index.html` inline `<head>` script (Pitfall 2); AllocationRecord read-time migration (Pitfall 3 — added with `source` field simultaneously); `useMemo` + local `useState` for filter state, not Zustand (Pitfall 6).

### Phase 3: AI Layer — Transaction Q&A, Merchant Memory, Floor Item Detection

**Rationale:** The most complex state. Depends on `merchantStore` from Phase 1. Both AI features share the CSV import flow in `CsvAiSection` and must be designed as a pipeline (Q&A first, floor detection second, passing Q&A context forward) to avoid duplicate flagging. Shipping them together prevents a half-finished AI layer that asks questions but does not remember answers.

**Delivers:** Multi-turn Q&A dialog during CSV import (uncertain transactions identified in one batch call, answered through pure UI loop, results persisted to `merchantStore`); merchant pre-classification on future imports (known merchants skip Q&A); floor item detection trigger after main analysis with suggestions pre-filling the floor item form in `FloorItemsSection`; `callUncertainTransactionDetection()` and `callFloorItemDetection()` added to `anthropicClient.ts`; streaming via raw `fetch` + `ReadableStream` for conversational turns.

**Addresses:** Both "differentiator" features from FEATURES.md (AI Q&A + merchant memory, AI floor detection). These are the v1.1 competitive features.

**Avoids pitfalls:** Token budget (`max_tokens: 8192` for Q&A calls, not 2048 — Pitfall 4 from PITFALLS.md); Q&A/floor detection context handoff (Pitfall 7 — floor detection runs after Q&A and receives clarification context); batch detection strategy (2 API calls total per CSV session, not N+1).

### Phase Ordering Rationale

- Phase 1 must precede both Phase 2 and Phase 3: all new types live in Phase 1. Phase 2 needs `AllocationRecord.source` and `Settings.theme`. Phase 3 needs `MerchantEntry` and the store.
- Phase 2 is independent of Phase 3: history filter does not depend on merchant memory; dark mode does not depend on Q&A. Shipping Phase 2 before Phase 3 means these features are available to users even if Phase 3 takes longer or requires iteration.
- Phase 3 is a single unit: merchant memory without Q&A is useless; Q&A without merchant memory repeats questions every import; floor detection without Q&A context produces lower-quality suggestions.
- FEATURES.md's "Phase A / Phase B" grouping maps exactly to Phase 2 / Phase 3 in this structure, and ARCHITECTURE.md's recommended build order ("Phase 1 / Phase 2 / Phase 3") is identical. High convergence across research files increases confidence.

### Research Flags

Phases with standard, well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1 (Schema Foundation):** Adding optional fields to TypeScript types with nullish-coalescing defaults is a standard pattern; `merchantStore` follows the exact same structure as the existing `accountStore.ts`. All implementation details are fully resolved in ARCHITECTURE.md.
- **Phase 2 (Quick Wins):** Dark mode via Tailwind v4 `@custom-variant` is verified against official docs. History filter with `useMemo` is a standard React pattern. All implementation details are fully specified in STACK.md, FEATURES.md, and ARCHITECTURE.md.

Phases needing careful design attention during planning:
- **Phase 3 (AI Layer):** The Q&A state machine (`QAPhase` discriminated union in `CsvAiSection`) and the data handoff between Q&A answers and the floor detection prompt are the highest-risk design decisions. The Anthropic JSON schema for `callUncertainTransactionDetection()` response shape needs careful design — this is the part most likely to require prompt iteration during development. PITFALLS.md identifies this as the highest-risk component; allocate extra testing time.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings based on official docs + direct codebase inspection. Zero new dependencies confirmed. Streaming implementation pattern verified against Anthropic official API docs. |
| Features | MEDIUM-HIGH | Table-stakes features and dark mode are HIGH confidence (official docs, multiple sources consistent). AI Q&A UX patterns are MEDIUM confidence (Expensify comparison is B2B, not personal finance; no direct local-first competitor to benchmark against). |
| Architecture | HIGH | Based on direct inspection of all relevant source files. Component boundaries and data flow patterns observed from live code, not inferred. All four feature integrations have complete, concrete implementation plans. |
| Pitfalls | HIGH | All seven critical pitfalls are grounded in direct codebase inspection or verified API behavior. Recovery strategies are concrete and low-cost. |

**Overall confidence:** HIGH

### Gaps to Address

- **AI Q&A prompt engineering:** The JSON schema for `callUncertainTransactionDetection()` is the highest unknown. FEATURES.md flags "LLM prompt design is the highest-risk part" of this feature. During Phase 3 execution, allocate iteration time for prompt tuning. The heuristic approach (separate confident/uncertain response arrays) is sound; the exact prompt wording needs testing.

- **Recurring expense detection thresholds:** FEATURES.md cites industry sources (Subaio, Plaid) for the 25-35 day monthly interval window and 20% amount variance threshold. These are documented starting points that may need adjustment for Dutch bank CSV formats (ING, Rabobank, ABN AMRO). Flag for post-Phase-3 validation.

- **Hardcoded color classes throughout existing components:** PITFALLS.md notes that hardcoded Tailwind color classes like `bg-amber-50` (IDB notice banner) and mode badges (`bg-amber-100`, `bg-emerald-100`) will not automatically respond to the `.dark` toggle — they need explicit `dark:` variants added. A sweep of all hardcoded color classes is needed during Phase 2 execution. These are "looks done but isn't" items.

## Sources

### Primary (HIGH confidence)
- Tailwind CSS v4 official docs (https://tailwindcss.com/docs/dark-mode) — `@custom-variant dark` syntax, `:where()` selector recommendation, three-state localStorage pattern
- Anthropic Messages Streaming API official docs (https://platform.claude.com/docs/en/api/messages-streaming) — SSE event flow, `stream: true`, fetch + ReadableStream pattern
- Anthropic Messages API reference (https://docs.anthropic.com/en/api/messages) — multi-turn messages array, API statefulness model
- Anthropic Models overview (https://platform.claude.com/docs/en/about-claude/models/overview) — claude-haiku-4-5-20251001 context window (200K) and output limit (64K)
- Direct codebase inspection: `src/index.css`, `src/lib/storage/storage.ts`, `src/lib/storage/idbDriver.ts`, `src/lib/anthropicClient.ts`, `src/stores/allocationStore.ts`, `src/types/domain.ts`, `src/types/persistence.ts`, `App.tsx`, `CsvAiSection.tsx`, `HistoryPage.tsx`, `InvoicePage.tsx`, `InvoiceForm.tsx`

### Secondary (MEDIUM confidence)
- Copilot Money changelog (https://changelog.copilot.money) — transaction category rules, ML categorization
- Lunch Money docs (https://support.lunchmoney.app) — transaction categorization UX patterns
- Subaio recurring payment detection (https://subaio.com/subaio-explained) — 25-35 day interval threshold, 98.7% accuracy figure is self-reported
- Plaid recurring transactions blog (https://plaid.com/blog/recurring-transactions/) — recurring transaction detection approach
- YNAB payee rename rules docs — merchant memory UX patterns and known limitations

### Tertiary (LOW confidence)
- Expensify AI expense management (https://use.expensify.com/ai-expense-management) — B2B uncertain transaction clarification UX; not directly comparable to personal finance local-first context

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
