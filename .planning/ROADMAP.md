# Roadmap: Money Flow

## Milestones

- ✅ **v1.0 MVP** — Phases 1–10 (shipped 2026-02-28)
- 🚧 **v1.1 AI-Powered Insights** — Phases 11–13 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–10) — SHIPPED 2026-02-28</summary>

- [x] **Phase 1: Foundation** (3/3 plans) — completed 2026-02-28
- [x] **Phase 2: Allocation Engine** (3/3 plans) — completed 2026-02-28
- [x] **Phase 3: Core UI** (4/4 plans) — completed 2026-02-28
- [x] **Phase 4: Configuration** (4/4 plans) — completed 2026-02-28
- [x] **Phase 5: History** (1/1 plan) — completed 2026-02-28
- [x] **Phase 6: CSV Import & AI Analysis** (3/3 plans) — completed 2026-02-28
- [x] **Phase 7: Hardening** (3/3 plans) — completed 2026-02-28
- [x] **Phase 8: Verify Core UI** (1/1 plan) — completed 2026-02-28
- [x] **Phase 9: Verify Configuration** (1/1 plan) — completed 2026-02-28
- [x] **Phase 10: Fix Integration Defects** (3/3 plans) — completed 2026-02-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 AI-Powered Insights (In Progress)

**Milestone Goal:** Enrich the CSV import flow with interactive AI analysis and extend the app with quality-of-life improvements — dark mode, invoice source tracking, history search/filter, AI transaction Q&A with merchant memory, and AI floor item detection.

- [ ] **Phase 11: Schema Foundation** — Add new domain types and merchant store that all v1.1 features depend on
- [ ] **Phase 12: Quick Wins** — Dark mode toggle, invoice source field, client display in history, history search/filter
- [ ] **Phase 13: AI Layer** — Transaction Q&A, merchant memory persistence, AI floor item detection

## Phase Details

### Phase 11: Schema Foundation
**Goal**: All v1.1 domain types and the merchant store exist and are wired into app startup, so Phase 12 and Phase 13 can build on a stable, backward-compatible data layer
**Depends on**: Phase 10 (v1.0 complete)
**Requirements**: None (pure infrastructure — no user-visible output; enables Phase 12 and Phase 13)
**Success Criteria** (what must be TRUE):
  1. `AllocationRecord.source` optional field exists in `domain.ts` with a read-time migration that sets it to `''` for all existing history records on load — no filter predicate can crash on old data
  2. `Settings.theme` optional field (`'light' | 'dark' | 'system'`) exists in `domain.ts` and `settingsStore` exposes an `applyTheme()` side-effect called on load and update
  3. `MerchantEntry` type and `PersistedMerchants` type alias exist in `domain.ts` and `persistence.ts`
  4. `merchantStore.ts` is implemented with load/upsert/lookup API, guarded with `initialized` check to prevent empty-state overwrites, and wired into `bootstrap.ts`
  5. `npm run build` succeeds and `npm test` passes with zero regressions
**Plans**: TBD

Plans:
- [ ] 11-01: Domain types — `AllocationRecord.source`, `Settings.theme`, `MerchantEntry`, `PersistedMerchants`; read-time migration in `allocationStore`
- [ ] 11-02: `merchantStore.ts` implementation + `bootstrap.ts` wiring; `applyTheme()` side-effect in `settingsStore`

### Phase 12: Quick Wins
**Goal**: Users can switch dark mode, enter a client name on invoices, see that name in history, and filter/search history — all without any AI interaction
**Depends on**: Phase 11
**Requirements**: THEME-01, THEME-02, THEME-03, INVSRC-01, INVSRC-02, HIST-01, HIST-02, HIST-03
**Success Criteria** (what must be TRUE):
  1. User can toggle between light, dark, and system preference via a control in the app header; the selected theme is applied immediately
  2. Reloading the page shows the correct theme with no visible flash of the wrong theme (dark mode is active before React renders)
  3. User can type a client or project name in an optional "From" field on the invoice entry form; the field is skippable
  4. Client name appears in the collapsed history row for allocations that have one; allocations without a source display normally
  5. User can filter the history list by date range, client/source text search, and amount min/max; results update live as filters change
**Plans**: TBD

Plans:
- [ ] 12-01: Dark mode — Tailwind `@custom-variant dark` selector fix, `localStorage` toggle, FOUC-prevention `<head>` script, header toggle control
- [ ] 12-02: Invoice source field — "From" input on `InvoiceForm`, persisted on `AllocationRecord.source`, displayed in `HistoryPage` collapsed rows
- [ ] 12-03: History filter panel — `HistoryFilters.tsx` component with date range, client search, amount range; `useMemo`-derived filtered list in `HistoryPage`

### Phase 13: AI Layer
**Goal**: The CSV import flow asks users about uncertain transactions, remembers their answers for future imports, and detects recurring expenses to suggest as pre-filled floor items
**Depends on**: Phase 11
**Requirements**: AIAN-01, AIAN-02, AIAN-03, AIAN-04, AIAN-05, AIAN-06
**Success Criteria** (what must be TRUE):
  1. After CSV import, the AI identifies transactions it cannot confidently categorize and presents each one to the user as a question with a context input and bucket selector
  2. User answers persist to `merchantStore` — the same merchant is pre-classified automatically on the next import, skipping the Q&A prompt
  3. After Q&A is complete, the AI detects recurring expenses from the CSV and presents them as suggested floor items; floor detection receives Q&A context so already-clarified transactions are not re-flagged
  4. Confirming a floor item suggestion pre-fills the floor item form in the Settings page (name, amount, destination account) so the user only needs to review and save
  5. The entire CSV session makes at most 2 Anthropic API calls (one for transaction classification/Q&A batch, one for floor detection) regardless of how many transactions are in the file
**Plans**: TBD

Plans:
- [ ] 13-01: `anthropicClient.ts` additions — `callUncertainTransactionDetection()` and `callFloorItemDetection()`; Q&A state machine (`QAPhase` discriminated union) in `CsvAiSection`
- [ ] 13-02: Merchant memory — pre-classification on import, Q&A answers persisted to `merchantStore`, `TransactionQACard` UI component
- [ ] 13-03: Floor item detection — detect after Q&A, pass clarification context, `onFloorItemSuggested` callback, pre-fill in `SettingsPage`

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-02-28 |
| 2. Allocation Engine | v1.0 | 3/3 | Complete | 2026-02-28 |
| 3. Core UI | v1.0 | 4/4 | Complete | 2026-02-28 |
| 4. Configuration | v1.0 | 4/4 | Complete | 2026-02-28 |
| 5. History | v1.0 | 1/1 | Complete | 2026-02-28 |
| 6. CSV Import & AI Analysis | v1.0 | 3/3 | Complete | 2026-02-28 |
| 7. Hardening | v1.0 | 3/3 | Complete | 2026-02-28 |
| 8. Verify Core UI | v1.0 | 1/1 | Complete | 2026-02-28 |
| 9. Verify Configuration | v1.0 | 1/1 | Complete | 2026-02-28 |
| 10. Fix Integration Defects | v1.0 | 3/3 | Complete | 2026-02-28 |
| 11. Schema Foundation | v1.1 | 0/2 | Not started | - |
| 12. Quick Wins | v1.1 | 0/3 | Not started | - |
| 13. AI Layer | v1.1 | 0/3 | Not started | - |
