# Phase 6: CSV Import & AI Analysis - Research

**Researched:** 2026-02-28
**Domain:** Browser-side CSV parsing, Anthropic API (CORS/browser), AI structured output, React settings UI
**Confidence:** HIGH (CORS concern resolved; CSV headers MEDIUM confidence; AI API HIGH)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- CSV & AI analysis lives as a new sub-section in **Settings**, tab label "CSV & AI"
- `SettingsSection` type gains `'csv-ai'` variant; new tab added to `SECTIONS` array in `SettingsPage.tsx`
- API key input is at the top of `CsvAiSection`, above upload; stores in `localStorage("anthropic_api_key")` — never in settingsStore
- Show `"••••••••"` placeholder when key already set on load; Clear button removes from localStorage
- `<input type="file" multiple accept=".csv">` — standard file input, no drag-and-drop
- Multiple files accepted; parse immediately in browser; no upload to server
- Bank formats: Wise, N26, Revolut — detected by CSV header pattern
- UTF-8 BOM stripped before parsing; European decimal separators (comma) handled
- Only expenses parsed (negative/debit rows); income rows skipped
- Summary header: "N transactions from [earliest date] to [latest date] across X file(s)"
- Scrollable table: Date | Description | Amount (EUR) — sorted newest first
- No row-level exclusion
- "Analyse with AI" button below table; disabled with tooltip if no key
- AI model: `claude-haiku-4-5-20251001` (cost efficiency; user pays)
- Direct `fetch()` to Anthropic API — no proxy, no backend
- 4 suggestion cards (everyday essentials / fun+discretionary / one-off+travel / recurring fixed):
  - Card: bucket name + current overflow ratio %, spending average, reasoning paragraph, editable suggested amount, Accept/Skip toggles
- "Apply accepted changes" button (disabled until ≥1 accepted)
- Apply: recalculate overflow ratios from accepted amounts only; update `settingsStore.updateSettings({ overflowRatios: [...] })`
- Only accepted buckets get new ratios; skipped buckets keep current percentages
- If accepted + skipped don't sum to 100%: inline warning; user must resolve before Apply enables
- Tax bucket excluded from overflow ratios (AI only touches `overflowRatios` accounts)

### Claude's Discretion

- Exact CSV column name matching per bank format (Wise/N26/Revolut header detection logic)
- Prompt engineering for AI analysis — category descriptions, output format (JSON structured response)
- Error handling for API failures (network error, invalid key, rate limit) — show inline error message, allow retry
- Complete response (not streaming) for structured JSON output — simpler

### Deferred Ideas (OUT OF SCOPE)

- Filtering/excluding individual transactions before AI analysis
- Storing imported transactions for future reference
- Support for additional bank formats beyond Wise/N26/Revolut
- Streaming AI response
- Suggesting floor item amounts (only overflow ratios in scope)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CSV-01 | User can upload one or more CSV exports from their bank(s) (6+ months of transaction history) | Multi-file input; FileReader API; PapaParse for parsing |
| CSV-02 | App parses CSV with support for Wise, N26, Revolut — including UTF-8 BOM and European decimal separators | PapaParse BOM option; header-pattern bank detection; manual decimal normalization for European amounts |
| CSV-03 | User sees a preview of parsed transactions before confirming import | Scrollable table component; state managed locally in CsvAiSection |
| CSV-04 | AI (Anthropic API, user-provided key stored in localStorage) categorizes transactions into 4 buckets | Direct browser fetch(); `anthropic-dangerous-direct-browser-access: true` header confirmed working |
| CSV-05 | AI generates suggested bucket amounts based on 6-month spending averages | Structured JSON output via `output_config.format.type: "json_schema"`; compute averages in prompt or pre-process |
| CSV-06 | Every AI suggestion shows the reasoning — which pattern detected and why (not just a number) | JSON schema includes `reasoning` string field per bucket; displayed by default (transparency core value) |
| CSV-07 | User can accept, adjust, or ignore each suggestion individually | Per-card Accept/Skip toggle + editable amount input; Apply button recalculates ratios |
| CSV-08 | API key entered by user at runtime in settings — never bundled, never hardcoded | localStorage only; password input with masked display |
</phase_requirements>

