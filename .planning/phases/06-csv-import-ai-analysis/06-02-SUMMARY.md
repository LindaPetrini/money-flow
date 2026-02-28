---
phase: 06-csv-import-ai-analysis
plan: "02"
subsystem: lib/anthropic-client + features/settings/csv-ai
tags: [anthropic-api, browser-fetch, structured-output, settings-ui, csv-upload, api-key]
dependency_graph:
  requires: [06-01]
  provides: [anthropicClient.ts, CsvAiSection.tsx, callAnthropicAPI, AIAnalysisResult, BucketSuggestion, AnthropicAPIError, ANALYSIS_SCHEMA]
  affects: [06-03]
tech_stack:
  added: []
  patterns: [pure-ts-domain-module, browser-fetch-cors, localStorage-api-key, structured-json-output, react-file-input]
key_files:
  created:
    - src/lib/anthropicClient.ts
    - src/features/settings/CsvAiSection.tsx
  modified:
    - src/features/settings/SettingsPage.tsx
decisions:
  - "BUCKET_SCHEMA extracted as a const and reused for all 4 bucket properties — avoids repetition while keeping full inline schema for readability"
  - "Format detection in CsvAiSection uses Papa.parse with preview:1 to peek at headers without re-parsing the full file — efficient and avoids changing csvParser.ts interface"
  - "Deduplication by (date|description|amountEur) string key set — handles user opening file picker twice with same files without double-counting"
  - "hasApiKey derived from localStorage.getItem at render time — keeps key out of React state entirely; button disabled logic reads localStorage directly"
  - "Spinner implemented as inline SVG animate-spin — no new component added (per plan spec)"
  - "File status shows count=0 as Unrecognised format message in destructive color"
metrics:
  duration_seconds: 538
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 3
---

# Phase 6 Plan 02: Anthropic API Client and CSV AI Section Summary

Fetch wrapper for the Anthropic Messages API (pure TypeScript, no React) plus the CsvAiSection settings UI covering API key management, multi-file CSV upload, transaction preview table, and the "Analyse with AI" trigger button.

## What Was Built

### `src/lib/anthropicClient.ts`

Pure TypeScript module (zero React imports) exposing:

- **`callAnthropicAPI(apiKey, transactions)`** — POST to `https://api.anthropic.com/v1/messages` with 4 required headers including `anthropic-dangerous-direct-browser-access: true` for CORS; uses `output_config.format.type: 'json_schema'` (GA structured outputs) for guaranteed valid JSON response
- **`AIAnalysisResult`** — interface with 4 bucket fields: `everydayEssentials`, `funDiscretionary`, `oneOffTravel`, `recurringFixed`
- **`BucketSuggestion`** — interface with `spendingAverageEur`, `monthsAnalyzed`, `reasoning`, `suggestedMonthlyAmountEur`
- **`AnthropicAPIError`** — Error subclass carrying `status` and `errorType` from API response body; never includes API key in message
- **`ANALYSIS_SCHEMA`** — JSON schema constant for the 4-bucket output (exported for Plan 03 reuse)
- **`buildAnalysisPrompt()`** — internal function formatting transactions as `YYYY-MM-DD | description | €amount` with category guidance

Model: `claude-haiku-4-5-20251001`, max_tokens: 2048.

### `src/features/settings/CsvAiSection.tsx`

React component for the "CSV & AI" settings sub-section:

**API Key management:**
- Password input initialized from localStorage presence (`••••••••` if set, `''` if not)
- Save: writes actual input value to `localStorage('anthropic_api_key')`, resets display to `••••••••`
- Clear: calls `localStorage.removeItem`, clears input
- API key lives only in localStorage — never held in state as the real value

**File upload:**
- Visually hidden `<input type="file" multiple accept=".csv">` triggered via `useRef`
- Per-file: Papa.parse with `preview:1` to detect bank format (Wise/N26/Revolut/Unknown), then `parseCSVFile()` for full parse
- File status list: `"name.csv — N transactions (Format)"` or `"— Unrecognised format"` in destructive color
- Deduplication: new transactions filtered against existing by `date|description|amountEur` key to prevent double-counting when file picker re-opens over same files

**Transaction preview:**
- Summary line: `N transactions from YYYY-MM-DD to YYYY-MM-DD across X file(s)`
- Scrollable table (max-h-64): Date | Description | Amount(EUR), newest-first
- Amounts displayed as `€42.50` (absolute value of negative expense)

**Analyse button:**
- `disabled` when no key in localStorage (title tooltip: "Enter an API key above first")
- Shows inline SVG spinner + "Analysing…" while `isAnalysing`
- On success: stores result in `analysisResult` state (Plan 03 replaces placeholder div)
- On error: sanitised message (`API error 401: authentication_error` or `Network error — …`)

### `src/features/settings/SettingsPage.tsx` (modified)

- Added `'csv-ai'` to `SettingsSection` union type
- Added `{ id: 'csv-ai', label: 'CSV & AI' }` to SECTIONS array
- Added `{activeSection === 'csv-ai' && <CsvAiSection />}` to render switch
- Added `CsvAiSection` import

## Verification

| Check | Result |
|-------|--------|
| `npm run build` | PASS — 0 TypeScript errors, Vite build succeeds |
| `npm test` | PASS — 114/114 tests (5 test files, all pre-existing) |
| `anthropic-dangerous-direct-browser-access` literal in anthropicClient.ts | PRESENT |
| `claude-haiku-4-5-20251001` literal in anthropicClient.ts | PRESENT |
| No React imports in anthropicClient.ts | CONFIRMED |
| API key not in any error string | CONFIRMED |
| `type="file" multiple accept=".csv"` in CsvAiSection.tsx | PRESENT |
| Analyse button disabled when no localStorage key | PRESENT |
| `localStorage.setItem('anthropic_api_key', ...)` only storage path | CONFIRMED |

## Deviations from Plan

None — plan executed exactly as written.

The one implementation detail not specified in the plan: format detection in `handleFileChange` uses `Papa.parse` with `preview: 1` to peek at CSV headers without re-parsing the full file. This avoids modifying `csvParser.ts` (which doesn't expose the detected format from `parseCSVFile`) while keeping the format label accurate per the plan spec.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/lib/anthropicClient.ts` | FOUND |
| `src/features/settings/CsvAiSection.tsx` | FOUND |
| `src/features/settings/SettingsPage.tsx` (modified) | FOUND |
| Commit `97cf73d` (Task 1: anthropicClient.ts) | FOUND |
| Commit `73d8661` (Task 2: CsvAiSection.tsx) | FOUND |
| All 114 tests pass | VERIFIED |
| `npm run build` passes | VERIFIED |
