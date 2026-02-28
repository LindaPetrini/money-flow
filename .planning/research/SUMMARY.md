# Project Research Summary

**Project:** Money Flow — Freelance Budget Allocator
**Domain:** Local-first browser finance allocation app (single-user, no backend)
**Researched:** 2026-02-27
**Confidence:** HIGH (stack and architecture), MEDIUM (features competitive analysis)

## Executive Summary

Money Flow is a local-first, single-page React application with no backend, no authentication, and no server state. The product's central premise — an invoice event triggers an auto-detected allocation mode (Stabilize or Distribute), which produces transparent, itemized move instructions — has no direct equivalent in the existing market. Every competitor (YNAB, Goodbudget, Actual Budget) models income as a pool to budget from, not as a triggering event with a decision tree. This novelty means the core allocation engine must be designed with precision and tested in full isolation, since it is both the primary differentiator and the highest-complexity piece of the system.

The recommended approach is a modern Chromium-targeted stack: Vite 7 + React 19 + TypeScript + Tailwind v4 + shadcn/ui (New York) + Zustand 5 (no persist middleware) + File System Access API with IndexedDB as fallback. All money arithmetic must use integer cents throughout — floating-point money math is the single most dangerous implementation mistake in this domain. The FSA + IDB persistence model is well-documented and delivers the privacy and local-first story that is a core product value. The architecture must enforce a strict layering: pure domain logic (no React imports) in a separate `domain/` directory, three narrow Zustand stores, and a storage driver abstraction that keeps FSA/IDB complexity contained.

The critical risks center on the Phase 1 foundation: FSA permission management is non-obvious (permissions do not persist across sessions without explicit `queryPermission` → `requestPermission` logic on every startup), and a single floating-point leak in the cents layer will produce incorrect allocation outputs. Both must be solved correctly at the start and tested before any UI is built. AI CSV analysis (P2) introduces a security risk if the Anthropic API key is ever embedded in the bundle — it must be runtime-entered by the user and stored in sessionStorage only. With the foundation correct, the subsequent UI phases follow a natural dependency graph and use well-documented patterns.

---

## Key Findings

### Recommended Stack

The stack is modern, internally consistent, and well-matched to a local-first single-user app. There is no routing library (Zustand state drives view switching), no server-state library (no server), and no Zustand persist middleware (FSA/IDB handles persistence explicitly). The Tailwind v4 + shadcn/ui New York + Vite 7 combination requires exact setup steps — particularly `"config": ""` in `components.json`, the `@tailwindcss/vite` plugin (not PostCSS), and `tw-animate-css` (not the deprecated `tailwindcss-animate`). Version pinning is critical: `@tailwindcss/vite` must match Tailwind major.minor, and `@testing-library/react` must be v16+ for React 19 compatibility.

**Core technologies:**
- Vite 7.3.1: build tool — fastest HMR, ESM-only, required for Vitest 4 integration; Node 20.19+ required
- React 19.2.4: UI framework — concurrent rendering, new hooks, required by shadcn/ui New York on Tailwind v4
- TypeScript 5.7+: type safety — strict mode essential for money-math type integrity (`Cents` type alias)
- Tailwind CSS 4.2.1 + @tailwindcss/vite: CSS-first utility styling — no `tailwind.config.js`, `@theme` in CSS only
- shadcn/ui (latest CLI, New York): component library — components copied into project, OKLCH colors, no ForwardRef
- Zustand 5.0.11: client UI state — zero provider, no persist middleware, `useShallow` required for object selectors
- idb 8.0.3: IndexedDB wrapper — used exclusively for FSA handle persistence and config fallback
- File System Access API (browser-native): primary persistence — human-readable JSON files, survives cache clears
- Vitest 4.0.18: test runner — Vite-native, Jest-compatible API, `reporters: ['default']` (not 'basic')

### Expected Features

The MVP is well-scoped and internally consistent. The Stabilize/Distribute auto-detection is the highest-complexity feature and must be built before any UI is useful — it depends on floor items, account balances, and buffer targets all being configured. AI CSV analysis is explicitly P2: valuable for onboarding but not on the critical path. Anti-features (no bank sync, no exchange-rate API, no forecasting) are load-bearing scope decisions that must be documented.

