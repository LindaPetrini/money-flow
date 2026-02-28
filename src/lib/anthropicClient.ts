/**
 * anthropicClient.ts — Fetch wrapper for Anthropic Messages API.
 *
 * Pure TypeScript module (no React imports) — importable in Vitest/Node.
 * Calls POST https://api.anthropic.com/v1/messages with structured JSON output.
 *
 * SECURITY: API key is never logged, never included in error messages.
 */

import type { ParsedTransaction } from '@/lib/csvParser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BucketSuggestion {
  spendingAverageEur: number;
  monthsAnalyzed: number;
  reasoning: string;
  suggestedMonthlyAmountEur: number;
}

export interface AIAnalysisResult {
  everydayEssentials: BucketSuggestion;
  funDiscretionary: BucketSuggestion;
  oneOffTravel: BucketSuggestion;
  recurringFixed: BucketSuggestion;
}

export class AnthropicAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorType: string,
  ) {
    super(`Anthropic API error ${status}: ${errorType}`);
    this.name = 'AnthropicAPIError';
  }
}

// ---------------------------------------------------------------------------
// JSON Schema for structured output
// ---------------------------------------------------------------------------

const BUCKET_SCHEMA = {
  type: 'object',
  properties: {
    spendingAverageEur: { type: 'number' },
    monthsAnalyzed: { type: 'integer' },
    reasoning: { type: 'string' },
    suggestedMonthlyAmountEur: { type: 'number' },
  },
  required: ['spendingAverageEur', 'monthsAnalyzed', 'reasoning', 'suggestedMonthlyAmountEur'],
  additionalProperties: false,
};

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    everydayEssentials: BUCKET_SCHEMA,
    funDiscretionary: BUCKET_SCHEMA,
    oneOffTravel: BUCKET_SCHEMA,
    recurringFixed: BUCKET_SCHEMA,
  },
  required: ['everydayEssentials', 'funDiscretionary', 'oneOffTravel', 'recurringFixed'],
  additionalProperties: false,
};

// Export schema for use in tests and Plan 03
export { ANALYSIS_SCHEMA };

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(transactions: ParsedTransaction[]): string {
  const txList = transactions
    .map(t => `${t.date} | ${t.description} | €${Math.abs(t.amountEur).toFixed(2)}`)
    .join('\n');

  return `You are a personal finance analyst. Analyze these expense transactions and categorize them into 4 buckets:

1. **Everyday Essentials**: Groceries, utilities, transport, healthcare, rent/mortgage
2. **Fun & Discretionary**: Restaurants, entertainment, subscriptions, hobbies, shopping
3. **One-off & Travel**: Holidays, flights, hotels, large one-time purchases
4. **Recurring Fixed**: Regular subscriptions, insurance, gym, phone plans (predictable monthly costs)

Transactions (date | description | amount):
${txList}

For each bucket:
- Calculate the average monthly spending from the data
- Explain which transactions drove the categorization and why
- Suggest a monthly budget amount (round to nearest €10)

Return structured JSON with your analysis.`;
}

// ---------------------------------------------------------------------------
// Main API call
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Call the Anthropic Messages API to analyse expense transactions.
 *
 * Uses `output_config.format` (GA structured outputs) to guarantee valid JSON.
 * Requires the `anthropic-dangerous-direct-browser-access` header for CORS.
 *
 * SECURITY: apiKey is never logged, never included in thrown error messages.
 *
 * @param apiKey       - Anthropic API key from localStorage
 * @param transactions - Parsed expense transactions from csvParser
 * @returns Structured analysis result with 4 bucket suggestions
 * @throws AnthropicAPIError on non-2xx responses
 * @throws Error on network failure (caller should catch generically)
 */
export async function callAnthropicAPI(
  apiKey: string,
  transactions: ParsedTransaction[],
): Promise<AIAnalysisResult> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: buildAnalysisPrompt(transactions),
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: ANALYSIS_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { type?: string } };
    const errorType = body?.error?.type ?? 'unknown_error';
    // SECURITY: never include apiKey in error — only status + errorType from response
    throw new AnthropicAPIError(response.status, errorType);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  return JSON.parse(data.content[0].text) as AIAnalysisResult;
}
