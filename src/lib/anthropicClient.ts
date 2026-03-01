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

// ---------------------------------------------------------------------------
// New types (Phase 13)
// ---------------------------------------------------------------------------

export interface UncertainTransaction {
  description: string; // original CSV description (exact case — used for merchant lookup)
  date: string;        // ISO YYYY-MM-DD
  amountEur: number;   // negative for expenses
  reason: string;      // why AI is uncertain — shown in Q&A card
}

export interface CombinedAnalysisResult {
  uncertainTransactions: UncertainTransaction[];
  everydayEssentials: BucketSuggestion;
  funDiscretionary: BucketSuggestion;
  oneOffTravel: BucketSuggestion;
  recurringFixed: BucketSuggestion;
}

export interface FloorItemSuggestion {
  name: string;        // suggested floor item name e.g. "Rent"
  amountEur: number;   // detected recurring amount — positive, AI returns absolute value
  frequency: string;   // "monthly" | "quarterly" — for transparency display
  confidence: string;  // "high" | "medium" — for display
  reason: string;      // why this looks like a floor item
}

export interface FloorDetectionResult {
  suggestions: FloorItemSuggestion[];
}

// ---------------------------------------------------------------------------
// New schemas (Phase 13 — internal, not exported)
// ---------------------------------------------------------------------------

const UNCERTAIN_TRANSACTION_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    date: { type: 'string' },
    amountEur: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['description', 'date', 'amountEur', 'reason'],
  additionalProperties: false,
};

const COMBINED_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    uncertainTransactions: {
      type: 'array',
      items: UNCERTAIN_TRANSACTION_SCHEMA,
    },
    everydayEssentials: BUCKET_SCHEMA,
    funDiscretionary: BUCKET_SCHEMA,
    oneOffTravel: BUCKET_SCHEMA,
    recurringFixed: BUCKET_SCHEMA,
  },
  required: [
    'uncertainTransactions',
    'everydayEssentials',
    'funDiscretionary',
    'oneOffTravel',
    'recurringFixed',
  ],
  additionalProperties: false,
};

const FLOOR_ITEM_SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    amountEur: { type: 'number' },
    frequency: { type: 'string' },
    confidence: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['name', 'amountEur', 'frequency', 'confidence', 'reason'],
  additionalProperties: false,
};

const FLOOR_DETECTION_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: FLOOR_ITEM_SUGGESTION_SCHEMA,
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Prompt builders (Phase 13 — internal, not exported)
// ---------------------------------------------------------------------------

function buildCombinedAnalysisPrompt(transactions: ParsedTransaction[]): string {
  const txList = transactions
    .map(t => `${t.date} | ${t.description} | €${Math.abs(t.amountEur).toFixed(2)}`)
    .join('\n');

  return `You are a personal finance analyst. Analyze these expense transactions and do two things:

1. Classify each transaction into one of 4 spending buckets:
   - **Everyday Essentials**: Groceries, utilities, transport, healthcare, rent/mortgage
   - **Fun & Discretionary**: Restaurants, entertainment, subscriptions, hobbies, shopping
   - **One-off & Travel**: Holidays, flights, hotels, large one-time purchases
   - **Recurring Fixed**: Regular subscriptions, insurance, gym, phone plans (predictable monthly costs)

2. Identify **uncertain transactions** — flag as uncertain if: unknown merchants, first-time payees, ambiguous descriptions where you cannot confidently assign a bucket.

Transactions (date | description | amount):
${txList.length > 0 ? txList : '(no transactions provided)'}

For each bucket:
- Calculate the average monthly spending from the data
- Explain which transactions drove the categorization and why
- Suggest a monthly budget amount (round to nearest €10)

For uncertain transactions:
- Include the original description (exact case as provided)
- Include the date and amountEur (always a negative number for expenses)
- Explain why you are uncertain

Return structured JSON matching the schema exactly.`;
}

function buildFloorDetectionPrompt(
  transactions: ParsedTransaction[],
  clarifications: Array<{ merchantName: string; bucketAccountId: string; context?: string }>,
): string {
  const txList = transactions
    .map(t => `${t.date} | ${t.description} | €${Math.abs(t.amountEur).toFixed(2)}`)
    .join('\n');

  const clarificationList =
    clarifications.length > 0
      ? clarifications
          .map(
            c =>
              `- "${c.merchantName}" → bucket: ${c.bucketAccountId}${c.context ? ` (context: ${c.context})` : ''}`,
          )
          .join('\n')
      : '(none)';

  return `You are a personal finance analyst. Identify recurring fixed expenses (floor items) from these transactions.

Already-clarified merchants (skip these as floor candidates):
${clarificationList}

All transactions (date | description | amount):
${txList.length > 0 ? txList : '(no transactions provided)'}

Identify transactions that appear to be recurring monthly or quarterly fixed expenses (e.g. rent, subscriptions, insurance, phone plans). These are candidates to become "floor items" — minimum amounts that must be covered before any other budgeting.

For each suggestion:
- name: a human-readable name for the floor item (e.g. "Rent", "Gym membership")
- amountEur: the recurring amount as a POSITIVE number (absolute value of the expense magnitude)
- frequency: "monthly" or "quarterly"
- confidence: "high" (appears multiple times, consistent amount) or "medium" (appears once, pattern unclear)
- reason: brief explanation of why this looks like a floor item

Return structured JSON matching the schema exactly.`;
}

// ---------------------------------------------------------------------------
// New API functions (Phase 13)
// ---------------------------------------------------------------------------

/**
 * Call Anthropic to classify transactions into 4 buckets AND identify uncertain transactions
 * in a single API call. Supersedes callAnthropicAPI() for the AI analysis flow.
 *
 * @param apiKey       - Anthropic API key from localStorage
 * @param transactions - Parsed expense transactions from csvParser
 * @returns Combined analysis: bucket suggestions + uncertain transaction list
 * @throws AnthropicAPIError on non-2xx responses
 * @throws Error on network failure (caller should catch generically)
 */
export async function callCombinedAnalysis(
  apiKey: string,
  transactions: ParsedTransaction[],
): Promise<CombinedAnalysisResult> {
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
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildCombinedAnalysisPrompt(transactions),
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: COMBINED_ANALYSIS_SCHEMA,
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
  return JSON.parse(data.content[0].text) as CombinedAnalysisResult;
}

/**
 * Call Anthropic to detect recurring floor items from expense transactions,
 * using already-answered Q&A clarifications to skip known merchants.
 *
 * @param apiKey         - Anthropic API key from localStorage
 * @param transactions   - Parsed expense transactions from csvParser
 * @param clarifications - Already-answered merchant clarifications (skip as floor candidates)
 * @returns Floor detection result with suggestions array
 * @throws AnthropicAPIError on non-2xx responses
 * @throws Error on network failure (caller should catch generically)
 */
export async function callFloorDetection(
  apiKey: string,
  transactions: ParsedTransaction[],
  clarifications: Array<{ merchantName: string; bucketAccountId: string; context?: string }>,
): Promise<FloorDetectionResult> {
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
          content: buildFloorDetectionPrompt(transactions, clarifications),
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: FLOOR_DETECTION_SCHEMA,
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
  return JSON.parse(data.content[0].text) as FloorDetectionResult;
}

// ---------------------------------------------------------------------------
// Legacy API call (deprecated)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use callCombinedAnalysis() instead — superseded in Phase 13.
 * This function only returns bucket suggestions without uncertain transaction detection.
 * Retained for backward compatibility; will be removed in a future phase.
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
