# Milestones

## v1.1 AI-Powered Insights (Shipped: 2026-03-01)

**Phases completed:** 3 phases (11–13), 8 plans | **Git range:** 4dca76c → 67727c5
**Stats:** 43 files changed, 6,593 insertions | ~6,357 LOC TypeScript | 135 tests passing

**Key accomplishments:**
- Schema Foundation: extended domain types (`AllocationRecord.source`, `Settings.theme`, `MerchantEntry`) with backward-compatible read-time migrations; `merchantStore` wired into app startup
- Dark mode: FOUC-free three-state theme toggle (system/light/dark) using inline `<head>` script + localStorage mirror; Tailwind v4 dark variant selector fixed
- Invoice "From" field: optional client/project name threaded from InvoiceForm → AllocationRecord → history display
- History filters: 5-filter UI (date range, source text search, amount min/max) with useMemo AND-composed predicates and Clear Filters button
- AI combined analysis: single Anthropic call returning bucket suggestions + uncertain transactions; strict JSON schemas with `additionalProperties: false`; `callAnthropicAPI` deprecated
- Q&A + merchant memory: uncertain transaction cards with context input and bucket selector; answered merchants persisted to `merchantStore` for future auto-classification (skips Q&A on next import)
- Floor detection + pre-fill: post-Q&A `callFloorDetection()` shows recurring expense suggestion cards; Accept → pre-fills FloorItemsSection Add form with 2-second highlight ring via lifted state in SettingsPage

---

## v1.0 MVP (Shipped: 2026-02-28)

**Phases completed:** 10 phases, 26 plans, 0 tasks

**Key accomplishments:**
- Local-first freelance budget allocator built end-to-end — 5,080 LOC TypeScript, 116 tests, zero backend
- Stabilize/Distribute allocation engine with full transparency — every move shows exact calculation, rule, and reason
- Invoice workflow: enter invoice → get move instructions → confirm atomically with balance and history updates
- Dashboard with per-account balance editing, status indicators, and auto-detected mode badge
- Full configuration (accounts, floor items with expiry, overflow ratios, Wise buffer, tax %) persisted via File System Access API + IndexedDB fallback
- CSV upload + Anthropic AI analysis for bucket-split suggestions with transparent reasoning
- Storage hardening: FSA permission lifecycle, first-run onboarding, IDB fallback banner, error recovery
- All requirements formally verified (Phases 8–9); two integration defects fixed post-audit (Phase 10)

---

