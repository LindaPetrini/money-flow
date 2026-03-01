# Phase 13: AI Layer - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add three AI-driven capabilities to the existing CSV import flow in `CsvAiSection`:
1. Uncertain transaction Q&A — AI identifies unconfident transactions; user provides context and selects a bucket
2. Merchant memory — Q&A answers persist to `merchantStore`; known merchants are pre-classified on future imports
3. Floor item detection — AI detects recurring expenses from the CSV and suggests them as pre-filled floor items in `FloorItemsSection`

The existing bucket analysis / overflow ratio suggestion flow is merged into the Q&A detection call (not a separate call).

</domain>

<decisions>
## Implementation Decisions

### API call budget
- The entire CSV session makes at most 2 Anthropic API calls
- **Call 1 (combined):** Classify all transactions — returns `uncertain_transactions[]` (for Q&A) + bucket ratio suggestions (replaces the existing standalone `callAnthropicAPI` bucket analysis)
- **Call 2:** Floor item detection — runs after Q&A answers are collected; receives clarification context so already-answered transactions are not re-flagged
- The existing `callAnthropicAPI` for bucket analysis is removed or superseded by the combined Call 1

### Q&A card presentation
- All uncertain transactions shown at once as a scrollable list of cards
- Consistent with the existing 4-bucket suggestion card pattern in `CsvAiSection`
- Each card shows: transaction description, date, amount, a context text input, and a bucket selector
- No wizard / one-at-a-time navigation needed

### Pre-classified merchant feedback
- When a merchant is already in `merchantStore` and skipped from Q&A, show a summary line:
  `"N merchants auto-classified from memory"` above the Q&A cards
- Transparent without being verbose — aligns with the app's transparency-first value
- No override affordance needed in this phase (editing merchant memory is out of scope)

### Floor item pre-fill UX
- When user accepts a floor item suggestion, scroll to `FloorItemsSection` and open the Add form with name, amount, and destination account pre-filled
- Reuses existing `FloorItemsSection` Add form; no duplicate inline form in `CsvAiSection`
- Mechanism: `SettingsPage` passes a `onFloorItemSuggested` callback that sets a pending floor item in a lifted-state slot; `FloorItemsSection` reads it, opens the form pre-filled, and clears the pending slot after save
- A brief visual highlight (e.g. ring or scroll-to) draws attention to the opened form

### Q&A → floor detection sequencing
- Q&A cards appear first; user answers them all (or skips)
- "Done with Q&A" triggers Call 2 (floor detection), passing answered-merchant names as context
- Floor item suggestions appear below the Q&A section once detected

### Claude's Discretion
- Exact prompt wording for the combined Call 1 and Call 2
- Loading/spinner states during each API call
- Error handling UX (retry button, error message placement)
- Number of uncertain transactions that triggers a "too many to classify" warning (if any)
- Exact scroll behavior and highlight animation for floor item pre-fill

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/anthropicClient.ts`: `callAnthropicAPI()`, `AnthropicAPIError`, `ANALYSIS_SCHEMA` — extend with `callUncertainTransactionDetection()` and `callFloorItemDetection()`; both use the same fetch pattern and structured JSON output
- `src/stores/merchantStore.ts`: `upsertMerchant()`, `lookupMerchant()`, `MerchantEntry` (`merchantName`, `bucketAccountId`, `context?`) — ready to use; no schema changes needed for Phase 13
- `src/features/settings/CsvAiSection.tsx`: existing file upload, transaction parsing, API call, and suggestion card state machine — Phase 13 extends this component's state machine with Q&A and floor detection phases
- `src/features/settings/FloorItemsSection.tsx`: has `setShowAddForm`, `newItem` state, `FloorItemDraft` type — pre-fill requires lifting state or a callback from `SettingsPage`

### Established Patterns
- Structured JSON output via `output_config.format.type: 'json_schema'` — use same pattern for both new API calls
- `AnthropicAPIError` + generic Error catch pattern — reuse in new functions
- Suggestion card accept/skip toggle — existing pattern in `CsvAiSection` for bucket cards; Q&A cards follow the same visual pattern
- `parseCents` for all money math — floor item amount from AI is EUR string → parse via `parseCents`

### Integration Points
- `SettingsPage.tsx` hosts both `CsvAiSection` and `FloorItemsSection` — floor item pre-fill callback is lifted here
- `bootstrap.ts` already wires `merchantStore.loadMerchants()` — no additional bootstrap wiring needed
- `CsvAiSection` reads `useSettingsStore` and `useAccountStore` — bucket selectors in Q&A cards can use the same account list

</code_context>

<specifics>
## Specific Ideas

- The "merchant memory summary" line (`"N merchants auto-classified from memory"`) should appear before the Q&A cards, not after — so users understand why fewer questions appear than total transactions
- Floor item detection should receive the Q&A answers as context so the AI knows "Lidl → everyday essentials" and doesn't re-flag it as a potential recurring fixed expense
- The combined Call 1 prompt should separate the two concerns clearly in the response schema: `{ uncertainTransactions: [...], bucketSuggestions: {...} }` — keeps the existing bucket suggestion cards working alongside the new Q&A cards

</specifics>

<deferred>
## Deferred Ideas

- Editing or deleting merchant memory entries — separate settings sub-section, future phase
- Override of auto-classified merchants during import — would add complexity; note for future
- Multi-CSV session caching (avoiding re-classification on same file re-upload) — future optimization

</deferred>

---

*Phase: 13-ai-layer*
*Context gathered: 2026-03-01*
