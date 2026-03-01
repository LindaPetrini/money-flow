# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-02-28
**Phases:** 10 | **Plans:** 26 | **Sessions:** 1 (overnight unattended run)

### What Was Built
- Full invoice-to-allocation workflow (Stabilize + Distribute modes) with per-move transparency
- Dashboard: account balances, inline editing, status indicators, mode badge
- Settings: accounts, floor items (with expiry dates), overflow ratios, Wise buffer, tax %
- History log of all past allocations
- CSV upload + Anthropic AI analysis for bucket-split suggestions with reasoning
- File System Access API persistence + IndexedDB fallback with full error recovery
- 39 requirements formally tracked; all shipped and verified

### What Worked
- **GSD overnight unattended run** — full milestone built in a single session from scaffold to verification without human intervention
- **Verification phases (8–9)** — treating formal verification as dedicated phases caught the ALLOC-02 and INFRA-04 defects that would have been hard to find otherwise
- **Integer cents discipline** — `parseCents`/`formatCents`/`splitCents` kept money math bulletproof throughout; no floating point bugs encountered
- **Pure allocation engine** — keeping `allocationEngine.ts` free of React imports made it trivially testable in Node and enabled 75+ focused unit tests
- **Staged execution (wave-based)** — parallel plan execution across waves was effective; plans with no dependencies ran concurrently and saved time
- **Transparency-first design** — baking `calculation` and `reason` into `AllocationMove` at the type level meant transparency was never an afterthought

### What Was Inefficient
- **Phase 1 requirements left unverified** — INFRA-01/02/03/06/07 were never formally verified (no Phase 1 VERIFICATION.md), requiring manual checkbox cleanup at milestone completion
- **Phase 02 VERIFICATION.md gaps_found** — a pre-existing `noUnusedLocals` TS error in a test file caused Phase 2's verification to fail; this cascaded into Phase 10 needing a documentation fix
- **Milestone audit pre-gap-closure** — the v1.0 audit was run before Phases 8–10 existed, leaving it with `gaps_found` status that was technically stale by milestone completion
- **ROADMAP.md progress table drift** — progress table rows didn't all reflect consistent statuses (some showed "Not started" for phases already complete), requiring cleanup at milestone end

### Patterns Established
- **Verification-as-phase pattern** — create dedicated verification phases (N+1 style) after implementation phases to formally close requirements with evidence
- **Defect tracking in CONTEXT.md** — when a defect is found during verification, document exact file:line and fix approach in the next phase's CONTEXT.md so the planner has zero ambiguity
- **`floorItemId` on `AllocationMove`** — optional field for floor-rule moves enables correct coverage marking without relying on account ID as discriminator
- **HTTPS required for FSA** — File System Access API won't show directory picker over HTTP; always serve with HTTPS cert in dev (Tailscale cert pattern works well)

### Key Lessons
1. **Run the milestone audit AFTER gap-closure phases, not before** — the audit is most valuable as a pre-completion gate, not a mid-build diagnostic
2. **Verification phases pay off** — the two ALLOC-02 and INFRA-04 defects were only found because dedicated verification phases read the code carefully; ad-hoc testing would have missed them
3. **Keep domain logic zero-dependency** — pure TypeScript domain files (no React, no browser globals) can be tested in Node and reasoned about independently; this pattern should be mandatory for all allocation-related code in future milestones
4. **A11y and "New Month" reset are the obvious v1.1 gaps** — the `"New Month" reset` requirement was deferred in planning and never implemented; it should be the first feature in v1.1

### Cost Observations
- Model mix: ~100% sonnet (balanced profile)
- Sessions: 1 unattended overnight session
- Notable: Full milestone (scaffold → working app → formal verification → bug fixes) built autonomously in a single session

---

## Milestone: v1.1 — AI-Powered Insights

**Shipped:** 2026-03-01
**Phases:** 3 (11–13) | **Plans:** 8 | **Sessions:** 1 (interactive)
**Stats:** 32 commits, 43 files, 6,593 insertions, 135 tests passing

