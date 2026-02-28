# Milestones

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

