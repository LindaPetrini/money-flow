---
phase: 06-csv-import-ai-analysis
verified: 2026-02-28T17:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Upload a real Wise CSV file and verify the transaction preview table renders correctly"
    expected: "Table shows Date | Description | Amount (EUR) sorted newest-first with transaction count and date range in the summary header"
    why_human: "File upload and parsing pipeline requires a browser environment with File API; cannot run in Vitest/Node"
  - test: "Enter a valid Anthropic API key and click 'Analyse with AI'; verify spinner appears then cards render"
    expected: "4 suggestion cards appear (Everyday Essentials, Fun & Discretionary, One-off & Travel, Recurring Fixed), each showing spending average, reasoning paragraph, editable amount, Accept/Skip buttons"
    why_human: "Requires live Anthropic API call; structured output parsing cannot be verified without network access"
  - test: "Accept 4 buckets, adjust amounts so projected total rounds to 100%, then click Apply"
    expected: "Apply writes new overflowRatios to settingsStore, shows 'Overflow ratios updated successfully.' message, section resets to upload state"
    why_human: "Requires live store interaction and visual confirmation of state reset; no automated test covers this flow end-to-end"
  - test: "With a key set, attempt to analyse with an invalid key; verify error display"
    expected: "Inline red error: 'API error 401: authentication_error' — API key must not appear in the error text"
    why_human: "Requires live network call with an invalid key to trigger the error path"
---

# Phase 6: CSV Import & AI Analysis Verification Report

