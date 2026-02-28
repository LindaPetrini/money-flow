# Roadmap: Money Flow

## Overview

Money Flow is a local-first freelance finance allocator. The build sequence follows strict dependencies: persistence and money math must be correct before any domain logic runs; the allocation engine must be tested in isolation before any UI consumes it; the primary invoice workflow must be stable before configuration editing is built; history display and CSV/AI analysis are deferred until the core workflow is complete. Seven phases deliver the full v1 feature set, from scaffold to AI-assisted bucket sizing.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Project scaffold + persistence layer + integer cents arithmetic
- [x] **Phase 2: Allocation Engine** - Pure TypeScript domain logic (Stabilize/Distribute modes) with full test coverage (completed 2026-02-28)
- [ ] **Phase 3: Core UI** - Dashboard + invoice entry workflow + allocation result view + Done confirmation
- [ ] **Phase 4: Configuration** - Floor items, overflow ratios, tax bucket, accounts, and default setup
- [x] **Phase 5: History** - Allocation history log view with monthly reset (completed 2026-02-28)
- [x] **Phase 6: CSV Import & AI Analysis** - CSV upload, parsing, AI categorization, and suggestion UI (completed 2026-02-28)
- [x] **Phase 7: Hardening** - Production-quality error recovery, FSA re-prompt UX, onboarding polish (completed 2026-02-28)
- [x] **Phase 8: Verify Core UI** - Formal verification of Phase 3 — creates VERIFICATION.md closing INVOICE-01/02/03/04 and DASH-01/02/03/04 (completed 2026-02-28)
- [ ] **Phase 9: Verify Configuration** - Formal verification of Phase 4 — creates VERIFICATION.md closing CONFIG-01 through CONFIG-07
- [ ] **Phase 10: Fix Integration Defects** - Fix ALLOC-02 floor item coverage marking (medium), INFRA-04 first-run detection (low-ux), and stale Phase 02 VERIFICATION.md

## Phase Details

### Phase 1: Foundation
**Goal**: The app runs locally, persists data correctly via FSA or IDB, and all money arithmetic is proven correct
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):
  1. Running `npm start` opens the app in a browser with no server required
  2. User can grant directory access once per session and the app re-uses that handle without re-prompting (FSA permission lifecycle)
  3. On Firefox/Safari (no FSA), all features still work using IndexedDB fallback
  4. Data written via FSA appears as human-readable JSON files in the chosen directory
  5. Unit tests prove that `parseCents`, `formatCents`, and `splitCents` produce exact integer results with no floating-point leakage
**Plans**: TBD

### Phase 2: Allocation Engine
**Goal**: The Stabilize/Distribute allocation logic is fully implemented and tested as pure TypeScript with zero React dependencies
**Depends on**: Phase 1
**Requirements**: ALLOC-01, ALLOC-02, ALLOC-03, ALLOC-04, ALLOC-05, ALLOC-06
**Success Criteria** (what must be TRUE):
  1. Given a floor state and buffer balance, the engine auto-detects the correct mode (Stabilize or Distribute) without any user toggle
  2. In Stabilize mode, the engine generates priority-ordered move instructions that cover uncovered floor items until invoice is exhausted or all floors are funded
  3. In Distribute mode, the engine generates split instructions that sum exactly to the invoice amount (no cent left over or double-counted)
  4. Every generated move includes the exact calculation, the rule applied, and the reason in human-readable form
  5. All engine functions can be called from Vitest in a Node environment with no browser globals
**Plans**: TBD

