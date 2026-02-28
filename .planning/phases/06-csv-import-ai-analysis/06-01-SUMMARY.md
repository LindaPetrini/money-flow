---
phase: 06-csv-import-ai-analysis
plan: "01"
subsystem: lib/csv-parser
tags: [csv, parser, tdd, papaparse, bank-formats]
dependency_graph:
  requires: []
  provides: [csvParser.ts, ParsedTransaction, BankFormat, detectBankFormat, parseEuropeanAmount, extractExpenses, parseCSVFile]
  affects: [06-02, 06-03]
tech_stack:
  added: [papaparse@5.5.3, "@types/papaparse"]
  patterns: [pure-ts-domain-module, tdd-red-green, european-decimal-normalization]
key_files:
  created:
    - src/lib/csvParser.ts
    - src/lib/csvParser.test.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Comma-decimal normalization: if comma present → all dots are thousand separators; safe for both European and dot-decimal without special-casing per bank"
  - "detectBankFormat strips BOM per-header (not just first) as defensive guard even though PapaParse auto-strips BOM with header:true"
  - "Revolut filter: State === COMPLETED only; excludes PENDING, REVERTED — matches research recommendation"
  - "N26 description fallback: Payee → Payment reference (Payee can be empty for direct debits)"
  - "parseCSVFile returns [] for unknown format (no throw) — caller responsible for showing unrecognised format message"
metrics:
  duration_seconds: 393
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 4
---

# Phase 6 Plan 01: CSV Parser — Bank Detection, Expense Extraction, European Decimal Handling Summary

Pure TypeScript CSV parser for Wise, N26, and Revolut exports using PapaParse, with header-fingerprint bank detection, European decimal normalization, and bank-specific expense filtering.

## What Was Built

`src/lib/csvParser.ts` — pure TypeScript module (no React imports) exposing:

- **`detectBankFormat(headers)`** — inspects header row for bank signatures (`TransferWise ID`, `Amount (EUR)`, `Started Date`), strips BOM prefix defensively
- **`parseEuropeanAmount(raw)`** — normalizes comma-decimal European amounts (`1.234,56` → `1234.56`) and dot-decimal amounts (`-12.50` → `-12.5`)
- **`extractExpenses(rows, format)`** — filters rows to expenses per bank rules:
  - Wise: `Amount < 0` AND `Currency === 'EUR'`
  - N26: `Amount (EUR) < 0`, description from Payee (fallback: Payment reference)
  - Revolut: `Amount < 0` AND `State === 'COMPLETED'`
  - unknown: `[]`
- **`parseCSVFile(file)`** — PapaParse async wrapper, detects format from parsed headers, returns `ParsedTransaction[]` sorted newest-first

## TDD Execution

**RED phase** (commit `a09b526`): 39 failing tests written covering all bank formats, edge cases, and the async File-based API.

**GREEN phase** (commit `b75ba78`): Implementation passes all tests on first attempt, with one auto-fix: the N26 `parseCSVFile` test had mismatched column count in inline CSV data (5 values vs 6 headers). Fixed in implementation phase — correct number of fields aligned to header count.

## Test Coverage

| Suite | Tests |
|-------|-------|
| detectBankFormat | 8 |
| parseEuropeanAmount | 8 |
| extractExpenses (Wise) | 5 |
| extractExpenses (N26) | 5 |
| extractExpenses (Revolut) | 6 |
| extractExpenses (unknown) | 1 |
| parseCSVFile | 6 |
| **Total new** | **39** |
| Pre-existing tests | 75 |
| **Total** | **114** |

All 114 tests pass. `npm run build` succeeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] N26 test CSV had mismatched column count**
- **Found during:** GREEN phase — initial test run
- **Issue:** The `parseCSVFile > parses an N26 CSV file` test constructed inline CSV with 6 headers but only 5 values per data row, causing PapaParse to map `Amount (EUR)` to `undefined`. The test data was the bug, not the implementation.
- **Fix:** Added the missing `Payment reference` column value to each data row in the test file.
- **Files modified:** `src/lib/csvParser.test.ts`
- **Commit:** `b75ba78` (included in GREEN commit)

**2. [Rule 1 - Bug] Unused type import caused TypeScript build error**
- **Found during:** GREEN phase — `npm run build`
- **Issue:** `import { ..., type ParsedTransaction }` in the test file triggered `TS6133: 'ParsedTransaction' is declared but its value is never read` (test file uses the type structurally, not as a value expression).
- **Fix:** Removed `ParsedTransaction` from the import list — tests use `ParsedTransaction[]` implicitly through assertion types.
- **Files modified:** `src/lib/csvParser.test.ts`
- **Commit:** `b75ba78` (same GREEN commit)

## Key Decisions

1. **Decimal normalization approach** — The plan's recommended strategy (check for comma presence, then strip dots and swap comma→dot) is used verbatim. This is safe because Wise and Revolut use dot-decimal (no commas in amounts), while N26 may use European comma-decimal. When a comma is present, dots are definitively thousand separators.

2. **BOM guard in detectBankFormat** — PapaParse auto-strips BOM from the first field with `header: true`. We strip `\ufeff` from all headers defensively, not just the first. This handles any theoretical edge case where BOM appears elsewhere and is consistent across all banks.

3. **No cents in parser** — Per plan spec: `parseCSVFile` returns `amountEur: number` (EUR float), not cents. Cents conversion (`Math.round(eurAmount * 100)`) is the responsibility of Plan 02/03 UI consumers. This avoids float-to-cents double-conversion and keeps the parser domain-pure.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/lib/csvParser.ts` | FOUND |
| `src/lib/csvParser.test.ts` | FOUND |
| Commit `a09b526` (RED) | FOUND |
| Commit `b75ba78` (GREEN) | FOUND |
| All 114 tests pass | VERIFIED |
| `npm run build` passes | VERIFIED |