### What Was Built
- Schema foundation: domain type extensions (`source`, `theme`, `MerchantEntry`) with backward-compatible migrations
- FOUC-free dark mode (system/light/dark) with localStorage mirror and Tailwind v4 dark variant fix
- Invoice "From" field: optional client/project name threaded through the whole stack (form → store → history)
- 5-filter history search: date range, source text, amount min/max — all AND-composed with useMemo
- AI combined analysis: single Anthropic call returning bucket suggestions + uncertain transactions; strict `additionalProperties: false` JSON schemas
- Q&A state machine in `CsvAiSection`: `CsvAiPhase` discriminant, merchant pre-classification, Q&A cards, `merchantStore` persistence
- Floor detection + pre-fill: post-Q&A `callFloorDetection()` with Accept → FloorItemsSection pre-fill via lifted state + tab switch + 2-second highlight ring

### What Worked
- **Schema-first approach** — dedicating Phase 11 to types/store wiring before any UI work meant Phases 12 and 13 had zero type conflicts
- **2-call AI session design** — combining bucket suggestions and uncertain transactions into one call kept the UX predictable and cost-bounded (≤2 API calls per import regardless of file size)
- **Merchant pre-classification before API call** — synchronous `lookupMerchant` loop before sending to Anthropic reduced payload size and skipped known merchants from Q&A flow cleanly
- **State machine discriminant (`CsvAiPhase`)** — explicit phase union type made the multi-step UI flow readable and prevented impossible state combinations
- **Lifted state for cross-section pre-fill** — `pendingFloorItem` in `SettingsPage` was the clean solution for wiring `CsvAiSection` → `FloorItemsSection` without prop drilling through unrelated components
- **TDD discipline maintained** — 19 new tests for `anthropicClient.ts` written before implementation; all 135 tests passed at phase end

### What Was Inefficient
- **REQUIREMENTS.md checkbox drift** — Phase 12 requirements (THEME, INVSRC, HIST) were implemented but never checked off in REQUIREMENTS.md; had to fix at milestone completion
- **ROADMAP.md Phase 13 progress row** — missing milestone column in the progress table for Phase 13 (formatting bug in the executor)
- **No formal verification phases for v1.1** — unlike v1.0 (Phases 8–9), v1.1 skipped dedicated UAT phases; the GSD verifier agent ran inline instead. This worked but means less formal evidence per requirement

### Patterns Established
- **`CsvAiPhase` discriminant union** — explicit phase state machine in complex multi-step UI; renders different JSX subtrees per phase with no boolean flag soup
- **Anthropic JSON schema strictness** — `additionalProperties: false` on every nested object in structured output schemas; prevents hallucinated fields from silently breaking consumers
- **pendingFloorItem + ref scroll pattern** — for cross-section pre-fill: lift state to common ancestor, switch tab, setTimeout(scroll, 50), useEffect in target section pre-fills form and calls `onPendingConsumed` before setting highlight to prevent re-trigger

### Key Lessons
1. **Check off requirements at implementation time, not at milestone end** — the Phase 12 requirements drift would have been caught immediately if executors marked `[x]` in REQUIREMENTS.md after each plan
2. **AI session design choices are UX choices** — "at most 2 calls" was a constraint that shaped the entire Phase 13 architecture; surface this kind of constraint in CONTEXT.md so planners can design around it
3. **Merchant pre-classification is cheap and high-value** — a synchronous dictionary lookup before any API call reduces token cost, improves Q&A relevance, and provides an immediate "N merchants auto-classified" win in the UI
4. **Schema-first milestones pay off** — Phase 11's pure infrastructure work felt like overhead but eliminated all cross-phase type conflicts in Phases 12 and 13

### Cost Observations
- Model mix: ~100% sonnet (balanced profile)
- Sessions: 1 interactive session (execute-phase + complete-milestone)
- Notable: v1.1 was more focused than v1.0 (3 phases vs 10) — tight milestone scope with a clear theme resulted in zero mid-course corrections

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 10 | Baseline — first milestone |
| v1.1 | 1 | 3 | Tighter scope (3 phases); schema-first; inline verifier instead of UAT phases |

### Cumulative Quality

| Milestone | Tests | Notes |
|-----------|-------|-------|
| v1.0 | 116 | Pure domain tests + component integration tests |
| v1.1 | 135 | +19 new tests for anthropicClient; no regressions |

### Top Lessons (Verified Across Milestones)

1. Verification phases catch defects that implementation phases miss — treat them as first-class phases, not afterthoughts
2. Zero-dependency domain code is easier to test, debug, and reason about independently of the UI framework
3. Check off requirements immediately after implementation — don't let tracking debt accumulate to milestone end
4. Schema-first phases eliminate cross-phase type conflicts — worth the apparent overhead of a "pure infrastructure" phase