### Phase 3: Core UI
**Goal**: Users can enter an invoice, see precise move instructions with full transparency, confirm all moves atomically, and check their account balances
**Depends on**: Phase 2
**Requirements**: INVOICE-01, INVOICE-02, INVOICE-03, INVOICE-04, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. User can enter an invoice (amount, currency, EUR equivalent) and immediately see a complete list of move instructions with amounts, destinations, and reasons
  2. Each move instruction shows the exact calculation behind it (e.g. "37% of €2,000 = €740 → Isybank (tax rule)")
  3. Clicking "Done" updates all account balances in one operation and appends the allocation to history — no partial state
  4. The dashboard shows all account balances with visual at-target / near-target / below-target indicators
  5. User can edit any account balance inline without leaving the dashboard
**Plans**: 4 plans
Plans:
- [ ] 03-01-PLAN.md — Default configuration + store initialization bootstrap
- [ ] 03-02-PLAN.md — Dashboard screen with account cards, status indicators, mode badge, inline balance editing
- [ ] 03-03-PLAN.md — Invoice entry form, allocation result view, atomic Done confirmation
- [ ] 03-04-PLAN.md — Tab navigation shell wiring Dashboard, InvoicePage, and History placeholder

### Phase 4: Configuration
**Goal**: Users can configure all accounts, floor items, overflow ratios, and tax settings through the UI — no hardcoded defaults remain after setup
**Depends on**: Phase 3
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06, CONFIG-07
**Success Criteria** (what must be TRUE):
  1. User can add, edit, and reorder floor items (name, amount, priority) and assign them to destination accounts
  2. Floor items with expiry dates auto-deactivate when the date passes without any user action
  3. User can set overflow ratios that sum to 100% across non-floor accounts (UI enforces the constraint)
  4. User can set tax percentage (default 37%) and choose which account receives it
  5. On first run, default configuration (tax bucket + everyday/fun/savings/investing split) is pre-loaded and user can accept or edit before processing a first invoice
**Plans**: 4 plans
Plans:
- [ ] 04-01-PLAN.md — Settings tab infrastructure: add Settings tab to App.tsx + SettingsPage shell with sub-section nav
- [ ] 04-02-PLAN.md — Account configuration: list, edit, add, delete accounts via accountStore
- [ ] 04-03-PLAN.md — Floor items configuration: list by priority, add/edit/delete, expiry auto-deactivation
- [ ] 04-04-PLAN.md — Overflow ratios (100% enforcement) + Tax & Buffer settings form

### Phase 5: History
**Goal**: Users can review the full log of past allocations and reset floor coverage for a new month
**Depends on**: Phase 4
**Requirements**: HIST-01, HIST-02, HIST-03
**Success Criteria** (what must be TRUE):
  1. The history view lists every confirmed allocation in reverse chronological order with date, invoice amount, currency, and mode used
  2. Expanding any history entry shows all moves made (amounts, destinations, reasons) exactly as they appeared at confirmation time
  3. "New Month" reset marks all floor items as uncovered while leaving account balances, history, and configuration unchanged
**Plans**: TBD

### Phase 6: CSV Import & AI Analysis
**Goal**: Users can upload bank CSV exports and receive AI-generated bucket size suggestions with full reasoning transparency, driven by a runtime-entered API key
**Depends on**: Phase 5
**Requirements**: CSV-01, CSV-02, CSV-03, CSV-04, CSV-05, CSV-06, CSV-07, CSV-08
**Success Criteria** (what must be TRUE):
  1. User can upload one or more CSV files from Wise, N26, or Revolut and see a parsed transaction preview before committing
  2. The app correctly parses CSVs with UTF-8 BOM headers and European decimal separators (comma as decimal)
  3. AI analysis categorizes transactions into everyday essentials, fun/discretionary, one-off/travel, and recurring fixed — with a description of which pattern drove each categorization
  4. Each AI suggestion shows the detected spending average and the reasoning behind the suggested bucket amount — not just the number
  5. User can accept, adjust, or ignore each suggestion individually; accepted suggestions are written to configuration
  6. The Anthropic API key is entered by the user at runtime in settings and stored in localStorage only — never hardcoded, never in any file committed to git
**Plans**: TBD