**Must have (table stakes):**
- Account balance dashboard with visual at-a-glance status indicators
- Inline balance editing (manual — no bank sync)
- Invoice entry with amount, currency, and EUR equivalent
- Auto-detected Stabilize vs. Distribute mode (derived from state, never toggled)
- Stabilize mode: priority-ordered floor item coverage instructions
- Distribute mode: exact cent amounts per overflow bucket
- Per-move calculation display (rule + arithmetic + reason — transparency is mandatory)
- Allocation confirmation ("Done") with atomic balance updates
- Allocation history log (append-only: date, invoice, mode, all moves)
- Floor item configuration (name, amount, priority, optional expiry)
- Tax bucket (% of invoice, dedicated account destination)
- Overflow bucket ratios (% splits summing to 100%)
- Monthly reset (clear coverage flags, preserve balances and history)
- Local persistence via File System Access API + IndexedDB fallback

**Should have (competitive differentiators, P2):**
- AI-assisted bucket sizing from user CSV history — with full reasoning transparency per suggestion
- Floor item expiry dates (auto-deactivate temporary expenses)
- Multi-currency invoice UX polish
- Export allocation history to CSV

**Defer (v2+):**
- Recurring floor items with auto-reset
- Budget target forecasting
- Dark mode
- Undo/redo (history log + manual edits are the correction mechanism)

### Architecture Approach

The architecture follows a strict four-layer model: UI feature modules → Zustand stores → pure domain logic → storage drivers. The allocation engine (`domain/allocationEngine.ts`) is a pure TypeScript function with zero React dependencies — callable from Vitest in a Node environment without a browser. The storage layer uses a driver abstraction (`lib/storage/storage.ts`) that presents an identical `read/write` interface whether FSA or IDB is active. Three narrow Zustand stores (`accountStore`, `allocationStore`, `settingsStore`) prevent cross-domain re-render cascades. All money crosses the system boundary as integer cents: `parseCents` on input, `formatCents` on output, no division or multiplication anywhere except inside `lib/cents.ts`.

**Major components:**
1. `lib/cents.ts` — single boundary for all money arithmetic; `parseCents`, `formatCents`, `pctOf`, `splitCents` (largest-remainder)
2. `lib/storage/` — driver abstraction with `fsaDriver.ts` (FSA) and `idbDriver.ts` (fallback); stores never call FSA/IDB directly
3. `domain/allocationEngine.ts` — pure Stabilize/Distribute logic; `detectMode`, `computeAllocation`, `stabilize`, `distribute`
4. `stores/` — three Zustand stores (account, allocation, settings); explicit `storage.write()` on mutations, no persist middleware
5. `features/` — React components per domain area (dashboard, invoices, accounts, buckets, history, csv-import)
6. `types/domain.ts` + `types/persistence.ts` — shared type definitions that prevent circular imports

### Critical Pitfalls

1. **FSA permission revoked each session** — `queryPermission()` → `requestPermission()` must run on every startup inside a user gesture; retrieving the handle from IDB does not restore permission. Never assume `granted`.

2. **Float leaking through the cents layer** — `parseFloat("19.99") * 100 = 1998.9999...`. Use `Math.round(parseFloat(input) * 100)` in `parseCents`. Distribution splits require a largest-remainder algorithm (`splitCents`) so bucket totals always equal the invoice amount exactly.

3. **Zustand write before FSA load completes** — stores start empty; any write before async load finishes overwrites the saved file with empty data. Guard all write paths with an `initialized` flag that is set only after all stores have loaded from storage.

4. **Background-tab permission auto-revocation** — Chrome revokes FSA write permission on backgrounded tabs. Every FSA write needs `try/catch` for `NotAllowedError` with graceful re-prompt.

