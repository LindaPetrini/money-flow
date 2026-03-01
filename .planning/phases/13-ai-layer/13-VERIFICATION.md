---
phase: 13-ai-layer
verified: 2026-03-01T11:50:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Full 2-call AI session end-to-end"
    expected: "CSV upload -> Analyse with AI -> Q&A cards appear -> Done with Q&A -> floor detection spinner -> floor suggestion cards -> Accept -> pre-filled FloorItemsSection Add form opens with ring highlight"
    why_human: "Requires a real Anthropic API key and live browser interaction across tab switches; cannot be verified with grep or unit tests"
  - test: "Merchant memory pre-classification suppresses known merchants from Q&A"
    expected: "After a merchant is answered in Q&A and persisted, re-uploading the same CSV on a future analysis shows 'N merchants auto-classified from memory' and that merchant does NOT appear in Q&A cards"
    why_human: "Requires two sequential interactions with a live browser and real API key; store persistence to IndexedDB cannot be tested in unit tests"
  - test: "Tab switch + scroll on floor item Accept"
    expected: "Clicking Accept on a floor suggestion card switches Settings to the Floor Items tab and smooth-scrolls to the pre-filled Add form"
    why_human: "DOM scroll behavior and conditional rendering timing (50ms setTimeout) cannot be verified without a browser"
---

# Phase 13: AI Layer Verification Report

