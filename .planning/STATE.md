# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** When an invoice lands, tell the user exactly where every euro goes — so they never have to think about it in the moment.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 3 of 3 complete in current phase
Status: Phase 1 complete — all 3 plans executed and verified
Last activity: 2026-02-28 — Phase 1 executed (scaffold + cents TDD + storage/stores)

Progress: [██░░░░░░░░] 14% (1/7 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~15 min
- Total execution time: 0.75 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Foundation | 3 | 0.75h | ~15min |

**Recent Trend:**
- Last 5 plans: 01-01 (scaffold), 01-02 (TDD cents), 01-03 (storage/stores)
- Trend: On track

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Integer cents throughout — `parseCents`/`formatCents`/`splitCents` with largest-remainder; no floating point in domain logic
- [Init]: File System Access API + IndexedDB fallback for persistence; no backend, no server
- [Init]: Two modes (Stabilize/Distribute) auto-detected from state — never a manual toggle
- [Init]: Vite 7 + React 19 + TypeScript + Tailwind v4 + shadcn/ui (New York) + Zustand 5 (no persist middleware)
- [Init]: Allocation engine (`domain/allocationEngine.ts`) must have zero React imports — pure TS, testable in Node

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 6]: Anthropic browser API CORS policy is LOW confidence — verify `anthropic-dangerous-direct-browser-access` header behavior before writing any AI integration code. May need lightweight proxy if direct browser access is blocked.

## Session Continuity

Last session: 2026-02-28
Stopped at: Phase 1 fully executed. 3/3 plans complete. Ready for Phase 2 planning.
Resume file: None

### Execution Notes (Phase 1)
- vitest upgraded to v3 (v2 had type conflicts with vite v7)
- Used separate vitest.config.ts (not inline in vite.config.ts) to avoid plugin type conflicts
- FSA API types added via src/types/fsa.d.ts (not in TS lib.dom.d.ts yet)
- passWithNoTests: true in vitest config (needed before test files exist)
