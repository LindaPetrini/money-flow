import { describe, it, expect } from 'vitest';
import {
  detectBankFormat,
  parseEuropeanAmount,
  extractExpenses,
  parseCSVFile,
  type BankFormat,
} from './csvParser';

// ---------------------------------------------------------------------------
// detectBankFormat
// ---------------------------------------------------------------------------

describe('detectBankFormat', () => {
  it('returns "wise" when TransferWise ID header present', () => {
    const headers = ['TransferWise ID', 'Date', 'Amount', 'Currency', 'Description'];
    expect(detectBankFormat(headers)).toBe<BankFormat>('wise');
  });

  it('returns "n26" when Amount (EUR) header present', () => {
    const headers = ['Date', 'Payee', 'Account number', 'Transaction type', 'Payment reference', 'Amount (EUR)'];
    expect(detectBankFormat(headers)).toBe<BankFormat>('n26');
  });

  it('returns "revolut" when Started Date header present', () => {
    const headers = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Currency', 'State'];
    expect(detectBankFormat(headers)).toBe<BankFormat>('revolut');
  });

  it('returns "unknown" when no known header present', () => {
    const headers = ['Foo', 'Bar', 'Baz'];
    expect(detectBankFormat(headers)).toBe<BankFormat>('unknown');
  });

  it('returns "unknown" for empty headers array', () => {
    expect(detectBankFormat([])).toBe<BankFormat>('unknown');
  });

  it('strips BOM prefix from first header if present — still detects wise', () => {
    // PapaParse should handle BOM but we guard against it too
    const headers = ['\ufeffTransferWise ID', 'Date', 'Amount'];
    expect(detectBankFormat(headers)).toBe<BankFormat>('wise');
  });

  it('strips BOM prefix from first header — still detects n26', () => {
    const headers = ['\ufeffDate', 'Payee', 'Amount (EUR)'];
    expect(detectBankFormat(headers)).toBe<BankFormat>('n26');
  });

  it('strips BOM prefix from first header — still detects revolut', () => {
    const headers = ['\ufeffType', 'Started Date', 'Description'];
    expect(detectBankFormat(headers)).toBe<BankFormat>('revolut');
  });
});

// ---------------------------------------------------------------------------
// parseEuropeanAmount
// ---------------------------------------------------------------------------

