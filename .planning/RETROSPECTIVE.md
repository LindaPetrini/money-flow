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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 10 | Baseline — first milestone |

### Cumulative Quality

| Milestone | Tests | Notes |
|-----------|-------|-------|
| v1.0 | 116 | Pure domain tests + component integration tests |

### Top Lessons (Verified Across Milestones)

1. Verification phases catch defects that implementation phases miss — treat them as first-class phases, not afterthoughts
2. Zero-dependency domain code is easier to test, debug, and reason about independently of the UI framework
