---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: AI-Powered Insights
status: unknown
last_updated: "2026-03-01T11:39:57.388Z"
progress:
  total_phases: 13
  completed_phases: 13
  total_plans: 34
  completed_plans: 34
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** When an invoice lands, tell the user exactly where every euro goes — so they never have to think about it in the moment.
**Current focus:** v1.1 AI-Powered Insights — Phase 11 ready to plan

## Current Position

Phase: 13 of 13 (AI Layer)
Plan: 3 of 3 — COMPLETE
Status: Complete
Last activity: 2026-03-01 — 13-03 complete; Phase 13 AI Layer finished — floor detection wired end-to-end, pendingFloorItem pre-fills FloorItemsSection

Progress: [██████████] 100% (34/34 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: ~15 min
- Total execution time: ~6.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Foundation | 3 | 0.75h | ~15min |
| 02–10 (v1.0) | 23 | ~5.75h | ~15min |
| 11-01 Schema Foundation | 1 | 5min | 5min |
| 11-02 Schema Foundation | 1 | 8min | 8min |

**Recent Trend:**
- Last 5 plans: Phase 10 (fix-integration-defects ×3), Phase 9, Phase 8
- Trend: Stable

*Updated after each plan completion*
| Phase 13-ai-layer P02 | 8 | 2 tasks | 1 files |
| Phase 13-ai-layer P03 | 15 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v1.1:

- [Phase 10]: `floorItemId?: string` added to `AllocationMove`; `stabilize()` populates it; `handleDone()` uses `floorItemId` for floor coverage marking
- [Phase 10]: `isFirstRun = needsFsaPrompt` only — removed `accounts.length === 0` coupling
- [Research]: Zero new npm dependencies for v1.1 — dark mode via Tailwind v4 `@custom-variant`, streaming via raw `fetch` + `ReadableStream`, history filter via `useMemo`
- [Research]: Tailwind v4 `@custom-variant dark` selector must be `(&:where(.dark, .dark *))` — current `(&:is(.dark *))` excludes root element
- [Research]: FOUC prevention requires inline `<head>` script in `index.html` — no React-only fix exists
- [Research]: `merchantStore` write guards (`if (!get().initialized) return`) must be in place before first write
- [Phase 11-01]: `merchantName` stored case-preserved (not lowercased) — Phase 13 research determines case sensitivity strategy
- [Phase 11-01]: source migration uses `?? ''` (empty string) not `?? undefined` — Phase 12 can call `record.source.toLowerCase()` without null check
- [Phase 11-01]: Read-time migration only (no disk write) — preserves backward compatibility with pre-v1.1 data
- [Phase 11-02]: lookupMerchant has no initialized guard — returning undefined is correct "not found" behavior for both "not found" and "not loaded" states
- [Phase 11-02]: upsertMerchant case-sensitive merchantName matching — Phase 13 determines normalization strategy
- [Phase 11-02]: applyTheme is a private module-level helper, not exported from settingsStore
- [Phase 13-01]: callCombinedAnalysis uses max_tokens: 4096 (combined prompt larger than legacy 2048 for callAnthropicAPI)
- [Phase 13-01]: amountEur in UncertainTransaction is negative (expense); in FloorItemSuggestion is positive (absolute value) — sign convention made explicit in prompts
- [Phase 13-01]: No minimum/maximum JSON schema constraints — Anthropic rejects them; only type: number used
- [Phase 13-01]: callAnthropicAPI kept with @deprecated JSDoc — not deleted until plans 02/03 migration complete
- [Phase 13-ai-layer]: Tasks 1 and 2 of 13-02 combined into a single commit targeting only CsvAiSection.tsx; void prop pattern used for forward-compatibility stubs (onFloorItemSuggested, allTransactionsRef) until Plan 13-03 wires them
- [Phase 13-ai-layer]: onPendingConsumed called inside useEffect before setPendingHighlight to prevent infinite re-trigger; useEffect intentionally omits onPendingConsumed from deps (stable useCallback)
- [Phase 13-ai-layer]: Floor detection error degrades gracefully to 'complete' phase — bucket suggestion cards remain visible; amountStr conversion uses String(Math.abs(...).toFixed(2)) matching FloorItemDraft contract

### Pending Todos

None.

### Blockers/Concerns

- [Research flag]: Anthropic JSON schema for `callUncertainTransactionDetection()` response shape is the highest-risk design decision in Phase 13 — allocate prompt iteration time during 13-01 execution

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 13-03-PLAN.md — Phase 13 AI Layer complete; all 13 phases done; npm run build succeeds; 135 tests pass
Resume file: None
