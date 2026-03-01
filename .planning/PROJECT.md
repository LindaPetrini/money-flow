# Money Flow

## What This Is

A personal finance allocation tool for freelancers with irregular income. When a client payment arrives, the app tells you exactly how much to move where — amounts, destinations, reasons. No decisions required, just clear instructions.

After uploading a CSV of recent bank transactions, the AI identifies uncertain expenses for user review, remembers merchant→bucket answers for future imports, and detects recurring expenses to suggest as pre-filled floor items.

Designed for anyone who doesn't receive a fixed monthly salary but instead gets paid invoices at unpredictable times. The app simulates the structure of a monthly salary by maintaining configurable budget buckets and a replenishment system.

## Core Value

When an invoice lands, tell the user exactly where every euro goes — so they never have to think about it in the moment.

## Requirements

### Validated

- ✓ User can enter an invoice (amount + currency + EUR equivalent) and receive precise move instructions per account/bucket — v1.0 Phase 3 (verified Phase 8)
- ✓ App auto-detects Stabilize vs Distribute mode based on floor coverage and buffer balance — v1.0 Phase 3 (verified Phase 8)
- ✓ User can view all account balances on one dashboard — v1.0 Phase 3 (verified Phase 8)
- ✓ User can edit account balances inline (manual update) — v1.0 Phase 3 (verified Phase 8)
- ✓ Visual indicator shows accounts at/near/below target — v1.0 Phase 3 (verified Phase 8)
- ✓ "Done" button confirms a set of moves, updates balances atomically, logs to history — v1.0 Phase 3 (verified Phase 8)
- ✓ User can configure budget buckets (name, amount/percentage, destination account, priority) — v1.0 Phase 4 (verified Phase 9)
- ✓ Default allocation: 35% taxes, remainder split across configurable everyday/fun/savings/investing buckets — v1.0 Phase 4 (verified Phase 9)
- ✓ Floor items support optional expiry dates (auto-deactivate) — v1.0 Phase 4 (verified Phase 9)
- ✓ User can edit floor items, overflow ratios, account targets, and Wise buffer target — v1.0 Phase 4 (verified Phase 9)
- ✓ Stabilize mode: ordered instructions to cover uncovered floor items in priority order — v1.0 Phase 2, floor coverage bug fixed Phase 10
- ✓ Distribute mode: surplus split instructions by user-defined ratios — v1.0 Phase 2
- ✓ History log of all past allocations (date, invoice, mode, all moves made) — v1.0 Phase 5
- ✓ User can upload CSV expense history (6+ months) for AI-powered spending analysis — v1.0 Phase 6
- ✓ AI analysis suggests bucket splits based on actual spending patterns — v1.0 Phase 6
- ✓ Every allocation decision is transparent: calculation, rule, and reason per move — v1.0 Phase 2–3
- ✓ AI suggestions shown with reasoning behind them — v1.0 Phase 6
- ✓ App runs locally in the browser (no server required) — v1.0 Phase 1
- ✓ Open source — publishable on GitHub, easy to run with `npm start` — v1.0 Phase 1
- ✓ Dark mode toggle (system/light/dark) persisted across sessions, FOUC-free — v1.1 Phase 12
- ✓ Invoice entry has optional "from" field (client name); client name shown in history log — v1.1 Phase 12
- ✓ History is searchable/filterable by date range, client, and amount — v1.1 Phase 12
- ✓ AI asks about uncertain CSV transactions; user provides context + bucket assignment — v1.1 Phase 13
- ✓ Transaction labels persist across imports (merchant → bucket memory) — v1.1 Phase 13
- ✓ Known merchants are pre-classified automatically on future imports (Q&A skipped) — v1.1 Phase 13
- ✓ AI detects recurring expenses from CSV and suggests them as floor items — v1.1 Phase 13
- ✓ Confirming a floor item suggestion pre-fills the floor item form — v1.1 Phase 13

### Active

<!-- v1.2 scope — ideas for next milestone -->

- [ ] User can view and manage saved merchant→bucket mappings (AIAN-EXT-01)
- [ ] History can be exported to CSV (AIAN-EXT-02)
- [ ] User can optionally exclude a bucket when processing an invoice (INVOICE-EXT-01)

### Out of Scope

- Bank API sync — manual balance updates only
- Auto exchange rates — user provides EUR equivalent manually
- Spending categories app-side (beyond what AI infers from CSV import)
- Forecasting / charts
- Multi-user
- Mobile app
- Undo/redo
- Silent auto-categorization (breaks transparency — core value)

## Current State (v1.1)

v1.1 shipped 2026-03-01. All 27 requirements (19 from v1.0 + 8 from v1.1) implemented and verified.

**Build:** `npm run build` — 0 TypeScript errors
**Tests:** 135 passing (Vitest)
**Run:** `npm start` → https://ai-bot-server.tail18768e.ts.net:5173 (HTTPS required for FSA)
**Source:** ~6,357 LOC TypeScript/TSX

**What's working:**
- Full invoice-to-allocation flow with transparency (Stabilize + Distribute modes)
- Account dashboard with inline balance editing and status indicators
- Settings: accounts, floor items (with expiry), overflow ratios, Wise buffer, tax %
- History log with 5-filter search (date range, client, amount)
- CSV upload → 2-call AI session: combined analysis (bucket suggestions + uncertain transactions) → Q&A → floor detection
- Merchant memory: answered merchants auto-classified on future imports
- Floor item suggestion pre-fill: Accept suggestion → SettingsPage switches to floor items tab → Add form pre-filled
- FOUC-free dark mode (system/light/dark) with localStorage mirror
- File System Access API persistence with IndexedDB fallback
- First-run onboarding + FSA permission lifecycle

## Context

**Key design decisions:**
- Integer cents throughout (no floating point money bugs) — `parseCents`/`formatCents`/`splitCents`
- File System Access API + IndexedDB for persistence (survives browser clears, human-readable JSON)
- No backend — fully client-side; Anthropic API called directly from browser (`anthropic-dangerous-direct-browser-access: true`)
- Two modes (Stabilize / Distribute) auto-detected from state — never a manual toggle
- 2-call AI session design: at most 2 Anthropic calls per CSV import regardless of file size

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
| ALLOC-02 floor coverage defect deferred | `handleDone()` marks `destinationAccountId` instead of `floorItemId` | Fixed Phase 10 — `floorItemId?: string` added to `AllocationMove` |
| INFRA-04 first-run detection | `isFirstRun = needsFsaPrompt && accounts.length === 0` caused returning Chrome users with no accounts to see onboarding incorrectly | Fixed Phase 10 — `isFirstRun = needsFsaPrompt` only |
| 2-call AI session design | At most 2 Anthropic calls per CSV import (combined + floor detection) | v1.1 Phase 13 — UX is predictable and cost-bounded |
| Merchant pre-classification before API call | Synchronous lookup, excludes known merchants from payload | v1.1 Phase 13 — reduces tokens, speeds up Q&A |
| `pendingFloorItem` lifted to SettingsPage | Cross-section pre-fill requires parent to coordinate tab switch + scroll + form state | v1.1 Phase 13 — clean prop-down flow |

---
*Last updated: 2026-03-01 after v1.1 milestone (AI-Powered Insights)*
