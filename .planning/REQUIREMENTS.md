# Requirements: Money Flow

**Defined:** 2026-02-28
**Core Value:** When an invoice lands, tell the user exactly where every euro goes — so they never have to think about it in the moment.

---

## v1 Requirements

### Infrastructure & Persistence (INFRA)

- [ ] **INFRA-01**: App scaffolds with Vite 7 + React 19 + TypeScript, runs via `npm start` on localhost with no server
- [ ] **INFRA-02**: App is open-source publishable (no proprietary dependencies, clean GitHub repo)
- [ ] **INFRA-03**: File System Access API integration — user grants directory access once per session; handle stored in IndexedDB for re-use
- [ ] **INFRA-04**: FSA permission lifecycle handled correctly — `queryPermission()` on startup, `requestPermission()` inside user gesture, graceful `NotAllowedError` recovery
- [ ] **INFRA-05**: IndexedDB fallback when FSA unavailable (Firefox/Safari) — all features work, no file persistence
- [ ] **INFRA-06**: All money arithmetic uses integer cents throughout (`parseCents`, `formatCents`, `splitCents` with largest-remainder) — no floating point in domain logic
- [ ] **INFRA-07**: Data persisted as human-readable JSON files in user-selected directory via FSA

### Allocation Engine (ALLOC)

- [x] **ALLOC-01**: App auto-detects Stabilize vs Distribute mode — no manual toggle; detection based on floor coverage state and buffer balance
- [x] **ALLOC-02**: Stabilize mode: generates ordered move instructions to cover uncovered floor items in priority order until all floor items funded or invoice exhausted
- [x] **ALLOC-03**: Distribute mode: generates surplus split instructions by user-defined overflow ratios across configured accounts
- [x] **ALLOC-04**: Tax allocation: fixed percentage of invoice total (default 37%, user-configurable) goes to tax account first, before any floor or distribute logic
- [x] **ALLOC-05**: Every generated move shows exact calculation, rule applied, and reason (e.g. "37% of €2,000 = €740 → Isybank (tax rule)")
- [x] **ALLOC-06**: Allocation engine is pure TypeScript with zero React imports — fully unit-testable without a browser

### Invoice Entry & Allocation Flow (INVOICE)

- [ ] **INVOICE-01**: User can enter invoice: amount, currency, and EUR equivalent (manual entry — no auto exchange rate)
- [ ] **INVOICE-02**: After invoice entry, app displays a complete set of move instructions (amounts, destination accounts, reasons) in one view
- [ ] **INVOICE-03**: "Done" button confirms all moves atomically — updates all account balances in a single operation and logs the allocation to history
- [ ] **INVOICE-04**: No partial confirmation — all moves in an allocation are confirmed together or not at all

### Dashboard & Accounts (DASH)

- [ ] **DASH-01**: User can view all account balances on one dashboard screen
- [ ] **DASH-02**: User can edit any account balance inline (manual update, not bank sync)
- [ ] **DASH-03**: Visual indicator shows each account's status: at target / near target / below target
- [ ] **DASH-04**: Dashboard shows current mode (Stabilize / Distribute) with brief explanation of why

### Configuration (CONFIG)

- [ ] **CONFIG-01**: User can configure accounts (name, target balance, role: income-hub / spending / savings / tax / investing)
- [ ] **CONFIG-02**: User can configure floor items (name, amount in cents, priority order, destination account)
- [ ] **CONFIG-03**: Floor items support optional expiry dates — auto-deactivate when expired
- [ ] **CONFIG-04**: User can configure overflow ratios (percentage split for Distribute mode across non-floor accounts)
- [ ] **CONFIG-05**: User can configure Wise buffer target (minimum balance to keep in income-hub account)
- [ ] **CONFIG-06**: User can configure tax percentage (default 37%)
- [ ] **CONFIG-07**: Default configuration provided on first run: tax bucket + everyday/fun/savings/investing split — user can accept defaults or edit before first invoice

### History & Monthly Reset (HIST)

- [ ] **HIST-01**: History log records every confirmed allocation: date, invoice details (amount, currency, EUR equivalent), mode used, and every move made
- [ ] **HIST-02**: User can view history list (most recent first) and expand any entry to see full move details
- [ ] **HIST-03**: "New Month" reset clears floor coverage toggles (marks all floor items as uncovered) while preserving account balances, history, and configuration