### Phase 7: Hardening
**Goal**: The app handles FSA permission loss, storage failures, and first-run onboarding gracefully — no silent data loss, no confusing error states
**Depends on**: Phase 6
**Requirements**: INFRA-04 (production-quality recovery), INFRA-05 (IDB fallback first-class UX)
**Success Criteria** (what must be TRUE):
  1. When FSA write permission is revoked mid-session (e.g. background tab), the app shows a clear re-prompt dialog and resumes normally after permission is re-granted
  2. On Firefox/Safari (IDB-only mode), the app shows an explicit "your data is browser-local" notice — the fallback is surfaced, not hidden
  3. The first-run onboarding screen clearly guides users to choose a data directory before any allocation work begins
**Plans**: TBD

### Phase 8: Verify Core UI
**Goal**: Formally verify that Phase 3 implementation satisfies all Core UI requirements — produce VERIFICATION.md that closes INVOICE-01/02/03/04 and DASH-01/02/03/04
**Depends on**: Phase 7
**Requirements**: INVOICE-01, INVOICE-02, INVOICE-03, INVOICE-04, DASH-01, DASH-02, DASH-03, DASH-04
**Gap Closure**: Closes gaps from v1.0 audit — Phase 3 unverified (no VERIFICATION.md)
**Success Criteria** (what must be TRUE):
  1. VERIFICATION.md exists in `.planning/phases/03-core-ui/` confirming all 8 requirements
  2. All 8 requirements marked satisfied against their acceptance criteria
  3. No regressions — `npm run build` and `npm test` still pass
**Plans**: 1 plan
Plans:
- [ ] 08-01-PLAN.md — Inspect Phase 3 source files, gather evidence, write 03-VERIFICATION.md, update REQUIREMENTS.md

### Phase 9: Verify Configuration
**Goal**: Formally verify that Phase 4 implementation satisfies all Configuration requirements — produce VERIFICATION.md that closes CONFIG-01 through CONFIG-07
**Depends on**: Phase 8
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06, CONFIG-07
**Gap Closure**: Closes gaps from v1.0 audit — Phase 4 unverified (no VERIFICATION.md)
**Success Criteria** (what must be TRUE):
  1. VERIFICATION.md exists in `.planning/phases/04-configuration/` confirming all 7 requirements
  2. All 7 requirements marked satisfied against their acceptance criteria
  3. No regressions — `npm run build` and `npm test` still pass
**Plans**: TBD

### Phase 10: Fix Integration Defects
**Goal**: Fix the two integration defects found in the v1.0 audit and update stale verification metadata
**Depends on**: Phase 9
**Requirements**: ALLOC-02 (integration defect), INFRA-04 (UX defect)
**Gap Closure**: Closes ALLOC-02 medium integration gap and INFRA-04 first-run flow degradation from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `AllocationMove` type has `floorItemId?: string`; `allocationEngine.ts` stabilize() populates it; `InvoicePage.handleDone()` uses it for coverage marking (not `destinationAccountId`)
  2. First-run onboarding card is shown correctly in Chrome — detection decoupled from `accounts.length`
  3. Phase 02 `VERIFICATION.md` status updated from `gaps_found` to `passed`
  4. All 114 existing tests still pass; `npm run build` succeeds
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/? | Not started | - |
| 2. Allocation Engine | 3/3 | Complete   | 2026-02-28 |
| 3. Core UI | 0/? | Not started | - |
| 4. Configuration | 2/4 | In Progress|  |
| 5. History | 1/1 | Complete   | 2026-02-28 |
| 6. CSV Import & AI Analysis | 3/3 | Complete   | 2026-02-28 |
| 7. Hardening | 3/3 | Complete   | 2026-02-28 |
| 8. Verify Core UI | 1/1 | Complete   | 2026-02-28 |
| 9. Verify Configuration | 0/? | Not started | - |
| 10. Fix Integration Defects | 0/? | Not started | - |
