/**
 * anthropicClient.test.ts — Tests for new Phase 13 API functions.
 *
 * Tests callCombinedAnalysis() in isolation using vi.stubGlobal to mock fetch.
 * No real API calls are made.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  callCombinedAnalysis,
  AnthropicAPIError,
  type UncertainTransaction,
  type CombinedAnalysisResult,
} from '@/lib/anthropicClient';
import type { ParsedTransaction } from '@/lib/csvParser';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_TRANSACTIONS: ParsedTransaction[] = [
  { date: '2025-01-15', description: 'LIDL GROCERY STORE', amountEur: -45.20 },
  { date: '2025-01-20', description: 'NETFLIX SUBSCRIPTION', amountEur: -15.99 },
  { date: '2025-01-05', description: 'UNKNOWN MERCHANT XYZ', amountEur: -99.00 },
];

const SAMPLE_COMBINED_RESULT: CombinedAnalysisResult = {
  uncertainTransactions: [
    {
      description: 'UNKNOWN MERCHANT XYZ',
      date: '2025-01-05',
      amountEur: -99.00,
      reason: 'Unknown merchant — cannot determine category',
    },
  ],
  everydayEssentials: {
    spendingAverageEur: 45.20,
    monthsAnalyzed: 1,
    reasoning: 'LIDL grocery purchase',
    suggestedMonthlyAmountEur: 50,
  },
  funDiscretionary: {
    spendingAverageEur: 15.99,
    monthsAnalyzed: 1,
    reasoning: 'Netflix subscription',
    suggestedMonthlyAmountEur: 20,
  },
  oneOffTravel: {
    spendingAverageEur: 0,
    monthsAnalyzed: 1,
    reasoning: 'No one-off travel found',
    suggestedMonthlyAmountEur: 0,
  },
  recurringFixed: {
    spendingAverageEur: 15.99,
    monthsAnalyzed: 1,
    reasoning: 'Netflix is a recurring fixed subscription',
    suggestedMonthlyAmountEur: 20,
    items: [{ merchant: 'Netflix', monthlyAmountEur: 15.99, frequency: 'monthly' }],
  },
};

// ---------------------------------------------------------------------------
// Helper: create a mock fetch response
// ---------------------------------------------------------------------------

function mockFetchSuccess(responseBody: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ type: 'tool_use', input: responseBody }],
    }),
  });
}

function mockFetchError(status: number, errorType: string) {
  return vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: { type: errorType } }),
  });
}

function mockFetchNetworkFailure(message: string) {
  return vi.fn().mockRejectedValueOnce(new Error(message));
}

// ---------------------------------------------------------------------------
// callCombinedAnalysis
// ---------------------------------------------------------------------------

describe('callCombinedAnalysis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns CombinedAnalysisResult on success', async () => {
    vi.stubGlobal('fetch', mockFetchSuccess(SAMPLE_COMBINED_RESULT));

    const result = await callCombinedAnalysis('test-key', SAMPLE_TRANSACTIONS);

    expect(result.uncertainTransactions).toHaveLength(1);
    expect(result.uncertainTransactions[0].description).toBe('UNKNOWN MERCHANT XYZ');
    expect(result.uncertainTransactions[0].amountEur).toBe(-99.00);
    expect(result.uncertainTransactions[0].reason).toBeTruthy();
    expect(result.everydayEssentials.suggestedMonthlyAmountEur).toBe(50);
    expect(result.funDiscretionary.suggestedMonthlyAmountEur).toBe(20);
    expect(result.oneOffTravel).toBeTruthy();
    expect(result.recurringFixed).toBeTruthy();
  });

  it('calls fetch with correct headers including dangerous-direct-browser-access', async () => {
    const mockFetch = mockFetchSuccess(SAMPLE_COMBINED_RESULT);
    vi.stubGlobal('fetch', mockFetch);

    await callCombinedAnalysis('my-api-key', SAMPLE_TRANSACTIONS);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('my-api-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    expect(options.headers['content-type']).toBe('application/json');
    expect(options.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('uses max_tokens: 4096 (larger than legacy 2048)', async () => {
    const mockFetch = mockFetchSuccess(SAMPLE_COMBINED_RESULT);
    vi.stubGlobal('fetch', mockFetch);

    await callCombinedAnalysis('key', SAMPLE_TRANSACTIONS);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(4096);
  });

  it('uses tools with tool_choice for structured output', async () => {
    const mockFetch = mockFetchSuccess(SAMPLE_COMBINED_RESULT);
    vi.stubGlobal('fetch', mockFetch);

    await callCombinedAnalysis('key', SAMPLE_TRANSACTIONS);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].input_schema).toBeTruthy();
    expect(body.tool_choice.type).toBe('tool');
    expect(body.tool_choice.name).toBe('submit_analysis');
  });

  it('works with empty transactions array', async () => {
    const emptyResult: CombinedAnalysisResult = {
      ...SAMPLE_COMBINED_RESULT,
      uncertainTransactions: [],
    };
    const mockFetch = mockFetchSuccess(emptyResult);
    vi.stubGlobal('fetch', mockFetch);

    const result = await callCombinedAnalysis('key', []);

    // Still calls the API
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.uncertainTransactions).toHaveLength(0);
  });

  it('throws AnthropicAPIError on non-2xx response', async () => {
    vi.stubGlobal('fetch', mockFetchError(401, 'authentication_error'));

    await expect(callCombinedAnalysis('bad-key', SAMPLE_TRANSACTIONS)).rejects.toThrow(
      AnthropicAPIError,
    );
  });

  it('AnthropicAPIError has correct status and errorType', async () => {
    vi.stubGlobal('fetch', mockFetchError(429, 'rate_limit_error'));

    try {
      await callCombinedAnalysis('key', SAMPLE_TRANSACTIONS);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AnthropicAPIError);
      expect((err as AnthropicAPIError).status).toBe(429);
      expect((err as AnthropicAPIError).errorType).toBe('rate_limit_error');
    }
  });

  it('does NOT include apiKey in thrown error message', async () => {
    vi.stubGlobal('fetch', mockFetchError(401, 'authentication_error'));

    try {
      await callCombinedAnalysis('super-secret-key', SAMPLE_TRANSACTIONS);
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).not.toContain('super-secret-key');
    }
  });

  it('throws generic Error on network failure', async () => {
    vi.stubGlobal('fetch', mockFetchNetworkFailure('Network error'));

    await expect(callCombinedAnalysis('key', SAMPLE_TRANSACTIONS)).rejects.toThrow('Network error');
  });
});

// ---------------------------------------------------------------------------
// Schema structure tests (no API call needed)
// ---------------------------------------------------------------------------

describe('COMBINED_ANALYSIS_SCHEMA structure', () => {
  it('exported types are well-shaped (compile-time check via type inference)', () => {
    // If TypeScript compiles these, the types are correct
    const tx: UncertainTransaction = {
      description: 'TEST',
      date: '2025-01-01',
      amountEur: -10,
      reason: 'test reason',
    };

    expect(tx.description).toBe('TEST');
  });
});