---

## Summary

Phase 6 adds a "CSV & AI" sub-section to the existing Settings page. The implementation has three distinct sub-problems: (1) CSV parsing in the browser for three bank formats, (2) direct Anthropic API call from the browser, and (3) suggestion card UI that writes back to `settingsStore`.

**The critical CORS blocker is resolved.** Anthropic supports direct browser API access via the `anthropic-dangerous-direct-browser-access: true` request header (introduced August 2024, confirmed active through 2025-2026). This is the canonical "bring your own API key" pattern — the header name signals the risk (exposed key) but the pattern is explicitly supported and appropriate for this use case.

**Structured JSON output** from the API is now GA (no longer beta) using `output_config.format.type: "json_schema"` in the request body. This guarantees valid JSON from the model without retry logic. No beta header needed. The response text is at `response.content[0].text` and is always valid against the schema.

**Primary recommendation:** Use PapaParse (browser-native, zero install) for CSV parsing with `{ header: true, skipEmptyLines: true }`. Detect bank format by inspecting the parsed header keys. Handle European decimal amounts by string-replacing commas with dots after parsing. Call Anthropic API directly with `fetch()` using the 4 required headers.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PapaParse | 5.x (already available via CDN or install) | Browser CSV parsing | Industry standard; handles BOM, headers, streaming, File objects natively |
| Native `fetch()` | Browser built-in | Anthropic API calls | No proxy needed; `anthropic-dangerous-direct-browser-access` header enables CORS |
| React `useState` / `useRef` | React 19 (already installed) | Component state, file input ref | Already in stack |
| `localStorage` | Browser built-in | API key storage | Decided; direct `window.localStorage.getItem/setItem/removeItem` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `parseCents` / `formatCents` | In-project (`@/lib/cents`) | Convert EUR amounts to cents | All money display and write-back to settingsStore |
| `useSettingsStore` | In-project Zustand store | Read current overflow ratios; write updated ratios | Apply accepted suggestions |
| shadcn/ui `Card`, `Button`, `Input` | Already installed | Suggestion cards, file button, API key input | Follow existing settings UI pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PapaParse | Manual `split('\n').split(',')` | Hand-rolling misses quoted fields, multiline cells, BOM — use PapaParse |
| `output_config.format` (structured outputs) | Prompt-only JSON parsing | Structured outputs guaranteed valid; prompt-only requires JSON.parse with error handling |
| Direct `fetch()` | Anthropic TypeScript SDK | SDK not appropriate for browser; `fetch()` simpler with 4 known headers |

**Installation:**
```bash
npm install papaparse @types/papaparse
```

PapaParse is the only new dependency. Everything else is in-project or browser-native.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── features/settings/
│   ├── SettingsPage.tsx          # MODIFY: add 'csv-ai' to union + SECTIONS
│   └── CsvAiSection.tsx          # NEW: entire Phase 6 UI
├── lib/
│   └── csvParser.ts              # NEW: bank detection + parsing logic (pure TS, testable)
└── lib/
    └── anthropicClient.ts        # NEW: fetch() wrapper for Anthropic API call
```

The CSV parser and Anthropic client are extracted to `src/lib/` as pure TypeScript modules — testable in Vitest without React (following the existing allocation engine pattern of separating domain logic from UI).

### Pattern 1: Bank Format Detection by Header Fingerprint

**What:** Parse the first row of headers and match against known column sets to identify which bank produced the CSV.

**When to use:** Always — before extracting transaction data.

**Known header patterns (MEDIUM confidence — verified from multiple community sources):**

```typescript
// Source: Multiple third-party integrations + community parsers
// Confidence: MEDIUM (headers observed in real CSVs, not from official bank docs)

