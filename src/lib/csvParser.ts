/**
 * csvParser.ts — Pure TypeScript CSV parser for bank exports.
 *
 * Supports Wise, N26, and Revolut CSV exports.
 * Detects bank format by header fingerprint, parses European decimal amounts,
 * filters expense rows per bank-specific rules, and returns normalized
 * ParsedTransaction[] sorted newest-first.
 *
 * This module is pure TypeScript (no React imports) — testable in Vitest/Node.
 * Follows the same pattern as domain/allocationEngine.ts.
 */

import Papa from 'papaparse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BankFormat = 'wise' | 'n26' | 'revolut' | 'unknown';

export interface ParsedTransaction {
  date: string;        // ISO YYYY-MM-DD
  description: string;
  amountEur: number;   // always negative for expenses
}

// ---------------------------------------------------------------------------
// Bank format detection
// ---------------------------------------------------------------------------

/** Header column that uniquely identifies each bank's CSV export */
const WISE_SIGNATURE = 'TransferWise ID';
const N26_SIGNATURE = 'Amount (EUR)';
const REVOLUT_SIGNATURE = 'Started Date';

/**
 * Detect which bank produced the CSV by inspecting the header row.
 *
 * BOM prefix (\ufeff) is stripped from each header before matching.
 * PapaParse with header:true auto-strips BOM from the first field, but we
 * guard against it here for safety.
 *
 * @param headers - Array of header strings from the first CSV row
 * @returns BankFormat identifier
 */
export function detectBankFormat(headers: string[]): BankFormat {
  // Strip BOM from each header for safe comparison
  const clean = headers.map(h => h.replace(/^\ufeff/, ''));

  if (clean.includes(WISE_SIGNATURE)) return 'wise';
  if (clean.includes(N26_SIGNATURE)) return 'n26';
  if (clean.includes(REVOLUT_SIGNATURE)) return 'revolut';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Amount parsing
// ---------------------------------------------------------------------------

/**
 * Parse a European or standard decimal amount string to a float.
 *
 * Strategy:
 * - If comma present → dots are thousand separators, comma is decimal separator
 *   e.g. '1.234,56' → remove dots → '1234,56' → replace comma → '1234.56' → 1234.56
 * - If no comma → standard dot-decimal (Wise, Revolut)
 *   e.g. '-12.50' → -12.5
 *
 * This is safe for both European and dot-decimal formats because:
 * - If commas present, we strip all dots (they must be thousand seps) and swap comma→dot
 * - If no commas, dot is the decimal separator — leave as-is
 *
 * @param raw - Raw amount string from CSV cell
 * @returns Parsed float value (negative for expenses)
 */
export function parseEuropeanAmount(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.includes(',')) {
    // Comma-decimal format: remove all dots (thousand separators), replace comma with dot
    return parseFloat(trimmed.replace(/\./g, '').replace(',', '.'));
  }
  // Standard dot-decimal
  return parseFloat(trimmed);
}

// ---------------------------------------------------------------------------
// Expense extraction — per bank format
// ---------------------------------------------------------------------------

/**
 * Extract expense transactions from parsed CSV rows according to bank-specific rules.
 *
 * Wise:   Amount < 0 AND Currency === 'EUR'
 * N26:    Amount (EUR) < 0
 * Revolut: Amount < 0 AND State === 'COMPLETED'
 * unknown: returns []
 *
 * @param rows   - Array of CSV row objects (keys = header names, values = cell strings)
 * @param format - Bank format as returned by detectBankFormat
 * @returns Array of ParsedTransaction (not yet sorted; sorted in parseCSVFile)
 */
export function extractExpenses(
  rows: Record<string, string>[],
  format: BankFormat,
): ParsedTransaction[] {
  switch (format) {
    case 'wise':
      return extractWiseExpenses(rows);
    case 'n26':
      return extractN26Expenses(rows);
    case 'revolut':
      return extractRevolutExpenses(rows);
    case 'unknown':
      return [];
  }
}

function extractWiseExpenses(rows: Record<string, string>[]): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];

  for (const row of rows) {
    const currency = (row['Currency'] ?? '').trim();
    if (currency !== 'EUR') continue;

    const amount = parseEuropeanAmount(row['Amount'] ?? '0');
    if (amount >= 0) continue; // Skip income / zero-amount rows

    result.push({
      date: (row['Date'] ?? '').trim(),
      description: (row['Description'] ?? '').trim(),
      amountEur: amount,
    });
  }

  return result;
}

function extractN26Expenses(rows: Record<string, string>[]): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];

  for (const row of rows) {
    const amount = parseEuropeanAmount(row['Amount (EUR)'] ?? '0');
    if (amount >= 0) continue; // Skip income

    // Description: prefer Payee; fall back to Payment reference
    const payee = (row['Payee'] ?? '').trim();
    const reference = (row['Payment reference'] ?? '').trim();
    const description = payee || reference;

    result.push({
      date: (row['Date'] ?? '').trim(),
      description,
      amountEur: amount,
    });
  }

  return result;
}

function extractRevolutExpenses(rows: Record<string, string>[]): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];

  for (const row of rows) {
    // Only COMPLETED transactions — exclude PENDING, REVERTED, etc.
    const state = (row['State'] ?? '').trim();
    if (state !== 'COMPLETED') continue;

    const amount = parseEuropeanAmount(row['Amount'] ?? '0');
    if (amount >= 0) continue; // Skip top-ups and income

    // Revolut date format: 'YYYY-MM-DD HH:MM:SS' — extract date portion only
    const startedDate = (row['Started Date'] ?? '').trim();
    const date = startedDate.slice(0, 10); // 'YYYY-MM-DD'

    result.push({
      date,
      description: (row['Description'] ?? '').trim(),
      amountEur: amount,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a CSV File object from a bank export into normalized ParsedTransaction[].
 *
 * Uses PapaParse for robust CSV parsing (handles BOM, quoted fields, encoding).
 * Detects bank format from parsed headers, extracts expenses, returns sorted newest-first.
 *
 * Returns [] for 'unknown' format — caller should show "unrecognised format" message.
 * Does NOT throw on unknown format.
 *
 * @param file - File object from <input type="file"> or similar
 * @returns Promise<ParsedTransaction[]> sorted by date descending (newest first)
 */
export function parseCSVFile(file: File): Promise<ParsedTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const rows = result.data;

          // Header keys come from PapaParse's meta.fields; BOM is auto-stripped
          const headers = result.meta.fields ?? [];
          const format = detectBankFormat(headers);

          const expenses = extractExpenses(rows, format);

          // Sort newest-first (ISO dates sort lexicographically)
          expenses.sort((a, b) => b.date.localeCompare(a.date));

          resolve(expenses);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => {
        reject(new Error(`CSV parse error: ${err.message}`));
      },
    });
  });
}