describe('parseEuropeanAmount', () => {
  it('parses standard comma-decimal European format: 1.234,56 → 1234.56', () => {
    expect(parseEuropeanAmount('1.234,56')).toBe(1234.56);
  });

  it('parses negative comma-decimal: -847,50 → -847.5', () => {
    expect(parseEuropeanAmount('-847,50')).toBe(-847.5);
  });

  it('parses dot-decimal (Wise/Revolut style): -12.50 → -12.5', () => {
    expect(parseEuropeanAmount('-12.50')).toBe(-12.5);
  });

  it('parses zero with comma: 0,00 → 0', () => {
    expect(parseEuropeanAmount('0,00')).toBe(0);
  });

  it('parses multiple dot thousand separators: -1.234.567,89 → -1234567.89', () => {
    expect(parseEuropeanAmount('-1.234.567,89')).toBe(-1234567.89);
  });

  it('parses simple integer comma amount: 500,00 → 500', () => {
    expect(parseEuropeanAmount('500,00')).toBe(500);
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseEuropeanAmount('  -42,00  ')).toBe(-42);
  });

  it('parses plain integer with no decimal separator: 100 → 100', () => {
    expect(parseEuropeanAmount('100')).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// extractExpenses — Wise
// ---------------------------------------------------------------------------

describe('extractExpenses (Wise)', () => {
  const wiseRows: Record<string, string>[] = [
    {
      'TransferWise ID': 'TR001',
      Date: '2024-01-15',
      Amount: '-42.50',
      Currency: 'EUR',
      Description: 'Grocery Store',
    },
    {
      'TransferWise ID': 'TR002',
      Date: '2024-01-20',
      Amount: '500.00',
      Currency: 'EUR',
      Description: 'Income',
    },
    {
      'TransferWise ID': 'TR003',
      Date: '2024-01-22',
      Amount: '-30.00',
      Currency: 'USD',
      Description: 'Amazon US',
    },
    {
      'TransferWise ID': 'TR004',
      Date: '2024-01-25',
      Amount: '-15.99',
      Currency: 'EUR',
      Description: 'Spotify',
    },
  ];

  it('includes EUR expense rows (negative amount, EUR currency)', () => {
    const result = extractExpenses(wiseRows, 'wise');
    const spotify = result.find(t => t.description === 'Spotify');
    expect(spotify).toBeDefined();
    expect(spotify!.amountEur).toBe(-15.99);
    expect(spotify!.date).toBe('2024-01-25');
  });

  it('excludes rows where Amount >= 0 (income)', () => {
    const result = extractExpenses(wiseRows, 'wise');
    const income = result.find(t => t.description === 'Income');
    expect(income).toBeUndefined();
  });

  it('excludes non-EUR currency rows', () => {
    const result = extractExpenses(wiseRows, 'wise');
    const usd = result.find(t => t.description === 'Amazon US');
    expect(usd).toBeUndefined();
  });

  it('maps date correctly from Date column', () => {
    const result = extractExpenses(wiseRows, 'wise');
    const grocery = result.find(t => t.description === 'Grocery Store');
    expect(grocery).toBeDefined();
    expect(grocery!.date).toBe('2024-01-15');
  });

  it('returns only 2 expense rows from 4 input rows', () => {
    const result = extractExpenses(wiseRows, 'wise');
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// extractExpenses — N26
// ---------------------------------------------------------------------------

describe('extractExpenses (N26)', () => {
  const n26Rows: Record<string, string>[] = [
    {
      Date: '2024-02-01',
      Payee: 'Rewe GmbH',
      'Account number': '',
      'Transaction type': 'MasterCard Payment',
      'Payment reference': 'Rewe 12345',
      'Amount (EUR)': '-56,40',
    },
    {
      Date: '2024-02-05',
      Payee: '',
      'Account number': '',
      'Transaction type': 'Income',
      'Payment reference': 'Freelance Feb',
      'Amount (EUR)': '2500,00',
    },
    {
      Date: '2024-02-10',
      Payee: 'Netflix',
      'Account number': '',
      'Transaction type': 'Direct Debit',
      'Payment reference': 'NF-SUB',
      'Amount (EUR)': '-15,99',
    },
    {
      Date: '2024-02-12',
      Payee: '',
      'Account number': '',
      'Transaction type': 'Direct Debit',
      'Payment reference': 'Gas bill February',
      'Amount (EUR)': '-89,00',
    },
  ];

  it('extracts negative Amount (EUR) rows as expenses', () => {
    const result = extractExpenses(n26Rows, 'n26');
    expect(result).toHaveLength(3);
  });

  it('excludes positive Amount (EUR) rows (income)', () => {
    const result = extractExpenses(n26Rows, 'n26');
    const income = result.find(t => t.description === 'Freelance Feb');
    expect(income).toBeUndefined();
  });

  it('uses Payee as description when present', () => {
    const result = extractExpenses(n26Rows, 'n26');
    const rewe = result.find(t => t.description === 'Rewe GmbH');
    expect(rewe).toBeDefined();
    expect(rewe!.amountEur).toBe(-56.4);
  });

  it('falls back to Payment reference when Payee is empty', () => {
    const result = extractExpenses(n26Rows, 'n26');
    const gas = result.find(t => t.description === 'Gas bill February');
    expect(gas).toBeDefined();
  });

  it('parses European comma decimal amounts correctly', () => {
    const result = extractExpenses(n26Rows, 'n26');
    const netflix = result.find(t => t.description === 'Netflix');
    expect(netflix).toBeDefined();
    expect(netflix!.amountEur).toBe(-15.99);
  });
});

// ---------------------------------------------------------------------------
// extractExpenses — Revolut
// ---------------------------------------------------------------------------

describe('extractExpenses (Revolut)', () => {
  const revolutRows: Record<string, string>[] = [
    {
      Type: 'CARD_PAYMENT',
      Product: 'Current',
      'Started Date': '2024-03-01 09:22:15',
      'Completed Date': '2024-03-01 09:22:16',
      Description: 'Lidl Store',
      Amount: '-32.50',
      Fee: '0',
      Currency: 'EUR',
      State: 'COMPLETED',
      Balance: '1200.00',
    },
    {
      Type: 'CARD_PAYMENT',
      Product: 'Current',
      'Started Date': '2024-03-05 14:00:00',
      'Completed Date': '',
      Description: 'Pending Coffee',
      Amount: '-4.50',
      Fee: '0',
      Currency: 'EUR',
      State: 'PENDING',
      Balance: '',
    },
    {
      Type: 'CARD_PAYMENT',
      Product: 'Current',
      'Started Date': '2024-03-08 18:30:00',
      'Completed Date': '2024-03-09 10:00:00',
      Description: 'Cancelled Purchase',
      Amount: '-50.00',
      Fee: '0',
      Currency: 'EUR',
      State: 'REVERTED',
      Balance: '1170.00',
    },
    {
      Type: 'TOPUP',
      Product: 'Current',
      'Started Date': '2024-03-10 12:00:00',
      'Completed Date': '2024-03-10 12:00:01',
      Description: 'Top-up',
      Amount: '500.00',
      Fee: '0',
      Currency: 'EUR',
      State: 'COMPLETED',
      Balance: '1670.00',
    },
    {
      Type: 'CARD_PAYMENT',
      Product: 'Current',
      'Started Date': '2024-03-15 20:00:00',
      'Completed Date': '2024-03-15 20:00:01',
      Description: 'Netflix Revolut',
      Amount: '-13.99',
      Fee: '0',
      Currency: 'EUR',
      State: 'COMPLETED',
      Balance: '1656.01',
    },
  ];

  it('includes COMPLETED expense rows only', () => {
    const result = extractExpenses(revolutRows, 'revolut');
    expect(result).toHaveLength(2); // Lidl + Netflix
  });

  it('excludes PENDING rows', () => {
    const result = extractExpenses(revolutRows, 'revolut');
    const pending = result.find(t => t.description === 'Pending Coffee');
    expect(pending).toBeUndefined();
  });

  it('excludes REVERTED rows', () => {
    const result = extractExpenses(revolutRows, 'revolut');
    const reverted = result.find(t => t.description === 'Cancelled Purchase');
    expect(reverted).toBeUndefined();
  });

  it('excludes positive amounts (top-ups/income)', () => {
    const result = extractExpenses(revolutRows, 'revolut');
    const topup = result.find(t => t.description === 'Top-up');
    expect(topup).toBeUndefined();
  });

  it('extracts YYYY-MM-DD from Started Date (which includes time)', () => {
    const result = extractExpenses(revolutRows, 'revolut');
    const lidl = result.find(t => t.description === 'Lidl Store');
    expect(lidl).toBeDefined();
    expect(lidl!.date).toBe('2024-03-01');
  });

  it('uses Description column for transaction description', () => {
    const result = extractExpenses(revolutRows, 'revolut');
    const netflix = result.find(t => t.description === 'Netflix Revolut');
    expect(netflix).toBeDefined();
    expect(netflix!.amountEur).toBe(-13.99);
  });
});

// ---------------------------------------------------------------------------
// extractExpenses — unknown format
// ---------------------------------------------------------------------------

describe('extractExpenses (unknown)', () => {
  it('returns empty array for unknown format', () => {
    const rows: Record<string, string>[] = [
      { Foo: '2024-01-01', Bar: 'Some thing', Baz: '-100' },
    ];
    const result = extractExpenses(rows, 'unknown');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseCSVFile
// ---------------------------------------------------------------------------

describe('parseCSVFile', () => {
  it('parses a Wise CSV file and returns sorted expenses', async () => {
    const csvContent = [
      'TransferWise ID,Date,Amount,Currency,Description',
      'TR001,2024-01-15,-42.50,EUR,Grocery Store',
      'TR002,2024-01-20,500.00,EUR,Invoice income',
      'TR003,2024-01-25,-15.99,EUR,Spotify',
      'TR004,2024-01-10,-30.00,USD,Amazon US',
    ].join('\n');

    const file = new File([csvContent], 'wise.csv', { type: 'text/csv' });
    const result = await parseCSVFile(file);

    // Should have 2 EUR expenses (Grocery + Spotify)
    expect(result).toHaveLength(2);
    // Sorted newest first
    expect(result[0].date).toBe('2024-01-25');
    expect(result[1].date).toBe('2024-01-15');
  });

  it('parses an N26 CSV file', async () => {
    const csvContent = [
      'Date,Payee,Account number,Transaction type,Payment reference,Amount (EUR)',
      '2024-02-01,Rewe GmbH,,MasterCard Payment,Rewe ref,-56.40',
      '2024-02-05,,,Income,Freelance Feb,2500.00',
      '2024-02-10,Netflix,,Direct Debit,NF-SUB,-15.99',
    ].join('\n');

    const file = new File([csvContent], 'n26.csv', { type: 'text/csv' });
    const result = await parseCSVFile(file);

    expect(result).toHaveLength(2); // Rewe + Netflix
    expect(result[0].date).toBe('2024-02-10'); // Newest first
    expect(result[1].date).toBe('2024-02-01');
  });

  it('parses a Revolut CSV file', async () => {
    const csvContent = [
      'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
      'CARD_PAYMENT,Current,2024-03-01 09:22:15,2024-03-01 09:22:16,Lidl Store,-32.50,0,EUR,COMPLETED,1200.00',
      'CARD_PAYMENT,Current,2024-03-05 14:00:00,,Pending Coffee,-4.50,0,EUR,PENDING,',
      'CARD_PAYMENT,Current,2024-03-15 20:00:00,2024-03-15 20:00:01,Netflix Revolut,-13.99,0,EUR,COMPLETED,1656.01',
    ].join('\n');

    const file = new File([csvContent], 'revolut.csv', { type: 'text/csv' });
    const result = await parseCSVFile(file);

    expect(result).toHaveLength(2); // Lidl + Netflix (PENDING excluded)
    expect(result[0].date).toBe('2024-03-15'); // Newest first
    expect(result[1].date).toBe('2024-03-01');
  });

  it('returns empty array for unknown format (no throw)', async () => {
    const csvContent = [
      'Foo,Bar,Baz',
      '2024-01-01,Something,-100',
    ].join('\n');

    const file = new File([csvContent], 'unknown.csv', { type: 'text/csv' });
    const result = await parseCSVFile(file);
    expect(result).toEqual([]);
  });

  it('handles UTF-8 BOM in Wise CSV', async () => {
    // BOM prefix before first header
    const csvContent = '\ufeffTransferWise ID,Date,Amount,Currency,Description\nTR001,2024-01-15,-42.50,EUR,Grocery Store\n';
    const file = new File([csvContent], 'wise-bom.csv', { type: 'text/csv' });
    const result = await parseCSVFile(file);
    // Should detect as wise and parse the expense
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Grocery Store');
  });

  it('sorts results newest-first when multiple dates', async () => {
    const csvContent = [
      'TransferWise ID,Date,Amount,Currency,Description',
      'TR001,2024-01-01,-10.00,EUR,First',
      'TR002,2024-03-15,-20.00,EUR,Last',
      'TR003,2024-02-10,-30.00,EUR,Middle',
    ].join('\n');

    const file = new File([csvContent], 'wise.csv', { type: 'text/csv' });
    const result = await parseCSVFile(file);
    expect(result[0].description).toBe('Last');
    expect(result[1].description).toBe('Middle');
    expect(result[2].description).toBe('First');
  });
});