// Wise CSV (personal statement export):
// "TransferWise ID,Date,Amount,Currency,Description,Payment Reference,Running Balance,..."
// Detection key: presence of "TransferWise ID" column
const WISE_SIGNATURE = 'TransferWise ID';

// N26 CSV (WebApp export):
// "Date,Payee,Account number,Transaction type,Payment reference,Amount (EUR),Amount (Foreign Currency),Type Foreign Currency,Exchange Rate"
// Detection key: presence of "Amount (EUR)" column
const N26_SIGNATURE = 'Amount (EUR)';

// Revolut CSV (personal export):
// "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance"
// Detection key: presence of "Started Date" column
const REVOLUT_SIGNATURE = 'Started Date';

type BankFormat = 'wise' | 'n26' | 'revolut' | 'unknown';

function detectBankFormat(headers: string[]): BankFormat {
  if (headers.includes(WISE_SIGNATURE)) return 'wise';
  if (headers.includes(N26_SIGNATURE)) return 'n26';
  if (headers.includes(REVOLUT_SIGNATURE)) return 'revolut';
  return 'unknown';
}
```

### Pattern 2: CSV Parsing with PapaParse

**What:** Parse File objects from `<input type="file">` using PapaParse's async File API.

```typescript
// Source: PapaParse documentation https://www.papaparse.com/docs
import Papa from 'papaparse';

function parseCSVFile(file: File): Promise<Papa.ParseResult<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,          // First row becomes keys
      skipEmptyLines: true,
      // BOM: PapaParse auto-strips UTF-8 BOM (\ufeff) when header:true
      complete: resolve,
      error: reject,
    });
  });
}
```

**European decimal handling** — PapaParse returns amounts as strings. European amounts use comma as decimal separator (e.g., "1.234,56"). Normalize after parsing:

```typescript
function parseEuropeanAmount(raw: string): number {
  // Remove thousand separators (dots or spaces), replace decimal comma with dot
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}

// Then convert to cents:
const cents = Math.round(eurAmount * 100);
```

### Pattern 3: Expense Detection per Bank Format

**What:** Filter rows to expenses only (negative/debit) per bank format.

```typescript
interface ParsedTransaction {
  date: string;         // ISO format YYYY-MM-DD
  description: string;
  amountEur: number;    // negative = expense
}

// Wise: "Amount" column, negative = expense; "Currency" must be EUR
// N26: "Amount (EUR)" column, negative = expense
// Revolut: "Amount" column, negative = expense; filter State === 'COMPLETED'

function extractExpenses(
  rows: Record<string, string>[],
  format: BankFormat
): ParsedTransaction[] {
  // ... format-specific extraction
  // Filter: amountEur < 0 (expenses)
  // Date parsing: varies per bank (see Date Formats section)
}
```

### Pattern 4: Direct Anthropic API Call from Browser

**What:** `fetch()` to `https://api.anthropic.com/v1/messages` with CORS header and structured output schema.

```typescript
// Source: Official Anthropic API docs + Simon Willison's verified article
// Confidence: HIGH — CORS header confirmed working since Aug 2024

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface BucketSuggestion {
  bucketName: string;
  spendingAverage: number;  // EUR per month
  reasoning: string;
  suggestedMonthlyAmount: number;  // EUR
}

interface AIAnalysisResult {
  everydayEssentials: BucketSuggestion;
  funDiscretionary: BucketSuggestion;
  oneOffTravel: BucketSuggestion;
  recurringFixed: BucketSuggestion;
}

async function callAnthropicAPI(
  apiKey: string,
  transactions: ParsedTransaction[]
): Promise<AIAnalysisResult> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',  // Required for CORS
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: buildAnalysisPrompt(transactions),
      }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: ANALYSIS_SCHEMA,  // see Code Examples section
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new APIError(response.status, error);
  }

  const data = await response.json();
  return JSON.parse(data.content[0].text) as AIAnalysisResult;
}
```