**Phase Goal:** Users can upload bank CSV exports and receive AI-generated bucket size suggestions with full reasoning transparency, driven by a runtime-entered API key
**Verified:** 2026-02-28T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | Wise, N26, and Revolut CSV files are correctly identified by header fingerprint | VERIFIED | `detectBankFormat` in `csvParser.ts` checks for `TransferWise ID`, `Amount (EUR)`, `Started Date`; 8 unit tests cover all cases including BOM; all 114 tests pass |
| 2  | Expense rows are extracted with correct date, description, and EUR amount | VERIFIED | `extractExpenses` dispatches to bank-specific extractors; 16 tests cover Wise/N26/Revolut filtering with correct field mappings |
| 3  | UTF-8 BOM in headers does not break bank detection | VERIFIED | `detectBankFormat` strips `\ufeff` from each header; test `'handles UTF-8 BOM in Wise CSV'` in `parseCSVFile` suite confirms end-to-end |
| 4  | European decimal amounts (e.g. '1.234,56') are parsed to correct float values | VERIFIED | `parseEuropeanAmount` normalizes comma-decimal; 8 unit tests including multi-dot thousands separator and whitespace |
| 5  | Non-EUR Wise rows are excluded; Revolut PENDING/REVERTED rows are excluded | VERIFIED | `extractWiseExpenses` filters `Currency !== 'EUR'`; `extractRevolutExpenses` filters `State !== 'COMPLETED'`; dedicated test cases for each |
| 6  | User can enter an Anthropic API key; it is stored only in localStorage under `anthropic_api_key` | VERIFIED | `handleSaveKey` calls `localStorage.setItem('anthropic_api_key', ...)` only; `handleClearKey` calls `removeItem`; key never stored in React state as real value |
| 7  | The key is displayed as `••••••••` when already set; Clear button removes it | VERIFIED | `apiKeyInput` initialized to `'••••••••'` when key exists in localStorage; `handleClearKey` calls `removeItem` and sets input to `''` |
| 8  | User can select CSV files and see a parsed transaction preview table | VERIFIED | `handleFileChange` calls `parseCSVFile` per file; transactions rendered in scrollable table with Date/Description/Amount(EUR) columns and summary line |
| 9  | 'Analyse with AI' button is disabled with tooltip if no API key is set | VERIFIED | `disabled={!hasApiKey || isAnalysing}` on button; `title="Enter an API key above first"` when `!hasApiKey` |
| 10 | `anthropicClient.ts` calls Anthropic API with all 4 required headers including the CORS header | VERIFIED | Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`, `anthropic-dangerous-direct-browser-access: true` all present at lines 125-129 |
| 11 | After AI analysis completes, user sees 4 suggestion cards with spending average, reasoning, editable amount, Accept/Skip buttons | VERIFIED | `BUCKET_KEYS.map(key => ...)` renders 4 cards; each renders `spendingAverageEur`, `monthsAnalyzed`, `reasoning`, editable number input, Accept/Skip buttons |
| 12 | Apply button is disabled until projected ratio total rounds to 100%; inline warning shown when not at 100% | VERIFIED | `disabled={!anyAccepted || !ratiosValid || isApplying}`; `ratiosValid = Math.round(projectedTotal) === 100`; inline warning: `"Must equal 100% — accept more buckets or adjust amounts"` |
| 13 | Clicking Apply writes updated `overflowRatios` to settingsStore and resets suggestion state | VERIFIED | `handleApply` calls `await updateSettings({ overflowRatios: projectedRatios })`; then `setSuggestions(null)` and `setAnalysisResult(null)` |
| 14 | The Settings page has a 'CSV & AI' tab that renders CsvAiSection | VERIFIED | `SettingsPage.tsx` has `'csv-ai'` in union type, `{ id: 'csv-ai', label: 'CSV & AI' }` in SECTIONS, and `{activeSection === 'csv-ai' && <CsvAiSection />}` render branch |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/csvParser.ts` | Pure-TS CSV parser: detectBankFormat, parseEuropeanAmount, extractExpenses, parseCSVFile | VERIFIED | 229 lines; all 6 exports present; PapaParse imported; no React imports; substantive implementation |
| `src/lib/csvParser.test.ts` | Vitest unit tests covering all bank formats and edge cases | VERIFIED | 447 lines; 39 tests across 7 describe blocks; all 114 project tests pass |
| `src/lib/anthropicClient.ts` | fetch() wrapper for Anthropic Messages API with structured JSON output | VERIFIED | 157 lines; exports `callAnthropicAPI`, `AIAnalysisResult`, `BucketSuggestion`, `AnthropicAPIError`, `ANALYSIS_SCHEMA`; no React imports; CORS header present |
| `src/features/settings/CsvAiSection.tsx` | CSV & AI settings section: key mgmt + upload + preview + suggestion cards + apply | VERIFIED | 583 lines; full implementation with all plan features; placeholder div from Plan 02 replaced with full card UI |
| `src/features/settings/SettingsPage.tsx` | Settings page with 5 sub-tabs including CSV & AI | VERIFIED | `csv-ai` in union type, SECTIONS, and render branch; CsvAiSection imported and used |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/csvParser.ts` | `papaparse` | `import Papa from 'papaparse'` | WIRED | Line 13: `import Papa from 'papaparse'`; used in `parseCSVFile` |
| `src/lib/csvParser.test.ts` | `src/lib/csvParser.ts` | named imports of all exported functions | WIRED | Lines 3-8: imports `detectBankFormat`, `parseEuropeanAmount`, `extractExpenses`, `parseCSVFile`, `type BankFormat` |
| `src/features/settings/CsvAiSection.tsx` | `src/lib/csvParser.ts` | `import { parseCSVFile, detectBankFormat }` | WIRED | Line 3: import present; `parseCSVFile` used at line 123, `detectBankFormat` used at line 111 |
| `src/features/settings/CsvAiSection.tsx` | `localStorage` | `localStorage.getItem/setItem/removeItem('anthropic_api_key')` | WIRED | Lines 60, 80, 86, 157, 241: five distinct usages covering all CRUD operations |
| `src/lib/anthropicClient.ts` | `https://api.anthropic.com/v1/messages` | `fetch()` with `anthropic-dangerous-direct-browser-access: true` | WIRED | Lines 102, 122-128: URL constant, fetch call, CORS header all present |
| `src/features/settings/CsvAiSection.tsx` | `src/stores/settingsStore.ts` | `useSettingsStore(s => s.updateSettings)` | WIRED | Lines 55, 228: hook call and `updateSettings({ overflowRatios: projectedRatios })` |
| `src/features/settings/CsvAiSection.tsx` | `src/stores/settingsStore.ts` | `useSettingsStore(s => s.settings).overflowRatios` | WIRED | Lines 54, 166, 196, 207, 436, 483: multiple usages of `settings.overflowRatios` |
| `src/features/settings/SettingsPage.tsx` | `src/features/settings/CsvAiSection.tsx` | `import { CsvAiSection } from './CsvAiSection'` | WIRED | Line 6: import present; line 48: `{activeSection === 'csv-ai' && <CsvAiSection />}` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CSV-01 | 06-01, 06-02 | User can upload one or more CSV exports from bank(s) | SATISFIED | File input `type="file" multiple accept=".csv"` at lines 305-307; `handleFileChange` processes multiple files |
| CSV-02 | 06-01 | Parses CSV with Wise/N26/Revolut formats, UTF-8 BOM, European decimals | SATISFIED | `detectBankFormat` (BOM guard), `parseEuropeanAmount` (comma-decimal), bank-specific extractors; 39 tests pass |
| CSV-03 | 06-01, 06-02 | User sees a preview of parsed transactions before confirming import | SATISFIED | Transaction preview table with Date/Description/Amount(EUR) columns, count/date-range summary; rendered when `transactions.length > 0` |
| CSV-04 | 06-02, 06-03 | AI categorizes transactions into 4 buckets; Anthropic API, user-provided key in localStorage | SATISFIED | `callAnthropicAPI` sends transactions with prompt defining 4 buckets; key from localStorage only |
| CSV-05 | 06-02, 06-03 | AI generates suggested bucket amounts based on spending averages | SATISFIED | `BucketSuggestion.spendingAverageEur` and `suggestedMonthlyAmountEur` fields; displayed per card |
| CSV-06 | 06-03 | Every AI suggestion shows the reasoning — which pattern was detected and why | SATISFIED | `suggestion.reasoning` rendered as italic paragraph per card; visible by default (transparency value) |
| CSV-07 | 06-02, 06-03 | User can accept, adjust, or ignore each suggestion individually | SATISFIED | Per-card Accept/Skip toggle buttons; editable amount input; account assignment select; accepted cards highlighted green |
| CSV-08 | 06-02 | API key entered by user at runtime in settings — never bundled, never hardcoded | SATISFIED | Key stored only in `localStorage('anthropic_api_key')`; never in React state; no key in committed code |

