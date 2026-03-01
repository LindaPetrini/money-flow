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

- [x] **Phase 11: Schema Foundation** — Add new domain types and merchant store that all v1.1 features depend on (completed 2026-02-28)
- [x] **Phase 12: Quick Wins** — Dark mode toggle, invoice source field, client display in history, history search/filter (completed 2026-02-28)
- [x] **Phase 13: AI Layer** — Transaction Q&A, merchant memory persistence, AI floor item detection (completed 2026-03-01)

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
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — Domain types: `AllocationRecord.source`, `Settings.theme`, `MerchantEntry`, `PersistedMerchants`; read-time migration in `allocationStore`
- [ ] 11-02-PLAN.md — `merchantStore.ts` implementation + `main.tsx` wiring; `applyTheme()` side-effect in `settingsStore`

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
**Plans**: 3 plans

Plans:
- [ ] 12-01-PLAN.md — Dark mode: FOUC script in `index.html`, `@custom-variant dark` selector fix, `applyTheme` localStorage mirror, Sun/Moon/Monitor toggle in `App.tsx` header
- [ ] 12-02-PLAN.md — Invoice source: "From" input on `InvoiceForm`, threaded through `InvoicePage` into `AllocationRecord.source`, shown in `HistoryPage` collapsed rows
- [ ] 12-03-PLAN.md — History filters: `HistoryFilters.tsx` component (date range, source search, amount range); `useMemo` `filteredHistory` in `HistoryPage`

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
**Plans**: 3 plans

Plans:
- [ ] 13-01-PLAN.md — `anthropicClient.ts`: `callCombinedAnalysis()` (combined bucket + uncertain transaction schema), `callFloorDetection()` (floor suggestions with Q&A context); new TypeScript types; `callAnthropicAPI` marked deprecated
- [ ] 13-02-PLAN.md — `CsvAiSection` state machine extension: merchant pre-classification, `CsvAiPhase` discriminant, Q&A cards (description/date/amount/context/bucket selector), `upsertMerchant` on Done with Q&A
- [ ] 13-03-PLAN.md — Floor detection trigger after Q&A; floor suggestion cards; `pendingFloorItem` lifted state in `SettingsPage`; `FloorItemsSection` pre-fill via `useEffect`

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
| 11. Schema Foundation | v1.1 | 2/2 | Complete | 2026-02-28 |
| 12. Quick Wins | v1.1 | 3/3 | Complete    | 2026-02-28 |
| 13. AI Layer | 3/3 | Complete   | 2026-03-01 | - |
