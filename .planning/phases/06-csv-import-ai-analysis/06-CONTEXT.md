# Phase 6: CSV Import & AI Analysis - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow users to upload bank CSV exports (Wise, N26, Revolut), preview parsed transactions, and receive AI-generated bucket size suggestions with full reasoning. Accepted suggestions update overflow ratios in configuration. The Anthropic API key is entered by the user at runtime in settings and stored in localStorage only. No bank syncing, no transaction storage, no ongoing categorisation — this is a one-time analysis tool to help calibrate bucket percentages.

</domain>

<decisions>
## Implementation Decisions

### Entry point and navigation
- CSV & AI analysis lives as a new sub-section in **Settings**, tab label "CSV & AI"
- `SettingsSection` type gains a new `'csv-ai'` variant; new tab added to the SECTIONS array in `SettingsPage.tsx`
- API key input is part of the same `CsvAiSection` component — top of the section, above upload
- Rationale: this is a configuration tool (it updates overflow ratios), not a daily workflow; co-locating it with the settings it modifies is cleaner than a 5th top-level tab

### API key storage
- Key stored in `localStorage` under key `"anthropic_api_key"` — never in settingsStore, never persisted to FSA/IDB
- Settings section shows a labelled password input; Save button writes to localStorage
- If key is already set on load, show the input pre-filled with `"••••••••"` placeholder (don't expose the key back)
- Clear button removes the key from localStorage

### CSV upload
- `<input type="file" multiple accept=".csv">` — standard file input, no drag-and-drop required
- Multiple files accepted (user may have Wise + N26, etc.)
- After selection, parse immediately in the browser (no upload to server)
- Supported formats: Wise, N26, Revolut — detected by CSV header pattern
- UTF-8 BOM stripped before parsing; European decimal separators (comma) handled
- Only expenses parsed (negative amounts / debit rows); income rows skipped

### Transaction preview
- After parsing, show a summary header: "N transactions from [earliest date] to [latest date] across X file(s)"
- Scrollable table below: Date | Description | Amount (EUR) — sorted newest first
- No row-level exclusion — if categories look wrong, user can just skip suggestions
- A distinct "Analyse with AI" button below the table; disabled with tooltip "Enter an API key above first" if no key is set
- If no key: user can still use the preview to manually eyeball their spending patterns

### AI analysis and suggestion display
- Clicking "Analyse with AI" calls the Anthropic API (claude-haiku-4-5-20251001 for cost efficiency) with the parsed transaction list
- While waiting: spinner + "Analysing your transactions…" message
- Results displayed as a list of 4 suggestion cards (one per bucket: everyday essentials, fun/discretionary, one-off/travel, recurring fixed):
  - Card header: bucket name + current overflow ratio %
  - Body: detected spending average (e.g. "Average: €847/month over 6 months"), reasoning paragraph, suggested monthly amount as an editable input pre-filled with the AI's suggestion
  - Per-card: "Accept" | "Skip" toggle buttons (Accept = green, Skip = default/muted)
- "Apply accepted changes" button at the bottom (disabled until ≥1 bucket is accepted)
- Applying: recalculates overflow ratios from accepted amounts (accepted amount / sum of all accepted amounts × 100), updates `settingsStore.updateSettings({ overflowRatios: [...] })`, and writes to persistence

### Ratio recalculation on apply
- Only accepted buckets get new ratios; skipped buckets keep their current percentages
- If accepted + skipped don't sum to 100%: show inline warning "Ratios don't sum to 100% — adjust or accept more buckets"
- User must resolve before Apply is enabled (ratios must sum to exactly 100%)
- Edge case: tax bucket is excluded from overflow ratios (it's configured separately via `taxPct`) — AI suggestions only touch `overflowRatios` accounts

### Claude's Discretion
- Exact CSV column name matching per bank format (Wise/N26/Revolut header detection logic)
- Prompt engineering for the AI analysis — category descriptions, output format (JSON structured response)
- Error handling for API failures (network error, invalid key, rate limit) — show inline error message, allow retry
- Whether to use streaming for the AI response or wait for complete response (recommend complete response — simpler for structured JSON output)

</decisions>

<specifics>
## Specific Ideas

- User gave full discretion ("I trust you, make the best plan") — all decisions above are Claude's choices
- The AI model should be cheap (Haiku) since it's processing potentially hundreds of transactions at user's own API cost
- Transparency is a core app value — the reasoning per bucket must be visible by default, not collapsed
- The existing `overflowRatios` array in `Settings` is the write target — no new domain types needed
- API key lives in localStorage (not the FSA/IDB persistence layer) — intentional, matches the spec

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SettingsPage.tsx`: sub-tab nav pattern — add `'csv-ai'` to `SettingsSection` union and `SECTIONS` array, render new `<CsvAiSection />`
- `Card`, `CardContent` from `@/components/ui/card`: suggestion cards
- `Button` from `@/components/ui/button`: upload trigger, Accept/Skip toggles, Apply button
- `Input` from `@/components/ui/input`: API key input, editable amount fields
- `formatCents` / `parseCents` from `@/lib/cents`: money display and amount parsing in suggestion cards
- `settingsStore.updateSettings()`: write target for accepted overflow ratio changes

### Established Patterns
- `Settings.overflowRatios: OverflowRatio[]` (each has `accountId` + `pct`) — this is what AI suggestions update
- Settings sub-section pattern: new file `src/features/settings/CsvAiSection.tsx`, imported in `SettingsPage.tsx`
- localStorage access is direct (`window.localStorage.getItem/setItem/removeItem`) — not through any store
- All money is integer cents — AI suggested amounts will be in euros from user's CSV, need conversion via `parseCents` or manual `Math.round(eurAmount * 100)`

### Integration Points
- `SettingsPage.tsx`: add `'csv-ai'` section (minimal change — one new tab + one new component render)
- `settingsStore`: `updateSettings({ overflowRatios: newRatios })` called on Apply
- No changes to `allocationStore`, `accountStore`, `App.tsx`, or any other existing files
- Anthropic API called directly from browser via `fetch` — no proxy, no backend (local-first app)

</code_context>

<deferred>
## Deferred Ideas

- Filtering/excluding individual transactions before AI analysis — Phase 6 scope is preview only; exclusion is future
- Storing imported transactions for future reference — out of scope, local-first app doesn't retain raw bank data
- Support for additional bank formats beyond Wise/N26/Revolut — can add later without architecture changes
- Streaming AI response — simpler to await complete JSON; streaming is a polish item
- Suggesting floor item amounts (not just overflow ratios) — would require more complex AI output; deferred to v2

</deferred>

---

*Phase: 06-csv-import-ai-analysis*
*Context gathered: 2026-02-28*