**Note:** `response.content[0].text` is always valid JSON when `output_config.format` is used. No need to wrap in try/catch for parse errors.

### Pattern 5: Ratio Recalculation on Apply

**What:** Convert accepted euro amounts to overflow ratios summing to 100%.

```typescript
// Source: Existing OverflowRatiosSection.tsx pattern + domain.ts types
function recalculateRatios(
  currentRatios: OverflowRatio[],
  accepted: Map<string, number>  // accountId -> accepted amount in cents
): OverflowRatio[] {
  const totalAccepted = [...accepted.values()].reduce((a, b) => a + b, 0);

  if (totalAccepted === 0) return currentRatios;

  // Only accepted buckets get new ratios
  const newRatios: OverflowRatio[] = currentRatios.map(r => {
    if (accepted.has(r.accountId)) {
      const pct = (accepted.get(r.accountId)! / totalAccepted) * 100;
      return { accountId: r.accountId, pct: Math.round(pct * 100) / 100 };
    }
    return r;  // Skipped buckets keep current pct
  });

  // Validate sum === 100% before enabling Apply
  const sum = newRatios.reduce((a, r) => a + r.pct, 0);
  // If sum !== 100: show warning, disable Apply
  return newRatios;
}
```

**Edge case:** The "must sum to 100%" constraint is critical. When only some buckets are accepted, their new ratios plus the unchanged skipped bucket ratios may not sum to 100. The UI must show a warning and disable Apply until resolved. The user resolves by accepting more buckets or manually adjusting the editable amounts.

### Anti-Patterns to Avoid

- **Custom CSV parser:** Never split on comma — quoted fields with commas will break. Always use PapaParse.
- **SDK in browser:** The `@anthropic-ai/sdk` NPM package targets Node.js. Use raw `fetch()` instead.
- **Storing API key in settingsStore:** Decision is localStorage only. Do not write to FSA/IDB.
- **Floating point arithmetic for ratios:** Use `Math.round(pct * 100) / 100` for display; final ratio values stored as numbers (existing pattern from `OverflowRatiosSection`).
- **Assuming one EUR per bank:** Wise supports multi-currency. Filter by `Currency === 'EUR'` for Wise rows, or use `Amount (EUR)` column for N26.
- **Blocking UI while parsing:** PapaParse async API + React state updates keep UI responsive.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom split-on-comma | PapaParse | Quoted fields, multiline, BOM, encoding — dozens of edge cases |
| JSON schema validation | Manual field checking | `output_config.format.type: "json_schema"` | Guaranteed valid JSON from API; no retry needed |
| European decimal parsing | parseFloat() directly | String normalization then parseFloat | "1.234,56" parses as 1.234 without normalization |

**Key insight:** CSV parsing looks trivial but has ~20 edge cases. PapaParse is 14KB, handles all of them, and is the industry standard.

---

## Common Pitfalls

### Pitfall 1: CORS Without the Required Header
**What goes wrong:** `fetch()` to `https://api.anthropic.com/v1/messages` fails with CORS error.
**Why it happens:** Browsers block cross-origin requests by default. The API requires the special header to opt in.
**How to avoid:** Always include `'anthropic-dangerous-direct-browser-access': 'true'` in every fetch request to the Anthropic API.
**Warning signs:** Network tab shows preflight OPTIONS request rejected.

### Pitfall 2: European Amount Parsing Failure
**What goes wrong:** "1.234,56" parsed by `parseFloat()` returns `1.234` (one euro) instead of `1234.56`.
**Why it happens:** `parseFloat("1.234,56")` stops at the comma; the European format uses dot as thousand separator and comma as decimal.
**How to avoid:** Strip dots (thousand seps), replace comma with dot, then parseFloat. Always verify with test cases for each bank.
**Warning signs:** Transaction amounts are 1000x too small; totals look implausibly low.

