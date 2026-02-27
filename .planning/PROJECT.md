# Money Flow

## What This Is

A personal finance allocation tool for freelancers with irregular income. When a client payment arrives, the app tells you exactly how much to move where — amounts, destinations, reasons. No decisions required, just clear instructions.

Designed for anyone who doesn't receive a fixed monthly salary but instead gets paid invoices at unpredictable times. The app simulates the structure of a monthly salary by maintaining configurable budget buckets and a replenishment system.

## Core Value

When an invoice lands, tell the user exactly where every euro goes — so they never have to think about it in the moment.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can enter an invoice (amount + currency + EUR equivalent) and receive precise move instructions per account/bucket
- [ ] App auto-detects Stabilize vs Distribute mode based on floor coverage and buffer balance
- [ ] Stabilize mode: ordered instructions to cover uncovered floor items in priority order
- [ ] Distribute mode: surplus split instructions by user-defined ratios
- [ ] User can configure budget buckets (name, amount/percentage, destination account, priority)
- [ ] Default allocation: 35% taxes, remainder split across configurable everyday/fun/savings/investing buckets
- [ ] User can upload CSV expense history (6+ months) for AI-powered spending analysis
- [ ] AI analysis suggests bucket splits based on actual spending patterns (everyday vs fun vs one-off/travel)
- [ ] User can view all account balances on one dashboard
- [ ] User can edit account balances inline (manual update)
- [ ] Visual indicator shows accounts at/near/below target
- [ ] "Done" button confirms a set of moves, updates balances atomically, logs to history
- [ ] History log of all past allocations (date, invoice, mode, all moves made)
- [ ] "New Month" reset: clears floor coverage toggles, preserves balances and history
- [ ] Floor items support optional expiry dates (auto-deactivate)
- [ ] User can edit floor items, overflow ratios, account targets, and Wise buffer target
- [ ] Every allocation decision is transparent: each move shows the exact calculation, rule applied, and reason (e.g. "37% of €2,000 invoice = €740 → Isybank (tax rule)")
- [ ] AI suggestions (from CSV analysis) are always shown with the reasoning behind them, not just a number — user can see what pattern was detected and why the split was suggested
- [ ] App runs locally in the browser (no server required)
- [ ] Open source — publishable on GitHub, easy to run with `npm start`

### Out of Scope

- Bank API sync — manual balance updates only
- Auto exchange rates — user provides EUR equivalent manually
- Spending categories app-side (beyond what AI infers from CSV import)
- Forecasting / charts
- Multi-user
- Mobile app
- Undo/redo
- Dark mode

## Context

Previous implementation attempt (Phase 1 complete) established the core data model and persistence approach. Starting fresh with cleaner architecture but preserving all design decisions from that work.

**Key design decisions already made:**
- Integer cents throughout (no floating point money bugs)
- File System Access API + IndexedDB for persistence (survives browser clears, human-readable JSON)
- No backend — fully client-side
- Two modes (Stabilize / Distribute) auto-detected, never a manual toggle

**Example account setup (from original spec, now user-configurable):**
- Income landing account (e.g. Wise) — acts as distribution hub, has buffer target
- Everyday spending account (e.g. N26) — loaded to fixed monthly amount
- Fun/discretionary (e.g. Revolut card) — overflow destination
- Medium-term savings (e.g. Revolut vault) — overflow destination
- Tax reserve (e.g. Isybank) — money in, not out until tax time
- Long-term investing (e.g. IBKR) — overflow destination

**Floor logic:**
- Tax: calculated as % of each invoice (default 37%, configurable)
- Fixed monthly commitments: rent, therapy, subscriptions, everyday spending
- Floor total = sum of active (non-expired) items
- Floor funded first; only surplus goes to overflow split

**AI CSV analysis:**
- User uploads CSV exports from bank(s)
- AI categorizes transactions into: everyday essentials, fun/discretionary, one-off/travel, recurring fixed
- Suggests bucket amounts based on 6-month average
- User can accept, adjust, or ignore suggestions

## Constraints

- **Platform**: Browser localhost (`npm start`) — no desktop wrapper, no server
- **Money math**: Integer cents throughout (parseCents for all arithmetic)
- **Distribution**: Open source GitHub repo — no proprietary dependencies
- **No AI backend**: AI CSV analysis uses client-side model API key or is done via a simple local call
- **Currency**: EUR-primary, accepts any currency with user-provided EUR equivalent

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| File System Access API for persistence | Survives browser clears, human-readable JSON, no server needed | — Pending |
| Integer cents for all money math | Eliminates floating point errors (0.1 + 0.2 === 0.3) | — Pending |
| Two modes auto-detected (not user toggle) | Removes decision fatigue, always correct behavior | — Pending |
| No backend / fully client-side | Open source, easy to run locally, privacy-preserving | — Pending |
| Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui | Industry standard stack, fast DX, good component library | — Pending |

---
*Last updated: 2026-02-27 after initialization*
