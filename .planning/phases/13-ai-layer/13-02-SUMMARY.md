---
phase: 13-ai-layer
plan: "02"
subsystem: ui
tags: [react, zustand, anthropic, csv, merchant-memory, qa-flow]

# Dependency graph
requires:
  - phase: 13-01
    provides: callCombinedAnalysis, UncertainTransaction, CombinedAnalysisResult types in anthropicClient.ts
  - phase: 11-02
    provides: useMerchantStore with lookupMerchant/upsertMerchant
provides:
  - CsvAiSection extended with CsvAiPhase state machine
  - Merchant pre-classification loop (AIAN-04)
  - Q&A card UI for uncertain transactions (AIAN-01, AIAN-02)
  - Done-with-Q&A handler persisting to merchantStore (AIAN-03)
  - onFloorItemSuggested prop stub for Plan 13-03
affects:
  - 13-03 (floor detection wires onFloorItemSuggested and uses allTransactionsRef)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CsvAiPhase discriminant union type for multi-step wizard state machine"
    - "Merchant pre-classification: synchronous lookupMerchant loop before async API call"
    - "QACardState: answered/skipped flags control persistence vs skip in handleDoneWithQA"
    - "void prop pattern for forward-compatibility (onFloorItemSuggested no-op until Plan 03)"

key-files:
  created: []
  modified:
    - src/features/settings/CsvAiSection.tsx

key-decisions:
  - "Tasks 1 and 2 combined into a single commit — both modify only CsvAiSection.tsx and build/test verified once after full implementation"
  - "void onFloorItemSuggested and void allTransactionsRef suppress TS unused-variable errors while preserving props/state for Plan 03 wiring"
  - "autoClassified loop uses exact case-sensitive t.description match — consistent with merchantStore.lookupMerchant contract established in 11-02"

patterns-established:
  - "Pre-classification pattern: synchronous store lookup loop before async API call reduces token cost and improves UX"
  - "QA card persistence: only answered && !skipped cards with non-empty bucketAccountId are upserted"

requirements-completed:
  - AIAN-01
  - AIAN-02
  - AIAN-03
  - AIAN-04

# Metrics
duration: 8min
completed: 2026-03-01
---

# Phase 13 Plan 02: AI Layer — Q&A State Machine and Merchant Pre-classification

**CsvAiSection extended with merchant pre-classification, Q&A cards for uncertain transactions, and merchantStore persistence — callCombinedAnalysis replaces callAnthropicAPI**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-01T11:30:00Z
- **Completed:** 2026-03-01T11:38:00Z
- **Tasks:** 2 (executed together, single file)
- **Files modified:** 1

## Accomplishments
- Replaced deprecated `callAnthropicAPI` with `callCombinedAnalysis` in the CSV analysis flow
- Implemented merchant pre-classification: `lookupMerchant` runs synchronously for all transactions before the API call; known merchants are counted and excluded from the API payload (AIAN-04)
- Added Q&A card UI for `uncertainTransactions` returned by the AI: description, date, amount, AI reasoning, context text input, bucket selector, Skip button (AIAN-01, AIAN-02)
- `handleDoneWithQA` persists answered (non-skipped) cards to `merchantStore` via `upsertMerchant` (AIAN-03)
- Existing 4-bucket suggestion cards and `handleApply` flow fully preserved
- Added `onFloorItemSuggested` prop and `allTransactionsRef` state as forward-compatibility stubs for Plan 13-03
- All 135 existing tests pass with no regressions

## Task Commits

1. **Tasks 1 + 2: Types, state machine, pre-classification, Q&A cards, handleDoneWithQA** - `7920c34` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified
- `src/features/settings/CsvAiSection.tsx` — Replaced `callAnthropicAPI` with `callCombinedAnalysis`; added `CsvAiPhase`, `QACardState`, `CsvAiSectionProps` types; added merchant pre-classification loop; added Q&A card JSX; added `handleDoneWithQA`

## Decisions Made
- Tasks 1 and 2 executed together (both target the same file, no benefit to staging separately)
- `void onFloorItemSuggested` and `void allTransactionsRef` suppress TypeScript unused-variable warnings while preserving the forward-compatibility hooks for Plan 13-03
- Pre-classification uses exact case-sensitive `t.description` match, consistent with the `lookupMerchant` contract (established in 11-02 and documented in STATE.md decisions)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 13-03 can wire `onFloorItemSuggested` to trigger floor detection after Q&A completes
- `allTransactionsRef` state is available for Plan 13-03's floor detection call (holds full transaction list)
- `phase === 'complete'` transition in `handleDoneWithQA` will be replaced by `'detecting-floors'` in Plan 13-03

---
*Phase: 13-ai-layer*
*Completed: 2026-03-01*