### CSV Import & AI Analysis (CSV)

- [ ] **CSV-01**: User can upload one or more CSV exports from their bank(s) (6+ months of transaction history)
- [ ] **CSV-02**: App parses CSV with support for multiple bank formats (Wise, N26, Revolut) including UTF-8 BOM and European decimal separators
- [ ] **CSV-03**: User sees a preview of parsed transactions before confirming import
- [ ] **CSV-04**: AI (Anthropic API, user-provided key stored in localStorage) categorizes transactions into: everyday essentials, fun/discretionary, one-off/travel, recurring fixed
- [ ] **CSV-05**: AI generates suggested bucket amounts based on 6-month spending averages
- [ ] **CSV-06**: Every AI suggestion shows the reasoning — which pattern was detected and why the split was suggested (not just a number)
- [ ] **CSV-07**: User can accept, adjust, or ignore each suggestion individually
- [ ] **CSV-08**: API key entered by user at runtime in settings — never bundled, never hardcoded

---

## v2 Requirements

### Notifications
- **NOTF-01**: In-app toast when another tab updates data (multi-tab detection via BroadcastChannel)
- **NOTF-02**: Warning indicator when FSA permission lost mid-session

### Export
- **EXPORT-01**: Export allocation history as CSV
- **EXPORT-02**: Export full data backup as JSON (separate from FSA working directory)

### Advanced Configuration
- **ADV-01**: Multiple income-hub accounts (e.g. two Wise accounts)
- **ADV-02**: Per-invoice override of tax percentage
- **ADV-03**: Floor item one-time vs recurring flag

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bank API sync | Privacy, API fragility, regulatory complexity — manual balance updates only |
| Auto exchange rates | User provides EUR equivalent manually — keeps complexity low |
| Spending categories (app-side) | Beyond what AI infers from CSV; would require ongoing transaction import |
| Forecasting / charts | Not core to the allocation workflow |
| Multi-user | Single user, local-first |
| Mobile app | Web-first; FSA API has no mobile equivalent |
| Undo/redo | History log is append-only; reversal is a new allocation entry |
| Dark mode | v1 scope; Tailwind v4 makes it easy to add later |
| Desktop wrapper (Electron/Tauri) | Browser localhost is sufficient |
| Real-time multi-tab sync | BroadcastChannel warning is sufficient for v1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| INFRA-07 | Phase 1 | Pending |
| ALLOC-01 | Phase 2 | Complete |
| ALLOC-02 | Phase 2 | Complete |
| ALLOC-03 | Phase 2 | Complete |
| ALLOC-04 | Phase 2 | Complete |
| ALLOC-05 | Phase 2 | Complete |
| ALLOC-06 | Phase 2 | Complete |
| INVOICE-01 | Phase 3 | Pending |
| INVOICE-02 | Phase 3 | Pending |
| INVOICE-03 | Phase 3 | Pending |
| INVOICE-04 | Phase 3 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| CONFIG-01 | Phase 4 | Pending |
| CONFIG-02 | Phase 4 | Pending |
| CONFIG-03 | Phase 4 | Pending |
| CONFIG-04 | Phase 4 | Pending |
| CONFIG-05 | Phase 4 | Pending |
| CONFIG-06 | Phase 4 | Pending |
| CONFIG-07 | Phase 4 | Pending |
| HIST-01 | Phase 5 | Pending |
| HIST-02 | Phase 5 | Pending |
| HIST-03 | Phase 5 | Pending |
| CSV-01 | Phase 6 | Pending |
| CSV-02 | Phase 6 | Pending |
| CSV-03 | Phase 6 | Pending |
| CSV-04 | Phase 6 | Pending |
| CSV-05 | Phase 6 | Pending |
| CSV-06 | Phase 6 | Pending |
| CSV-07 | Phase 6 | Pending |
| CSV-08 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38 (Phases 1-6; Phase 7 is hardening of INFRA-04/INFRA-05 to production quality)
- Unmapped: 0 ✓

---

*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after roadmap creation (7 phases confirmed)*