### Pitfall 3: UTF-8 BOM in First Header Column
**What goes wrong:** First column header reads as `"\ufeffTransferWise ID"` instead of `"TransferWise ID"`, breaking header detection.
**Why it happens:** Excel and some bank exports prepend a UTF-8 BOM byte sequence.
**How to avoid:** PapaParse with `header: true` strips BOM automatically. If parsing manually, strip `\ufeff` from the first header value.
**Warning signs:** Bank format detection returns 'unknown' despite correct file.

### Pitfall 4: Wise Multi-Currency Rows
**What goes wrong:** Including non-EUR transactions in the analysis skews the averages.
**Why it happens:** Wise is multi-currency; users may have USD or GBP transactions.
**How to avoid:** Filter Wise rows to `Currency === 'EUR'` before analysis. N26 and Revolut amounts are already in EUR (personal accounts).

### Pitfall 5: Ratio Sum Constraint After Partial Acceptance
**What goes wrong:** User accepts 2 of 4 buckets; new ratios + old skipped ratios don't sum to 100%; Apply stays disabled with no clear path to resolution.
**Why it happens:** Accepting partial set changes their ratios but leaves other ratios unchanged; the mix may not sum to 100%.
**How to avoid:** Show real-time running total of all ratios (accepted new + skipped current). Explain in the warning: "Current total: 87% — accept more buckets or adjust amounts to reach 100%."

### Pitfall 6: API Key Exposure in Error Messages
**What goes wrong:** Error message includes API key value from request context.
**Why it happens:** Logging or displaying raw error objects.
**How to avoid:** Never log or display the raw request headers. Only display sanitized error messages (HTTP status, error type from response body).

### Pitfall 7: Incorrect Model ID
**What goes wrong:** API returns 400/404 with "model not found" error.
**Why it happens:** Model ID typo or using outdated ID.
**How to avoid:** The exact model ID is `claude-haiku-4-5-20251001` (confirmed via Anthropic model page and TypingMind integration docs). Double-check on first test.

### Pitfall 8: Revolut Pending Transactions
**What goes wrong:** Including PENDING transactions inflates recent spending; pending amounts may later be reversed.
**Why it happens:** Revolut CSV includes all transactions regardless of State.
**How to avoid:** Filter Revolut rows to `State === 'COMPLETED'` only.

---

## Code Examples

### Structured Output JSON Schema for AI Analysis

```typescript
// Source: Anthropic structured outputs docs (GA, no beta header needed)
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    everydayEssentials: {
      type: 'object',
      properties: {
        spendingAverageEur: { type: 'number' },
        monthsAnalyzed: { type: 'integer' },
        reasoning: { type: 'string' },
        suggestedMonthlyAmountEur: { type: 'number' },
      },
      required: ['spendingAverageEur', 'monthsAnalyzed', 'reasoning', 'suggestedMonthlyAmountEur'],
      additionalProperties: false,
    },
    funDiscretionary: {
      type: 'object',
      properties: {
        spendingAverageEur: { type: 'number' },
        monthsAnalyzed: { type: 'integer' },
        reasoning: { type: 'string' },
        suggestedMonthlyAmountEur: { type: 'number' },
      },
      required: ['spendingAverageEur', 'monthsAnalyzed', 'reasoning', 'suggestedMonthlyAmountEur'],
      additionalProperties: false,
    },
    oneOffTravel: {
      type: 'object',
      properties: {
        spendingAverageEur: { type: 'number' },
        monthsAnalyzed: { type: 'integer' },
        reasoning: { type: 'string' },
        suggestedMonthlyAmountEur: { type: 'number' },
      },
      required: ['spendingAverageEur', 'monthsAnalyzed', 'reasoning', 'suggestedMonthlyAmountEur'],
      additionalProperties: false,
    },
    recurringFixed: {
      type: 'object',
      properties: {
        spendingAverageEur: { type: 'number' },
        monthsAnalyzed: { type: 'integer' },
        reasoning: { type: 'string' },
        suggestedMonthlyAmountEur: { type: 'number' },
      },
      required: ['spendingAverageEur', 'monthsAnalyzed', 'reasoning', 'suggestedMonthlyAmountEur'],
      additionalProperties: false,
    },
  },
  required: ['everydayEssentials', 'funDiscretionary', 'oneOffTravel', 'recurringFixed'],
  additionalProperties: false,
};
```