**Phase Goal:** Implement the AI layer — combined analysis, Q&A for uncertain transactions, merchant memory persistence, and floor item detection with pre-fill UX.
**Verified:** 2026-03-01T11:50:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `callCombinedAnalysis()` returns both `uncertainTransactions[]` and four bucket suggestions in one Anthropic API call | VERIFIED | `src/lib/anthropicClient.ts` lines 285-324: function exported, uses `COMBINED_ANALYSIS_SCHEMA` with `uncertainTransactions` array + four `BucketSuggestion` fields, single fetch to `/v1/messages` |
| 2  | `callFloorDetection()` returns `floorItemSuggestions[]` and accepts Q&A clarification context as a parameter | VERIFIED | `src/lib/anthropicClient.ts` lines 337-377: function exported, third parameter `clarifications[]`, uses `FLOOR_DETECTION_SCHEMA` with `suggestions` array |
| 3  | All new JSON schemas have `additionalProperties: false` on every nested object | VERIFIED | 6 occurrences at lines 53, 65, 148, 170, 183, 195 — covers `BUCKET_SCHEMA`, `ANALYSIS_SCHEMA`, `UNCERTAIN_TRANSACTION_SCHEMA`, `COMBINED_ANALYSIS_SCHEMA`, `FLOOR_ITEM_SUGGESTION_SCHEMA`, `FLOOR_DETECTION_SCHEMA` |
| 4  | `UncertainTransaction`, `CombinedAnalysisResult`, `FloorItemSuggestion`, `FloorDetectionResult` types are exported | VERIFIED | Lines 108, 115, 123, 131 of `anthropicClient.ts` — all four interfaces with `export` keyword |
| 5  | `callAnthropicAPI` is marked `@deprecated` in JSDoc | VERIFIED | Line 384 of `anthropicClient.ts`: `@deprecated Use callCombinedAnalysis() instead — superseded in Phase 13.` |
| 6  | Pre-classification loop calls `lookupMerchant` before API call; known merchants excluded from payload | VERIFIED | `CsvAiSection.tsx` lines 200-208: `useMerchantStore.getState()` + loop filtering into `autoClassified` vs `toClassify`; only `toClassify` passed to `callCombinedAnalysis` (line 219) |
| 7  | "N merchants auto-classified from memory" summary line appears when N > 0 | VERIFIED | `CsvAiSection.tsx` lines 543-547: conditional render on `autoClassifiedCount > 0` in `qa`, `detecting-floors`, `floor-suggestions`, `complete` phases |
| 8  | Q&A cards appear with description, date, amount, AI reason, context input, bucket selector, Skip button | VERIFIED | `CsvAiSection.tsx` lines 549-652: full Q&A card JSX confirmed — all six required fields rendered per card |
| 9  | `Done with Q&A` persists answered (non-skipped) cards via `upsertMerchant()` | VERIFIED | `CsvAiSection.tsx` lines 263-308: `handleDoneWithQA` iterates `qaCards`, calls `upsertMerchant` only when `card.answered && !card.skipped && card.bucketAccountId` |
| 10 | After Done with Q&A, `callFloorDetection` fires with Q&A answers as clarification context | VERIFIED | `CsvAiSection.tsx` lines 283-307: `clarifications` built from answered cards, passed to `callFloorDetection(key, allTransactionsRef, clarifications)` |
| 11 | Floor suggestion cards appear with name, amount, frequency, confidence, reason; Accept calls `onFloorItemSuggested` | VERIFIED | `CsvAiSection.tsx` lines 684-735: full floor suggestion card JSX; Accept button line 713 calls `onFloorItemSuggested?.({ name, amountStr, destinationAccountId })` |
| 12 | `SettingsPage` receives `onFloorItemSuggested`, switches to floor-items tab, and scrolls to `FloorItemsSection` after mount | VERIFIED | `SettingsPage.tsx` lines 31-38: `handleFloorItemSuggested` with `setPendingFloorItem` + `setActiveSection('floor-items')` + `setTimeout(...scrollIntoView, 50)` |
| 13 | `FloorItemsSection` receives `pendingFloorItem` and opens Add form pre-filled with name/amountStr/destinationAccountId | VERIFIED | `FloorItemsSection.tsx` lines 69-93: `useEffect` on `pendingFloorItem`, calls `setNewItem(...)` + `setShowAddForm(true)` + `onPendingConsumed?.()` immediately |
| 14 | After user saves the floor item, `pendingFloorItem` is cleared (no infinite re-trigger) | VERIFIED | `FloorItemsSection.tsx` line 87: `onPendingConsumed?.()` called inside `useEffect` before `setPendingHighlight` — clears parent state before next render; `handleAdd` at line 162 closes form and resets `newItem` |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/anthropicClient.ts` | `callCombinedAnalysis`, `callFloorDetection`, new types and schemas | VERIFIED | All 6 exports present; 434 lines; substantive implementation with fetch, error handling, prompt builders, and 6 JSON schemas |
| `src/features/settings/CsvAiSection.tsx` | Q&A state machine, merchant pre-classification, Q&A card UI, floor detection trigger | VERIFIED | 902 lines; `CsvAiPhase` union type, `QACardState`, `handleAnalyse`, `handleDoneWithQA`, full Q&A JSX, floor suggestion JSX |
| `src/features/settings/SettingsPage.tsx` | `pendingFloorItem` lifted state, `onFloorItemSuggested` callback, tab switch + scroll | VERIFIED | 78 lines; `PendingFloorItem` type, `pendingFloorItem` state, `handleFloorItemSuggested` callback, `floorSectionRef` ref |
| `src/features/settings/FloorItemsSection.tsx` | `pendingFloorItem` prop support, Add form pre-fill via useEffect | VERIFIED | 399 lines; `FloorItemsSectionProps` interface, `useEffect` at line 69, `pendingHighlight` state, ring highlight on Add form div |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/anthropicClient.ts` | `https://api.anthropic.com/v1/messages` | `fetch` with `output_config.format.type = 'json_schema'` | WIRED | Lines 289-313 (`callCombinedAnalysis`) and 342-376 (`callFloorDetection`): both use `json_schema` format with correct schemas |
| `COMBINED_ANALYSIS_SCHEMA` | `CombinedAnalysisResult` | `JSON.parse(data.content[0].text)` | WIRED | Line 323: `return JSON.parse(data.content[0].text) as CombinedAnalysisResult`; schema includes `uncertainTransactions` + all four bucket fields |
| `CsvAiSection handleAnalyse` | `useMerchantStore.getState().lookupMerchant` | pre-classification loop before API call | WIRED | Lines 200-208: exact case-sensitive `t.description` match |
| `CsvAiSection Done with Q&A handler` | `useMerchantStore.getState().upsertMerchant` | for each answered QA card | WIRED | Lines 267-276: `card.answered && !card.skipped && card.bucketAccountId` guard before `upsertMerchant` |
| `CsvAiSection handleAnalyse` | `callCombinedAnalysis` | replaces `callAnthropicAPI` | WIRED | Line 219: `const result = await callCombinedAnalysis(key, toClassify)`; no remaining `callAnthropicAPI` import in CsvAiSection |
| `CsvAiSection handleDoneWithQA` | `callFloorDetection` | after `upsertMerchant` calls complete | WIRED | Lines 297: `const result = await callFloorDetection(key, allTransactionsRef, clarifications)` |
| `CsvAiSection floor card Accept button` | `onFloorItemSuggested` callback | `String(Math.abs(suggestion.amountEur).toFixed(2))` | WIRED | Lines 712-718: `amountStr` constructed, `onFloorItemSuggested?.({ name, amountStr, destinationAccountId })` called |
| `SettingsPage handleFloorItemSuggested` | `FloorItemsSection pendingFloorItem` prop | `setPendingFloorItem` + `setActiveSection('floor-items')` + `setTimeout scroll` | WIRED | Lines 32-38 + 65-69 + 74: full chain verified |
| `FloorItemsSection useEffect on pendingFloorItem` | `setNewItem` + `setShowAddForm(true)` | `useEffect` dependency on `pendingFloorItem` | WIRED | Lines 69-93: `setNewItem` pre-fills all fields, `setShowAddForm(true)`, `onPendingConsumed?.()` immediately before `setPendingHighlight` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| AIAN-01 | 13-01, 13-02 | After CSV import, AI identifies transactions it cannot confidently categorize | SATISFIED | `callCombinedAnalysis` returns `uncertainTransactions[]`; Q&A cards rendered from this array in `CsvAiSection.tsx` |
| AIAN-02 | 13-02 | User can provide context and assign a bucket for each uncertain transaction | SATISFIED | Q&A card JSX (lines 549-652): context text input + bucket selector + Skip button per card |
| AIAN-03 | 13-02 | Merchant-to-bucket assignments persist across future imports | SATISFIED | `handleDoneWithQA` calls `upsertMerchant` for each answered non-skipped card; `merchantStore` persists to IndexedDB |
| AIAN-04 | 13-02 | Known merchants are pre-classified on future imports (skipping Q&A) | SATISFIED | `lookupMerchant` loop before API call; known merchants excluded from `toClassify` payload; count displayed in UI |
| AIAN-05 | 13-03 | AI detects recurring expenses from CSV and suggests them as floor items | SATISFIED | `callFloorDetection` called in `handleDoneWithQA` with clarification context; floor suggestion cards shown in `floor-suggestions` phase |
| AIAN-06 | 13-03 | Confirming a floor item suggestion pre-fills the floor item form | SATISFIED | Accept button calls `onFloorItemSuggested` -> `SettingsPage` switches tab + scrolls -> `FloorItemsSection` `useEffect` pre-fills Add form with ring highlight |

