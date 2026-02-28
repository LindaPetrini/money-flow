# Phase 10: Fix Integration Defects - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two precisely-specified integration defects found in the v1.0 audit, and update the stale Phase 02 VERIFICATION.md status. No new features — surgical bug fixes only.

**Defect 1 — ALLOC-02 (medium):** Floor item coverage marking uses `destinationAccountId` instead of `floorItemId`. Multiple floor items can share the same destination account; current code marks all of them covered when only one was funded.

**Defect 2 — INFRA-04 (low-ux):** First-run detection is coupled to `accounts.length === 0`. Returning Chrome users who have no accounts (e.g. fresh install, data cleared) incorrectly see the first-run onboarding card instead of the normal empty dashboard.

**Defect 3 — Metadata:** Phase 02 VERIFICATION.md has `status: gaps_found` due to a now-fixed TypeScript `noUnusedLocals` error. Needs re-check and status update to `passed`.

</domain>

<decisions>
## Implementation Decisions

### ALLOC-02 fix approach
- Add `floorItemId?: string` to `AllocationMove` interface in `src/types/domain.ts` (optional to stay backwards-compatible with distribute moves that have no floor item)
- In `allocationEngine.ts` `stabilize()`: populate `floorItemId: floor.id` on each floor move
- In `InvoicePage.tsx` `handleDone()`: collect `move.floorItemId` (filter out undefined) instead of `move.destinationAccountId` for coverage marking
- Update `floorItems.map()` in handleDone to match on `f.id === floorItemId` instead of `f.destinationAccountId === coveredFloorAccountId`
- All 114 existing tests must still pass after the change

### INFRA-04 fix approach
- In `src/App.tsx`, decouple `isFirstRun` from `accounts.length === 0`
- The correct signal for first-run is whether settings have been seeded/initialized — not whether accounts exist
- Use `settings` store state: if `settings.floorItems.length === 0 && settings.overflowRatios.length === 0` as proxy for "not yet initialized", OR check a dedicated `initialized` flag if one exists in the settings type
- Alternative simpler approach: `isFirstRun = needsFsaPrompt` only (show onboarding whenever FSA prompt is needed, regardless of accounts)
- Planner should check what the Phase 7 `isFirstRun` logic actually does and pick the least-invasive correct fix

### Phase 02 VERIFICATION.md update
- Run `npm run build` — confirm it now passes (the `noUnusedLocals` error in `floorCalculator.test.ts` was fixed in Phase 7)
- Update frontmatter: `status: gaps_found` → `status: passed`, update `gaps:` entry from `status: failed` to `status: resolved`
- Update `score:` from `4/5` to `5/5`

### Test coverage
- Update existing tests in `allocationEngine.test.ts` if any assert on `AllocationMove` shape that doesn't include `floorItemId`
- Add a test asserting `stabilize()` moves include `floorItemId` matching the floor item's `id`
- No new test files needed — existing test suite covers the behavior

### Claude's Discretion
- Exact isFirstRun logic for INFRA-04 (choose the simplest correct approach after reading the settings initialization code)
- Whether to update the Phase 02 VERIFICATION.md in the same plan as the code fixes or a separate plan

</decisions>

<specifics>
## Specific Ideas

- ALLOC-02 fix should be minimal: 3 files touched (`domain.ts`, `allocationEngine.ts`, `InvoicePage.tsx`), targeted change only
- INFRA-04: do NOT refactor the entire App.tsx first-run flow — just fix the detection condition
- The Phase 02 VERIFICATION.md update is documentation-only; commit it separately from the code fixes for clean git history

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/domain.ts:36` — `AllocationMove` interface to extend with `floorItemId?: string`
- `src/domain/allocationEngine.ts:96` — `stabilize()` function, pushes moves at line 105
- `src/features/invoice/InvoicePage.tsx:57` — `handleDone()`, coverage marking at lines 74-100
- `src/App.tsx:21` — `isFirstRun = needsFsaPrompt && accounts.length === 0` (INFRA-04 bug location)
- `.planning/phases/02-allocation-engine/02-VERIFICATION.md` — needs status update

### Established Patterns
- `AllocationMove` is consumed by `AllocationResult.tsx` (display) and `InvoicePage.tsx` (handleDone) — adding optional field is non-breaking
- Tests in `src/domain/allocationEngine.test.ts` — check if any assert on AllocationMove shape
- Atomic commits per fix — code fix, then test update, then documentation

### Integration Points
- `stabilize()` → `allocate()` → `InvoicePage` — full chain for ALLOC-02
- `main.tsx` → `App.tsx` → first-run card — full chain for INFRA-04
- `FloorItem.id` is a stable UUID (from `crypto.randomUUID()` at creation time) — safe to use as the discriminator

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-fix-integration-defects*
*Context gathered: 2026-02-28*
