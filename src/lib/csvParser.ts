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

export type BankFormat = 'wise' | 'wise-new' | 'n26' | 'revolut' | 'revolut-it' | 'unknown';

export interface ParsedTransaction {
  date: string;        // ISO YYYY-MM-DD
  description: string;
  amountEur: number;   // always negative for expenses
}

/**
 * RichTransaction — extended transaction record for Revolut internal transfer detection.
 * Contains all rows (positive and negative), with Revolut-specific metadata preserved
 * so that cross-product transfer chains can be identified.
 *
 * For non-Revolut formats, revolut_* fields are undefined.
 */
export interface RichTransaction {
  date: string;                  // ISO YYYY-MM-DD
  description: string;
  amountEur: number;             // signed (negative = outgoing)
  bank: BankFormat;
  // Revolut-specific (only set for revolut/revolut-it)
  revolut_product?: string;      // 'Attuale' | 'Deposito' | 'Risparmi'
  revolut_tipo?: string;         // 'Ricarica' | 'Pagamento' | 'Pagamento con carta' | 'Interessi' etc.
  revolut_timestamp?: string;    // full datetime 'YYYY-MM-DD HH:MM:SS' for pairing
}

// ---------------------------------------------------------------------------
// Bank format detection
// ---------------------------------------------------------------------------

/** Header column that uniquely identifies each bank's CSV export */
const WISE_SIGNATURE = 'TransferWise ID';
const WISE_NEW_SIGNATURE = 'Source amount (after fees)'; // Wise transfer history (newer export format)
const N26_SIGNATURE = 'Amount (EUR)';
const REVOLUT_SIGNATURE = 'Started Date';
const REVOLUT_IT_SIGNATURE = 'Data di inizio'; // Revolut Italian locale

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
  if (clean.includes(WISE_NEW_SIGNATURE)) return 'wise-new';
  if (clean.includes(N26_SIGNATURE)) return 'n26';
  if (clean.includes(REVOLUT_IT_SIGNATURE)) return 'revolut-it';
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
    case 'wise-new':
      return extractWiseNewExpenses(rows);
    case 'n26':
      return extractN26Expenses(rows);
    case 'revolut':
      return extractRevolutExpenses(rows);
    case 'revolut-it':
      return extractRevolutItExpenses(rows);
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

function extractWiseNewExpenses(rows: Record<string, string>[]): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];

  for (const row of rows) {
    if ((row['Status'] ?? '').trim() !== 'COMPLETED') continue;
    if ((row['Direction'] ?? '').trim() !== 'OUT') continue;
    if ((row['Source currency'] ?? '').trim() !== 'EUR') continue;

    const amount = parseEuropeanAmount(row['Source amount (after fees)'] ?? '0');
    if (amount <= 0) continue;

    const startedDate = (row['Created on'] ?? '').trim();
    const date = startedDate.slice(0, 10); // 'YYYY-MM-DD'

    // Prefer Target name as merchant description, fall back to Reference
    const targetName = (row['Target name'] ?? '').trim();
    const reference = (row['Reference'] ?? '').trim();
    const description = targetName || reference;

    result.push({
      date,
      description,
      amountEur: -amount, // amount is positive in export; negate for expense
    });
  }

  return result;
}

function extractRevolutItExpenses(rows: Record<string, string>[]): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];

  for (const row of rows) {
    // Italian Revolut uses 'COMPLETATO' instead of 'COMPLETED'
    const state = (row['State'] ?? '').trim();
    if (state !== 'COMPLETATO') continue;

    const amount = parseEuropeanAmount(row['Importo'] ?? '0');
    if (amount >= 0) continue; // Skip top-ups (Ricarica) and income

    const startedDate = (row['Data di inizio'] ?? '').trim();
    const date = startedDate.slice(0, 10); // 'YYYY-MM-DD'

    result.push({
      date,
      description: (row['Descrizione'] ?? '').trim(),
      amountEur: amount, // already negative
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

// ---------------------------------------------------------------------------
// Revolut ALL transactions — for internal transfer detection
// ---------------------------------------------------------------------------

/**
 * Parse a Revolut Italian CSV returning ALL transactions (not just expenses),
 * with full metadata for internal transfer detection.
 *
 * Returns empty array for non-Revolut formats.
 * Preserves Prodotto (sub-account), Tipo (transaction type), and full timestamp.
 * Skips only: State !== 'COMPLETATO' and Tipo === 'Interessi' (interest, tiny noise).
 *
 * @param file - File object from <input type="file"> or similar
 * @returns Promise<RichTransaction[]> sorted by timestamp descending
 */
export function parseRevolutAllTransactions(file: File): Promise<RichTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const rows = result.data;
          const headers = result.meta.fields ?? [];
          const format = detectBankFormat(headers);

          // Only process Revolut Italian format
          if (format !== 'revolut-it') {
            resolve([]);
            return;
          }

          const richTxns: RichTransaction[] = [];

          for (const row of rows) {
            // Only completed transactions
            const state = (row['State'] ?? '').trim();
            if (state !== 'COMPLETATO') continue;

            // Skip interest rows (tiny noise, not relevant to transfer chains)
            const tipo = (row['Tipo'] ?? '').trim();
            if (tipo === 'Interessi') continue;

            const amount = parseEuropeanAmount(row['Importo'] ?? '0');
            const timestamp = (row['Data di inizio'] ?? '').trim();
            const date = timestamp.slice(0, 10); // 'YYYY-MM-DD'

            richTxns.push({
              date,
              description: (row['Descrizione'] ?? '').trim(),
              amountEur: amount,
              bank: 'revolut-it',
              revolut_product: (row['Prodotto'] ?? '').trim(),
              revolut_tipo: tipo,
              revolut_timestamp: timestamp,
            });
          }

          // Sort newest-first by timestamp (ISO timestamps sort lexicographically)
          richTxns.sort((a, b) =>
            (b.revolut_timestamp ?? b.date).localeCompare(a.revolut_timestamp ?? a.date),
          );

          resolve(richTxns);
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