All 6 required requirement IDs are covered. No orphaned requirements for this phase (AIAN-EXT-01 and AIAN-EXT-02 are explicitly labeled as extension requirements not in scope for Phase 13).

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `SettingsPage.tsx` line 62 | Comment `"placeholders replaced in plans 02, 03, 04"` | Info | Stale comment — sections are fully wired, not placeholders. No functional impact. |

No blocker or warning anti-patterns found. All implementations are substantive. No `return null` stubs, no empty handlers, no `console.log`-only implementations.

### Human Verification Required

#### 1. Full 2-Call AI Session End-to-End

**Test:** Upload a bank CSV in Settings > CSV & AI, enter a valid Anthropic API key, click "Analyse with AI". Wait for Q&A cards to appear. Fill in context and select a bucket for one uncertain transaction. Click "Done with Q&A". Wait for floor detection spinner to complete. Observe floor suggestion cards.

**Expected:** The complete flow works: Q&A cards show transaction description, date, amount, AI reason, context input, bucket selector, and Skip button. After Done with Q&A, a spinner shows "Detecting recurring expenses..." then floor suggestion cards appear with name, amount, frequency, confidence, and reason fields.

**Why human:** Requires a real Anthropic API key, live API responses, and browser interaction. Unit tests mock the API; the actual Anthropic structured output behavior cannot be verified without a real call.

#### 2. Merchant Memory Pre-Classification

**Test:** Complete a Q&A flow for a transaction from merchant "SPOTIFY AB". On a subsequent analysis with the same CSV file, observe the auto-classification summary line.

**Expected:** "1 merchant auto-classified from memory" appears and "SPOTIFY AB" does NOT appear in the Q&A card list.

**Why human:** Requires sequential browser sessions with IndexedDB persistence. The `merchantStore` initialization and `lookupMerchant` accuracy over the persist/reload cycle cannot be fully covered by unit tests.

#### 3. Tab Switch and Scroll on Floor Item Accept

**Test:** After floor detection completes and suggestion cards appear, click "Accept" on one suggestion card.

**Expected:** The Settings page switches to the "Floor Items" tab automatically, smooth-scrolls to the FloorItemsSection, and the Add form opens pre-filled with the suggestion's name and amount, highlighted with a primary-colored ring for approximately 2 seconds.

**Why human:** DOM scroll behavior (`scrollIntoView`), conditional rendering mount timing (50ms `setTimeout`), and visual ring highlight are not testable with `vitest` (no DOM environment configured for these components).

### Gaps Summary

No gaps found. All 14 observable truths are verified. All 9 key links are wired. All 6 requirement IDs (AIAN-01 through AIAN-06) are satisfied with implementation evidence. The build compiles cleanly and all 135 tests pass.

The stale comment on `SettingsPage.tsx` line 62 ("placeholders replaced in plans 02, 03, 04") is cosmetic only — the sections are fully wired and functional.

---

_Verified: 2026-03-01T11:50:00Z_
_Verifier: Claude (gsd-verifier)_
