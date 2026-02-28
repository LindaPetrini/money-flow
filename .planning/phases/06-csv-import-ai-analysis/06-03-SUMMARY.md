---
phase: 06-csv-import-ai-analysis
plan: 03
subsystem: ui
tags: [react, zustand, anthropic, csv, tailwind, typescript]

# Dependency graph
requires:
  - phase: 06-csv-import-ai-analysis plan 02
    provides: CsvAiSection with analysisResult state, callAnthropicAPI, AIAnalysisResult types
  - phase: 04-configuration
    provides: OverflowRatiosSection pattern, settingsStore.updateSettings interface
provides:
  - Full AI suggestion cards UI with per-card Accept/Skip, editable amounts, account assignment select
  - computeProjectedRatios: proportional ratio calculation from accepted card euro amounts
  - handleApply: writes projected overflowRatios to settingsStore and resets analysis state
  - SettingsPage CSV & AI tab (already wired in Plan 02, verified here)
affects: [07-hardening, any future phase reading overflowRatios from settingsStore]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IIFE render pattern for scoped derived state inside JSX (computeProjectedRatios called inside render block)"
    - "Proportional ratio calculation: each accepted bucket pct = (amountEur / totalAcceptedEur) * 100"
    - "Post-apply reset: both analysisResult and suggestions set to null to prevent re-apply"

key-files:
  created: []
  modified:
    - src/features/settings/CsvAiSection.tsx
    - src/features/settings/SettingsPage.tsx (verified complete from Plan 02)

key-decisions:
  - "Account-to-bucket mapping uses sequential assignment from overflowRatios array — avoids brittle name-matching, user can reassign via select"
  - "Skipped buckets keep their original pct unchanged — only accepted entries affect ratio calculation"
  - "projectedTotal compared with Math.round() === 100 to avoid floating-point false negatives (e.g. 99.999...)"
  - "Both analysisResult and suggestions reset to null after successful apply — prevents stale state re-apply"
  - "SettingsPage CSV & AI tab was already wired in Plan 02 (no additional commit needed)"

patterns-established:
  - "Suggestion state as Record<BucketKey, SuggestionState> — per-card accepted/amountStr/accountId"
  - "computeProjectedRatios: pure function called both in handleApply guard and in render IIFE"

requirements-completed: [CSV-04, CSV-05, CSV-06, CSV-07, CSV-08]

# Metrics
duration: 10min
completed: 2026-02-28
---

# Phase 6 Plan 03: CSV & AI — Suggestion Cards and Apply Logic Summary

**4 AI suggestion cards with Accept/Skip toggles, editable amounts, proportional ratio calculation, and one-click Apply that persists to settingsStore**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-28T16:49:53Z
- **Completed:** 2026-02-28T16:52:30Z
- **Tasks:** 2 (Task 1 implemented; Task 2 already complete from Plan 02)
- **Files modified:** 1 (CsvAiSection.tsx)

## Accomplishments

- Added full suggestion card UI — 4 bucket cards (Everyday Essentials, Fun & Discretionary, One-off & Travel, Recurring Fixed) with spending average, AI reasoning paragraph, editable monthly amount input, account assignment select, and Accept/Skip toggle buttons
- Implemented computeProjectedRatios that calculates new overflow ratios proportionally from accepted card amounts (skipped buckets keep current pct)
- Implemented handleApply that validates ratios sum to 100%, calls updateSettings({ overflowRatios }), resets suggestions and analysisResult to null after success
- Running projected ratio total displayed in real time with green/red color feedback and inline warning when not at 100%
- Apply button disabled until at least 1 bucket accepted AND projected total rounds to 100%
- Success message shown after Apply completes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add suggestion cards + apply logic to CsvAiSection.tsx** - `2f1160d` (feat)
2. **Task 2: Wire CsvAiSection into SettingsPage as 'CSV & AI' tab** - already complete from Plan 02 (no new commit needed)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/features/settings/CsvAiSection.tsx` - Added BucketKey/SuggestionState types, BUCKET_LABELS/BUCKET_KEYS constants, store hooks (useSettingsStore, useAccountStore), suggestion card state (suggestions, isApplying, applySuccess), suggestions initialization in handleAnalyse, computeProjectedRatios helper, handleApply, full suggestion cards JSX with running total and Apply button

## Decisions Made

- **Account-to-bucket mapping:** Sequential assignment — first overflow ratio account assigned to Everyday Essentials, second to Fun & Discretionary, etc. User can reassign via select dropdown. This avoids brittle name-matching while keeping the user in control.
- **Skipped buckets keep current pct:** Only accepted entries with a non-empty accountId affect ratio recalculation. Skipped buckets return their unchanged entry from settings.overflowRatios.
- **Math.round() === 100 for ratio validation:** Avoids floating-point edge cases where 99.999... fails strict equality. Consistent with the OverflowRatiosSection pattern.
- **Reset after apply:** Both analysisResult and suggestions set to null — section returns to upload state, preventing stale results from being accidentally re-applied.
- **IIFE render pattern:** computeProjectedRatios called inside an IIFE in the JSX conditional to scope projectedTotal and derived booleans without adding extra component-level variables.

## Deviations from Plan

### Pre-existing completions

**Task 2 (SettingsPage CSV & AI tab) was already fully implemented in Plan 02.**

Plan 02 wired CsvAiSection into SettingsPage ahead of schedule — the type union, SECTIONS array entry, import, and render branch were all present. No changes needed; verified correct via grep and build.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused projectedRatios variable from render IIFE**

- **Found during:** Task 1 build verification
- **Issue:** TypeScript error TS6133 — `projectedRatios` declared but never read in render block (it IS used in handleApply but that's a separate call)
- **Fix:** Changed `const { ratios: projectedRatios, total: projectedTotal } = computeProjectedRatios()` to `const { total: projectedTotal } = computeProjectedRatios()` in the render IIFE. handleApply calls computeProjectedRatios() independently and uses projectedRatios there.
- **Files modified:** src/features/settings/CsvAiSection.tsx
- **Verification:** Build passed with zero TypeScript errors
- **Committed in:** 2f1160d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused variable from render/handler split)
**Impact on plan:** Necessary correctness fix. No scope creep.

## Issues Encountered

None beyond the TypeScript unused-variable fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 (CSV + AI) is now complete — all 3 plans done
- CsvAiSection delivers full AI analysis UX: key management, CSV upload, transaction preview, AI analysis, suggestion cards with reasoning transparency, per-card Accept/Skip, running ratio validation, and Apply to settingsStore
- SettingsPage has 5 tabs including CSV & AI
- Build passes, 114 tests green, no regressions
- Phase 7 (Hardening) is ready to begin

---
*Phase: 06-csv-import-ai-analysis*
*Completed: 2026-02-28*