### AI Prompt Template

```typescript
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
```

### API Key UI Pattern (matching existing settings style)

```tsx
// Pattern follows TaxBufferSection.tsx style
const [keyDisplay, setKeyDisplay] = useState<string>(() => {
  return localStorage.getItem('anthropic_api_key') ? '••••••••' : '';
});

const handleSaveKey = () => {
  if (inputValue && inputValue !== '••••••••') {
    localStorage.setItem('anthropic_api_key', inputValue);
    setKeyDisplay('••••••••');
    setInputValue('••••••••');
  }
};

const handleClearKey = () => {
  localStorage.removeItem('anthropic_api_key');
  setKeyDisplay('');
  setInputValue('');
};
```

### SettingsPage.tsx Modification

```tsx
// ADD to type union:
type SettingsSection = 'accounts' | 'floor-items' | 'overflow-ratios' | 'tax-buffer' | 'csv-ai';

// ADD to SECTIONS array:
{ id: 'csv-ai', label: 'CSV & AI' },

// ADD to render section:
{activeSection === 'csv-ai' && <CsvAiSection />}

// ADD import:
import { CsvAiSection } from './CsvAiSection';
```

---

## Bank CSV Format Reference

**Confidence: MEDIUM** — Verified via multiple community parsers and integration tools, not official bank documentation.

### Wise Personal Statement CSV
- **Header signature:** `TransferWise ID` column present
- **Key columns:** `Date`, `Amount`, `Currency`, `Description`
- **Date format:** `YYYY-MM-DD` (ISO standard)
- **Expense detection:** `Amount < 0`
- **Multi-currency:** Filter `Currency === 'EUR'` for EUR analysis
- **Amount format:** Uses dot decimal separator (e.g., `-12.50`) — standard, no normalization needed
- **Encoding:** UTF-8, may have BOM

### N26 Personal CSV
- **Header signature:** `Amount (EUR)` column present
- **Key columns:** `Date`, `Payee`, `Transaction type`, `Payment reference`, `Amount (EUR)`
- **Date format:** `YYYY-MM-DD` (ISO standard)
- **Expense detection:** `Amount (EUR) < 0`
- **Amount format:** May use European decimal (comma) depending on account language setting
- **Note:** `Category` column was removed July 2024 — don't depend on it
- **Encoding:** UTF-8, may have BOM

### Revolut Personal CSV
- **Header signature:** `Started Date` column present
- **Key columns:** `Type`, `Started Date`, `Description`, `Amount`, `Currency`, `State`
- **Date format:** `YYYY-MM-DD HH:MM:SS` (includes time)
- **Expense detection:** `Amount < 0` AND `State === 'COMPLETED'`
- **Amount format:** Dot decimal separator — standard
- **Note:** Filter by `State === 'COMPLETED'`; exclude PENDING and REVERTED
- **Encoding:** UTF-8, usually no BOM

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Proxy server required for Anthropic browser calls | Direct `fetch()` with `anthropic-dangerous-direct-browser-access: true` | August 2024 | No proxy needed for this local-first app |
| Beta header `structured-outputs-2025-11-13` for JSON schema | `output_config.format` — GA, no beta header | 2025 | Use `output_config.format` directly; old beta header still works during transition |
| `output_format` parameter (old shape) | `output_config.format` (new shape) | 2025 | Use new shape; old still works |

