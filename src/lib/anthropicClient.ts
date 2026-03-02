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

export interface RecurringFixedItem {
  merchant: string;           // human-readable service name
  monthlyAmountEur: number;   // monthly cost (yearly / 12 if frequency is yearly)
  frequency: 'monthly' | 'yearly';
}

export interface RecurringFixedBucket extends BucketSuggestion {
  items: RecurringFixedItem[];
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

const RECURRING_FIXED_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: 'string' },
    monthlyAmountEur: { type: 'number' },
    frequency: { type: 'string', enum: ['monthly', 'yearly'] },
  },
  required: ['merchant', 'monthlyAmountEur', 'frequency'],
  additionalProperties: false,
};

const RECURRING_FIXED_BUCKET_SCHEMA = {
  type: 'object',
  properties: {
    spendingAverageEur: { type: 'number' },
    monthsAnalyzed: { type: 'integer' },
    reasoning: { type: 'string' },
    suggestedMonthlyAmountEur: { type: 'number' },
    items: { type: 'array', items: RECURRING_FIXED_ITEM_SCHEMA },
  },
  required: ['spendingAverageEur', 'monthsAnalyzed', 'reasoning', 'suggestedMonthlyAmountEur', 'items'],
  additionalProperties: false,
};

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
  recurringFixed: RecurringFixedBucket;
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
    recurringFixed: RECURRING_FIXED_BUCKET_SCHEMA,
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

For the **Recurring Fixed** bucket specifically, also list each individual service/subscription as a separate item:
- merchant: human-readable name (e.g. "Claude AI", "Spotify", "Vittoria Assicurazioni")
- monthlyAmountEur: the monthly cost (if yearly, divide by 12 and round to 2 decimals)
- frequency: "monthly" if billed monthly, "yearly" if billed annually
- Note: single-occurrence charges matching known annual subscription patterns (e.g. €99/yr SaaS tools, annual software licenses, yearly insurance premiums) should be classified as frequency "yearly" — do not require multiple occurrences to detect annual billing

For uncertain transactions:
- Include the original description (exact case as provided)
- Include the date and amountEur (always a negative number for expenses)
- Explain why you are uncertain

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
      tools: [
        {
          name: 'submit_analysis',
          description: 'Submit structured transaction analysis results',
          input_schema: COMBINED_ANALYSIS_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_analysis' },
      messages: [
        {
          role: 'user',
          content: buildCombinedAnalysisPrompt(transactions),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { type?: string } };
    const errorType = body?.error?.type ?? 'unknown_error';
    // SECURITY: never include apiKey in error — only status + errorType from response
    throw new AnthropicAPIError(response.status, errorType);
  }

  const data = await response.json() as { content: Array<{ type: string; input: unknown }> };
  return data.content[0].input as CombinedAnalysisResult;
}

// ---------------------------------------------------------------------------
// Split discussion chat
// ---------------------------------------------------------------------------

export interface SplitChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Conversational endpoint for discussing budget splits.
 * Returns plain text — no structured output, just advice.
 */
export async function callSplitChat(
  apiKey: string,
  systemContext: string,
  history: SplitChatMessage[],
): Promise<string> {
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
      max_tokens: 1024,
      system: systemContext,
      messages: history.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { type?: string } };
    throw new AnthropicAPIError(response.status, body?.error?.type ?? 'unknown_error');
  }

  const data = await response.json() as { content: Array<{ type: string; text?: string }> };
  const textBlock = data.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}
