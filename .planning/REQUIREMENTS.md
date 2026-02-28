# Requirements: Money Flow

**Defined:** 2026-02-28
**Core Value:** When an invoice lands, tell the user exactly where every euro goes — so they never have to think about it in the moment.

## v1.1 Requirements

Requirements for the AI-Powered Insights milestone. Each maps to roadmap phases.

### Theme

- [ ] **THEME-01**: User can toggle between light, dark, and system preference
- [ ] **THEME-02**: Theme preference persists across sessions (no flash on reload)
- [ ] **THEME-03**: Page loads in the correct theme with no visible flash of wrong theme

### Invoice Source

- [ ] **INVSRC-01**: User can enter an optional "From" field (client/project name) on invoice entry
- [ ] **INVSRC-02**: Client name is displayed in the allocation history log

### History

- [ ] **HIST-01**: User can filter history by date range
- [ ] **HIST-02**: User can search history by client/source name
- [ ] **HIST-03**: User can filter history by amount range

### AI Analysis

- [ ] **AIAN-01**: After CSV import, AI identifies transactions it cannot confidently categorize
- [ ] **AIAN-02**: User can provide context and assign a bucket for each uncertain transaction
- [ ] **AIAN-03**: Merchant→bucket assignments persist across future imports
- [ ] **AIAN-04**: Known merchants are pre-classified on future imports (skipping Q&A)
- [ ] **AIAN-05**: AI detects recurring expenses from CSV and suggests them as floor items
- [ ] **AIAN-06**: Confirming a floor item suggestion pre-fills the floor item form

## Future Requirements

Deferred to v1.2 or later.

### AI Analysis Extensions

- **AIAN-EXT-01**: User can view and manage saved merchant→bucket mappings
- **AIAN-EXT-02**: History can be exported to CSV

### Invoice

- **INVOICE-EXT-01**: User can optionally exclude a bucket when processing an invoice (e.g. skip investing)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Silent auto-categorization of all transactions | Breaks transparency — core value of Money Flow |
| Mandatory client name field | Freelancers paid via Stripe/PayPal have no "client" concept |
| Complex AND/OR filter logic | Disproportionate complexity for ~50–200 history records |
| Client analytics (totals per client) | Needs multiple data points; defer until history is richer |
| Bank API sync | Manual balance updates only — out of scope by design |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

Note: Phase 11 (Schema Foundation) is pure infrastructure — it carries no v1.1 requirements directly but is a hard dependency for Phases 12 and 13.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 12 | Pending |
| THEME-02 | Phase 12 | Pending |
| THEME-03 | Phase 12 | Pending |
| INVSRC-01 | Phase 12 | Pending |
| INVSRC-02 | Phase 12 | Pending |
| HIST-01 | Phase 12 | Pending |
| HIST-02 | Phase 12 | Pending |
| HIST-03 | Phase 12 | Pending |
| AIAN-01 | Phase 13 | Pending |
| AIAN-02 | Phase 13 | Pending |
| AIAN-03 | Phase 13 | Pending |
| AIAN-04 | Phase 13 | Pending |
| AIAN-05 | Phase 13 | Pending |
| AIAN-06 | Phase 13 | Pending |

**Coverage:**
- v1.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 — traceability confirmed after roadmap creation (Phases 11–13)*
