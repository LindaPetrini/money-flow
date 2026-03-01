---
phase: 13-ai-layer
plan: "01"
subsystem: api
tags: [anthropic, typescript, json-schema, fetch, tdd]

# Dependency graph
requires:
  - phase: 11-schema-foundation
    provides: "MerchantEntry type used in callFloorDetection clarifications parameter"
  - phase: 12-csv-ai-flow
    provides: "ParsedTransaction type from csvParser — input for both new functions"
provides:
  - "callCombinedAnalysis: single Anthropic API call returning bucket suggestions + uncertain transactions"
  - "callFloorDetection: Anthropic API call for recurring expense detection with clarification context"
  - "UncertainTransaction, CombinedAnalysisResult, FloorItemSuggestion, FloorDetectionResult types"
  - "COMBINED_ANALYSIS_SCHEMA and FLOOR_DETECTION_SCHEMA with additionalProperties: false on every nested object"
affects:
  - 13-02 (Q&A card UI imports callCombinedAnalysis and UncertainTransaction)
  - 13-03 (floor detection UI imports callFloorDetection and FloorDetectionResult)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD: RED commit of test file before implementation, GREEN commit after all pass"
    - "Anthropic structured output: output_config.format.type = 'json_schema' with additionalProperties: false on all nested schemas"
    - "SECURITY: apiKey never appears in thrown error messages — only status + errorType from API response"
    - "max_tokens 4096 for combined analysis (larger prompt), 2048 for floor detection"

key-files:
  created:
    - src/lib/anthropicClient.test.ts
  modified:
    - src/lib/anthropicClient.ts

key-decisions:
  - "callCombinedAnalysis uses max_tokens: 4096 — combined prompt (bucket analysis + uncertain transaction list) is significantly larger than the legacy single-bucket analysis call"
  - "amountEur in UncertainTransaction is always negative (expense); amountEur in FloorItemSuggestion is always positive (absolute magnitude) — prompt explicitly instructs the model on sign convention"
  - "No minimum/maximum JSON schema constraints — Anthropic's structured output format rejects numerical bounds; only type: number is used"
  - "callAnthropicAPI marked @deprecated via JSDoc pointing to callCombinedAnalysis — NOT deleted, preserving backward compatibility for any callers in plans 02/03 that have not yet migrated"

patterns-established:
  - "All new API schemas follow: type object + explicit required array + additionalProperties: false (on root and every nested items schema)"
  - "Prompt builders are module-level functions (not exported) — pure string builders, easily testable and replaceable"

requirements-completed:
  - AIAN-01

# Metrics
duration: 10min
completed: 2026-03-01
---

# Phase 13 Plan 01: AI Layer — Anthropic Client Extension Summary

**callCombinedAnalysis (bucket suggestions + uncertain transaction list) and callFloorDetection (recurring expense detection) added to anthropicClient.ts via TDD with strict JSON schema and security guarantees**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-01T11:26:43Z
- **Completed:** 2026-03-01T11:36:00Z
- **Tasks:** 1 (TDD: RED + GREEN + build fix)
- **Files modified:** 2

## Accomplishments

- Two new exported API functions that plans 02 and 03 depend on directly
- Four new exported TypeScript interfaces with clean, precise type contracts
- All JSON schemas have `additionalProperties: false` on every nested object — no unsupported constraints
- `callAnthropicAPI` marked `@deprecated` via JSDoc, not deleted
- 19 new tests added; all 135 tests pass; `npm run build` succeeds

## Task Commits

TDD flow — three commits for one task:

1. **RED — failing tests** - `c16cec9` (test)
2. **GREEN — implementation + build fix** - `d6706dd` (feat)

## Files Created/Modified

- `src/lib/anthropicClient.ts` — Extended with new types, schemas, prompt builders, and two new exported API functions; `callAnthropicAPI` deprecated
- `src/lib/anthropicClient.test.ts` — 19 new tests: success paths, header verification, max_tokens checks, json_schema output_config, empty inputs, AnthropicAPIError on non-2xx, apiKey security, network failures, compile-time type checks

## Decisions Made

- `callCombinedAnalysis` uses `max_tokens: 4096` (vs legacy 2048) because the combined prompt includes both bucket analysis instructions and uncertain transaction detection, producing a larger response
- Sign conventions made explicit in prompts: `amountEur` in `UncertainTransaction` is negative; `amountEur` in `FloorItemSuggestion` is positive (absolute value) — avoids ambiguity for plan 02/03 consumers
- No `minimum`/`maximum` JSON schema constraints — Anthropic structured outputs reject numerical bounds; `type: number` only
- `callAnthropicAPI` retained (not deleted) with `@deprecated` JSDoc — plans 02 and 03 may reference it; removal deferred to a cleanup phase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `beforeEach` import causing TypeScript build error**
- **Found during:** Task 1 (build verification after GREEN)
- **Issue:** Test file imported `beforeEach` from vitest but never used it — TypeScript strict mode flags unused imports as errors, causing `npm run build` to fail
- **Fix:** Removed `beforeEach` from the vitest import statement
- **Files modified:** `src/lib/anthropicClient.test.ts`
- **Verification:** `npm run build` passes after removal
- **Committed in:** `d6706dd` (same feat commit as GREEN implementation)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused import causing build failure)
**Impact on plan:** Minor cleanup — no scope creep. All done criteria still met.

## Issues Encountered

None beyond the unused import auto-fix above.

## User Setup Required

None - no external service configuration required. (Anthropic API key is entered at runtime by the user in the app UI.)

## Next Phase Readiness

- `callCombinedAnalysis` and `callFloorDetection` are ready for import by plans 02 and 03
- All four new types exported and available
- No blockers for plan 13-02

---
*Phase: 13-ai-layer*
*Completed: 2026-03-01*
