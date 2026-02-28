# Money Flow

## What This Is

A personal finance allocation tool for freelancers with irregular income. When a client payment arrives, the app tells you exactly how much to move where — amounts, destinations, reasons. No decisions required, just clear instructions.

Designed for anyone who doesn't receive a fixed monthly salary but instead gets paid invoices at unpredictable times. The app simulates the structure of a monthly salary by maintaining configurable budget buckets and a replenishment system.

## Core Value

When an invoice lands, tell the user exactly where every euro goes — so they never have to think about it in the moment.

## Requirements

### Validated

- ✓ User can enter an invoice (amount + currency + EUR equivalent) and receive precise move instructions per account/bucket — Phase 3 (verified Phase 8)
- ✓ App auto-detects Stabilize vs Distribute mode based on floor coverage and buffer balance — Phase 3 (verified Phase 8)
- ✓ User can view all account balances on one dashboard — Phase 3 (verified Phase 8)
- ✓ User can edit account balances inline (manual update) — Phase 3 (verified Phase 8)
- ✓ Visual indicator shows accounts at/near/below target — Phase 3 (verified Phase 8)
- ✓ "Done" button confirms a set of moves, updates balances atomically, logs to history — Phase 3 (verified Phase 8)
- ✓ User can configure budget buckets (name, amount/percentage, destination account, priority) — Phase 4 (verified Phase 9)
- ✓ Default allocation: 35% taxes, remainder split across configurable everyday/fun/savings/investing buckets — Phase 4 (verified Phase 9)
- ✓ Floor items support optional expiry dates (auto-deactivate) — Phase 4 (verified Phase 9)
- ✓ User can edit floor items, overflow ratios, account targets, and Wise buffer target — Phase 4 (verified Phase 9)
- ✓ Stabilize mode: ordered instructions to cover uncovered floor items in priority order — Phase 2, floor coverage bug fixed Phase 10
- ✓ Distribute mode: surplus split instructions by user-defined ratios — Phase 2
- ✓ History log of all past allocations (date, invoice, mode, all moves made) — Phase 5
- ✓ User can upload CSV expense history (6+ months) for AI-powered spending analysis — Phase 6
- ✓ AI analysis suggests bucket splits based on actual spending patterns — Phase 6
- ✓ Every allocation decision is transparent: calculation, rule, and reason per move — Phase 2–3
- ✓ AI suggestions shown with reasoning behind them — Phase 6
- ✓ App runs locally in the browser (no server required) — Phase 1
- ✓ Open source — publishable on GitHub, easy to run with `npm start` — Phase 1

### Active

<!-- v1.1 scope — building toward these -->

- [ ] AI asks about uncertain CSV transactions; user provides context + bucket assignment
- [ ] Transaction labels persist across imports (merchant → bucket memory)
- [ ] AI detects recurring expenses from CSV and suggests them as floor items
- [ ] Suggested floor item pre-fills the floor item form on confirm
- [ ] Invoice entry has a "from" field (client name) — optional
- [ ] Client name shown in history log
- [ ] History is searchable/filterable by date range, client, and amount
- [ ] Dark mode toggle persisted across sessions

### Out of Scope

- Bank API sync — manual balance updates only
- Auto exchange rates — user provides EUR equivalent manually
- Spending categories app-side (beyond what AI infers from CSV import)
- Forecasting / charts
- Multi-user
- Mobile app
- Undo/redo
- Dark mode

## Current Milestone: v1.1 AI-Powered Insights

**Goal:** Enrich the CSV import flow with interactive AI analysis and extend the app with quality-of-life improvements.

**Target features:**
- AI transaction Q&A: AI asks about uncertain expenses, user provides context + bucket, answers persist for future imports
- AI floor item detection: AI spots recurring expenses from CSV and suggests them as pre-filled floor items
- Invoice source tracking: "from" field on invoice entry, shown in history log
- History search/filter: filter allocation history by date range, client, or amount
- Dark mode

## Current State (v1.0)

v1.0 shipped 2026-02-28. All 19 requirements implemented and formally verified.

**Build:** `npm run build` — 1878 modules, 0 TypeScript errors
**Tests:** 116 passing (Vitest)
**Run:** `npm start` → https://ai-bot-server.tail18768e.ts.net:5173 (HTTPS required for FSA)
**Source:** ~5,080 LOC TypeScript/TSX

**What's working:**
- Full invoice-to-allocation flow with transparency (Stabilize + Distribute modes)
- Account dashboard with inline balance editing and status indicators
- Settings: accounts, floor items (with expiry), overflow ratios, Wise buffer, tax %
- History log of all past allocations
- CSV upload + Anthropic AI bucket-split suggestions
- File System Access API persistence with IndexedDB fallback
- First-run onboarding + FSA permission lifecycle

## Context

**Key design decisions:**
- Integer cents throughout (no floating point money bugs) — `parseCents`/`formatCents`/`splitCents`
- File System Access API + IndexedDB for persistence (survives browser clears, human-readable JSON)
- No backend — fully client-side; Anthropic API called directly from browser (`anthropic-dangerous-direct-browser-access: true`)
- Two modes (Stabilize / Distribute) auto-detected from state — never a manual toggle

**Account model:**
- Income landing account (e.g. Wise) — distribution hub with buffer target
- Everyday/fun/savings/investing — configurable overflow destinations
- Tax reserve — floor item receiving % of each invoice

## Constraints

- **Platform**: Browser localhost (`npm start`) — no desktop wrapper, no server
- **Money math**: Integer cents throughout (parseCents for all arithmetic)
- **Distribution**: Open source GitHub repo — no proprietary dependencies
- **No AI backend**: AI CSV analysis uses client-side model API key or is done via a simple local call
- **Currency**: EUR-primary, accepts any currency with user-provided EUR equivalent

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| File System Access API for persistence | Survives browser clears, human-readable JSON, no server needed | Implemented Phase 1, hardened Phase 7 |
| Integer cents for all money math | Eliminates floating point errors (0.1 + 0.2 === 0.3) | Implemented Phase 1, used throughout |
| Two modes auto-detected (not user toggle) | Removes decision fatigue, always correct behavior | Implemented Phase 2, UI Phase 3 |
| No backend / fully client-side | Open source, easy to run locally, privacy-preserving | Confirmed working Phase 6 (Anthropic direct browser API) |
| Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui | Industry standard stack, fast DX, good component library | Implemented Phase 1 |
| ALLOC-02 floor coverage defect deferred | `handleDone()` marks `destinationAccountId` instead of `floorItemId` — does not affect atomicity or allocation correctness | Fixed Phase 10 — `floorItemId?: string` added to `AllocationMove`, stabilize() populates it, handleDone() uses it |
| INFRA-04 first-run detection | `isFirstRun = needsFsaPrompt && accounts.length === 0` caused returning Chrome users with no accounts to see onboarding incorrectly | Fixed Phase 10 — `isFirstRun = needsFsaPrompt` only (removed accounts.length coupling) |

---
*Last updated: 2026-02-28 after Phase 10 (fix-integration-defects) — v1.0 milestone complete*