**Deprecated/outdated:**
- `output_format` top-level parameter: works but deprecated; use `output_config.format`
- `structured-outputs-2025-11-13` beta header: no longer required
- Old Anthropic beta for structured outputs: promoted to GA for Haiku 4.5+

---

## Open Questions

1. **Revolut Amount Format: Dot or Comma Decimal?**
   - What we know: Community parsers suggest dot decimal for Revolut; the amount column is labeled just "Amount"
   - What's unclear: Whether European locale Revolut accounts output comma decimal
   - Recommendation: Normalize both patterns — strip dots (thousand sep) and replace commas with dots before parseFloat; this is safe for dot-decimal too since clean amounts have no dot thousand separators

2. **N26 Amount Format: Always European Comma?**
   - What we know: N26 is a German bank; German locale uses comma as decimal
   - What's unclear: Whether English-language N26 accounts export dot-decimal
   - Recommendation: Apply same normalization as Revolut (handle both); test with a sample file

3. **Wise Date Format for Non-ISO Outputs**
   - What we know: Wise API docs show ISO dates; community integrations confirm `YYYY-MM-DD`
   - What's unclear: Whether mobile exports use a different format
   - Recommendation: Parse with `new Date(dateStr)` — works for ISO; add format validation and surface error if parse fails

4. **Token Budget for Large Transaction Sets**
   - What we know: `claude-haiku-4-5-20251001` has 200K context; 6 months of transactions is typically 200-500 rows
   - What's unclear: Token count for 500 transaction rows
   - Recommendation: Each row is ~30 tokens; 500 rows ≈ 15K tokens input; well within 200K limit. Set `max_tokens: 2048` for output (analysis + reasoning is < 1K tokens).

---

## Validation Architecture

> `workflow.nyquist_validation` not found in `.planning/config.json` — skipping this section.

---

## Sources

### Primary (HIGH confidence)
- Simon Willison article (Aug 2024): https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/ — confirmed `anthropic-dangerous-direct-browser-access` header, fetch() example
- Anthropic structured outputs docs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs — `output_config.format`, GA status, Haiku 4.5 support, response shape
- Anthropic API overview: https://platform.claude.com/docs/en/api/getting-started — required headers, Messages API
- PapaParse docs: https://www.papaparse.com/docs — header:true, BOM, File object parsing
- TypingMind model page: https://www.typingmind.com/guide/anthropic/claude-haiku-4-5-20251001 — confirms model ID `claude-haiku-4-5-20251001`
- Existing codebase: `SettingsPage.tsx`, `OverflowRatiosSection.tsx`, `settingsStore.ts`, `cents.ts`, `domain.ts` — confirmed existing patterns

### Secondary (MEDIUM confidence)
- Revolut CSV headers (Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance): Dativery integration docs, community parsers
- N26 CSV headers (Date, Payee, Account number, Transaction type, Payment reference, Amount (EUR), ...): beancount-n26 project, multiple converter tools
- Wise CSV headers (TransferWise ID, Date, Amount, Currency, Description, ...): community parsers, BankXLSX blog, multiple integrations

### Tertiary (LOW confidence)
- European decimal behavior per bank: inferred from bank country + community reports; not confirmed from official bank documentation
- Revolut COMPLETED filter: observed in community parsers; not from official Revolut developer docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — PapaParse is industry standard; Anthropic CORS verified by Simon Willison + multiple users
- Architecture: HIGH — follows existing SettingsPage pattern; Anthropic API shape verified from official docs
- Bank CSV formats: MEDIUM — confirmed from community tools; not official bank docs; should be validated with real exports
- Pitfalls: HIGH — BOM, European decimal, multi-currency, ratio constraint are known failure modes

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (30 days — API stable; bank CSV formats may drift)