All 8 requirements (CSV-01 through CSV-08) are satisfied. No orphaned requirements found — all 8 appear in at least one plan's `requirements` field.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/csvParser.ts` | 114 | `return []` | Info | Expected: `extractExpenses` for `'unknown'` format intentionally returns empty array; documented in JSDoc; not a stub |
| `src/features/settings/CsvAiSection.tsx` | 270 | `placeholder="sk-ant-…"` | Info | HTML input placeholder attribute for UX guidance; not a code stub |

No blocker or warning anti-patterns detected. The `return []` for unknown format is intentional and tested behavior, not a stub.

---

### Human Verification Required

The following behaviors require a browser environment or live API access to confirm:

#### 1. CSV Upload and Transaction Preview

**Test:** Open the app, navigate to Settings > CSV & AI, choose a real Wise, N26, or Revolut CSV file.
**Expected:** File status shows `"filename.csv — N transactions (Wise/N26/Revolut)"` and a scrollable table appears with Date, Description, Amount (EUR) columns, newest-first, with count and date range in the header.
**Why human:** File upload uses the browser File API and PapaParse which requires DOM globals; cannot run in Vitest.

#### 2. Live AI Analysis

**Test:** Save a valid Anthropic API key, upload 6+ months of CSV data, click "Analyse with AI".
**Expected:** Spinner appears during analysis, then 4 cards render: Everyday Essentials, Fun & Discretionary, One-off & Travel, Recurring Fixed — each with spending average (e.g. "Average: €847/month over 6 months"), an AI reasoning paragraph, and an editable monthly amount.
**Why human:** Requires live Anthropic API call; structured JSON output parsing cannot be verified statically.

#### 3. Accept/Apply Flow

**Test:** Accept buckets and adjust amounts until projected ratio total shows 100% (green), then click "Apply accepted changes".
**Expected:** "Overflow ratios updated successfully." message appears, section resets to upload state (cards disappear, file list clears), and the Overflow Ratios settings tab shows updated percentages.
**Why human:** Requires live store interaction and visual confirmation across multiple UI sections.

#### 4. API Error Display (Security)

**Test:** Save an intentionally invalid API key, upload a CSV, click "Analyse with AI".
**Expected:** Inline red error message shows `"API error 401: authentication_error"` — the actual API key string must not appear anywhere in the UI or browser console.
**Why human:** Requires a live network call with an invalid key to trigger the 401 error path.

---

### Gaps Summary

No gaps found. All 14 observable truths are verified, all 5 required artifacts are substantive and wired, all 8 key links are confirmed, all 8 requirements (CSV-01 through CSV-08) are satisfied.

The `data-testid="analysis-result-placeholder"` div introduced in Plan 02 is confirmed absent from the final file — it was correctly replaced by the full suggestion card UI in Plan 03 (commit `2f1160d`).

All 3 commits for this phase exist in the repository:
- `a09b526` — test(06-01): RED phase, 39 failing tests
- `b75ba78` — feat(06-01): GREEN phase, implementation
- `97cf73d` — feat(06-02): anthropicClient.ts
- `73d8661` — feat(06-02): CsvAiSection.tsx (key management, upload, preview)
- `2f1160d` — feat(06-03): suggestion cards + apply logic
- `c8f0417` — docs(06-03): plan metadata

Build: `npm run build` passes with 0 TypeScript errors.
Tests: 114/114 pass (39 new csvParser tests + 75 pre-existing).

---

_Verified: 2026-02-28T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