5. **AI API key in client bundle** — `VITE_ANTHROPIC_API_KEY` in `.env` is bundled and visible in source. User must enter the key at runtime via a settings form; store in `sessionStorage` or `localStorage` only, never in env vars, FSA files, or committed to git.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and complexity analysis from FEATURES.md and PITFALLS.md, the natural phase structure is:

### Phase 1: Foundation (Scaffold + Persistence + Money Math)
**Rationale:** Everything else depends on these three pieces. A floating-point bug in cents or a broken FSA permission flow will corrupt data silently. Getting these right first, with tests, is the risk-mitigation strategy.
**Delivers:** Working project scaffold, verified FSA + IDB persistence layer with correct permission lifecycle, `parseCents`/`formatCents`/`splitCents` with unit tests proving correctness, `initialized` guard on all write paths.
**Addresses:** Account configuration setup (prerequisite for all workflow features).
**Avoids pitfalls:** FSA permission revoked each session (#1), Float leaking through cents layer (#3), Zustand write before FSA load (#4), Background-tab revocation (#2), Tailwind v4/shadcn config mismatches (#6).
**Research flag:** Standard patterns — skip phase research. FSA permission pattern, cents architecture, and Tailwind v4 setup are all well-documented in STACK.md and PITFALLS.md.

### Phase 2: Domain Logic (Allocation Engine)
**Rationale:** The allocation engine is the core differentiator and highest-complexity piece. It must be built and tested as pure TypeScript before any UI consumes it. Isolating it here prevents domain logic from leaking into components.
**Delivers:** `domain/allocationEngine.ts` (mode detection, stabilize, distribute), `domain/floorCalculator.ts`, `domain/modeDetection.ts`, Vitest unit tests covering all edge cases (invoice smaller than tax, invoice covers tax but not all floors, distribute with uneven ratios).
**Addresses:** Stabilize/Distribute auto-detection, per-move calculation with reason, floor item coverage logic.
**Avoids pitfalls:** Domain logic in components (#AP5 from ARCHITECTURE anti-patterns), float leaking in distribution splits (largest-remainder `splitCents`).
**Research flag:** Standard patterns — skip phase research. Pure function testing with Vitest is well-documented.

### Phase 3: Core UI (Dashboard + Invoice Workflow)
**Rationale:** With persistence and domain logic verified, the primary user-facing workflow can be assembled. This phase delivers the minimum useful product: enter an invoice, see move instructions, confirm, check balances.
**Delivers:** Account balance dashboard with visual status indicators, invoice entry form, allocation result view (move instructions with per-move calculation display), "Done" confirmation with atomic balance update and history append, account management (add/edit/inline balance edit).
**Addresses:** Invoice-triggered allocation workflow, per-move transparency, allocation confirmation, account balance dashboard, visual status indicators.
**Avoids pitfalls:** Multi-tab state divergence (#5) — add BroadcastChannel notification.
**Research flag:** Standard patterns — skip phase research. shadcn/ui component usage and Zustand store binding are well-documented.

### Phase 4: Configuration UI (Buckets + Settings)
**Rationale:** The allocation engine is useless without configured floor items, overflow ratios, and tax bucket. This phase makes the engine configurable through UI rather than hardcoded defaults.
**Delivers:** Floor item editor (name, amount, priority, expiry), overflow ratio configuration with 100%-sum validation, tax bucket configuration (% of invoice, destination account), monthly reset action.
**Addresses:** Budget bucket configuration, floor item expiry dates, overflow/surplus distribution ratios, tax withholding bucket, monthly reset.
**Avoids pitfalls:** None new — relies on initialized FSA layer from Phase 1.
**Research flag:** Standard patterns — skip phase research.

### Phase 5: History
**Rationale:** Allocation confirmation already appends to the history log (from Phase 3), but the history view and full allocation detail display are deferred here to keep Phase 3 focused on the primary workflow.
**Delivers:** History list view (date, invoice amount, mode), allocation detail view (all moves for a single allocation event), append-only log verified across sessions.
**Addresses:** History log of past allocations, audit trail.
**Research flag:** Standard patterns — skip phase research.

### Phase 6: CSV Import + AI Analysis
**Rationale:** P2 feature with external API dependency. Must be last among core features because no other phase depends on it, and it introduces the only external network call and the only security-sensitive input (API key).
**Delivers:** CSV upload with format auto-detection (BOM, delimiter, decimal separator), Papa Parse integration with bank-specific adapters, Anthropic API client (runtime API key, stored in sessionStorage only), AI suggestion display with per-suggestion reasoning, accept/adjust/ignore flow that writes to settingsStore.
**Addresses:** AI-assisted bucket sizing, reasoning transparency per suggestion, multi-currency polish.
**Avoids pitfalls:** CSV format inconsistencies (#7) — Papa Parse with BOM handling and adapter pattern. AI API key in client bundle (#8) — runtime input only, never in env vars.
**Research flag:** Needs phase research — Anthropic direct browser API CORS policy and `anthropic-dangerous-direct-browser-access` header require verification against current SDK docs before implementation. Low confidence noted in ARCHITECTURE.md sources.

### Phase 7: Hardening + Polish
**Rationale:** Error states, permission-revoked recovery UX, IDB-to-FSA migration path, and export features require the happy path to be stable first.
**Delivers:** Graceful FSA permission revocation recovery (re-prompt flow), IDB → FSA migration helper, export allocation history to CSV, startup "Choose data folder" onboarding screen polish, error boundaries around storage failures.
**Addresses:** History export, persistence error states.
**Research flag:** Standard patterns — skip phase research.

### Phase Ordering Rationale

- **Foundation first:** `lib/cents.ts` and `lib/storage/` have zero upstream dependencies. Every other module depends on them. A bug here cascades everywhere — test coverage is mandatory before anything else is built.
- **Domain before UI:** The allocation engine is the most complex and most auditable piece of financial logic. Building and testing it as pure TypeScript (Phase 2) before wiring it to React (Phase 3) ensures correctness and prevents domain logic from coupling to the UI.
- **Configuration UI after core workflow:** The dashboard and invoice flow (Phase 3) can operate with hardcoded defaults during development. Configuration UI (Phase 4) is required for real use but not for verifying the engine behavior.
- **AI last among core:** CSV/AI (Phase 6) has an external dependency (Anthropic API) and a security concern (API key), and no other phase depends on it. It is safely deferred without blocking any other work.
- **Hardening last:** Error recovery and migration paths require a stable happy path to be meaningful. Building them earlier would mean repeatedly reworking them as the happy path evolves.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (CSV + AI):** Anthropic direct browser API CORS policy is LOW confidence per ARCHITECTURE.md. Verify `anthropic-dangerous-direct-browser-access` header behavior and current allowed origins before writing any AI integration code.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** FSA permission lifecycle and Tailwind v4 setup are thoroughly documented in STACK.md, ARCHITECTURE.md, and PITFALLS.md.
- **Phase 2 (Domain Logic):** Pure TypeScript + Vitest testing is a standard pattern with full toolchain documentation.
- **Phase 3 (Core UI):** shadcn/ui + Zustand store binding is well-documented with confirmed React 19 compatibility.
- **Phase 4 (Config UI):** Standard form management with Zustand; no novel patterns.
- **Phase 5 (History):** Read-only display of append-only log; no novel patterns.
- **Phase 7 (Hardening):** Error boundaries and FSA re-prompt flows follow the documented Chrome permission model.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core library versions confirmed via official blogs, npm, and official docs. Version compatibility matrix validated. Setup gotchas documented from official changelogs. |
| Features | MEDIUM | Table stakes features based on well-established envelope budgeting market (HIGH). Stabilize/Distribute auto-detection and invoice-triggered workflow are novel — no direct competitors found for comparison (LOW on competitive validation of these specific features). |
| Architecture | HIGH | Core patterns (driver abstraction, cents boundary, pure domain layer, Zustand domain stores) are verified against official docs and multiple engineering sources. Feature folder structure is community consensus, not an official React recommendation (MEDIUM for that specific choice). |
| Pitfalls | HIGH | FSA permission model is from official Chrome docs. Float math pitfalls are well-established. Tailwind v4 gotchas from official shadcn changelog. Zustand `useShallow` requirement from official migration guide. |

**Overall confidence:** HIGH for the technical implementation path. MEDIUM for competitive positioning of the novel allocation features (no direct market comparisons exist — this is intentional).

### Gaps to Address

- **Anthropic browser API CORS:** The `anthropic-dangerous-direct-browser-access` header requirement is noted but LOW confidence on current CORS behavior. Validate with a minimal fetch test before building Phase 6. If direct browser access is blocked, a lightweight proxy or user-provided proxy URL field will be needed.
- **Firefox / Safari FSA support:** FSA write access is Chromium-only. The IDB fallback covers these browsers, but the IDB driver does not provide human-readable files or cross-device sync. If the user base includes Firefox/Safari users, the IDB fallback must be surfaced as a first-class experience with a clear "your data is browser-local" warning — not an invisible fallback.
- **Multi-tab story:** BroadcastChannel notification (Phase 3) alerts users to concurrent edits but does not resolve them. For the v1 target user (solo freelancer), this is acceptable. Document this as a known limitation.
- **AI suggestion accuracy:** Research found no high-confidence benchmarks for AI expense categorization accuracy from real bank CSVs. The reasoning-transparency feature (show the detected pattern) mitigates trust risk, but category accuracy will depend heavily on the LLM prompt design. Budget iteration time for prompt engineering in Phase 6.

---

## Sources

### Primary (HIGH confidence)
- [Vite 7.0 announcement](https://vite.dev/blog/announcing-vite7) — Node requirement, ESM-only, breaking changes
- [React 19.2 blog post](https://react.dev/blog/2025/10/01/react-19-2) — feature list, version 19.2.4
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first, @theme directive, Vite plugin
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — New York default, OKLCH, tw-animate-css, components.json
- [shadcn/ui changelog February 2025](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4) — Tailwind v4 + React 19 support
- [Zustand v5 migration guide](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5) — breaking changes, useShallow requirement
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) — stable browser mode, basic reporter removed
- [FSA persistent permissions Chrome 122](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) — queryPermission() pattern
- [Chrome Developers — File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) — handle lifecycle
- [jakearchibald/idb GitHub](https://github.com/jakearchibald/idb) — version 8.0.3, FSA handle serialization
- [Goodbudget 2025 Features](https://goodbudget.com/blog/2025/11/2025-goodbudget-features-recap/) — competitor feature set
- [Actual Budget](https://actualbudget.org/) — open-source envelope budgeting feature set

### Secondary (MEDIUM confidence)
- [YNAB Features](https://www.ynab.com/features) — competitor feature comparison
- [Copilot Money](https://www.copilot.money/) — competitor feature comparison
- [Zustand slice pattern — Atlys Engineering](https://engineering.atlys.com/a-slice-based-zustand-store-for-next-js-14-and-typescript-6b92385a48f5) — multiple-store architecture
- [Frontstuff — Handle Monetary Values in JavaScript](https://frontstuff.io/how-to-handle-monetary-values-in-javascript) — integer cents pattern
- [Honeybadger — Currency Calculations in JavaScript](https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/) — cents arithmetic pattern
- [Robin Wieruch — React Folder Structure](https://www.robinwieruch.de/react-folder-structure/) — feature-based structure
- [NerdWallet Best Budget Apps 2026](https://www.nerdwallet.com/finance/learn/best-budget-apps) — table stakes comparative analysis

### Tertiary (LOW confidence)
- [Top 7 Budgeting Apps for Freelancers 2025](https://freelancefin.com/best-budgeting-apps-freelancers-2025/) — freelancer-specific feature gaps
- [Koody CSV Import](https://koody.com/blog/personal-finance-app-csv-import) — AI categorization in personal finance
- [Top 7 AI Tools for Expense Categorization 2025](https://www.lucid.now/blog/top-7-ai-tools-for-expense-categorization-2025/) — AI categorization accuracy (marketing content)
- Anthropic browser direct API access — current CORS policy needs validation before Phase 6 implementation

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
