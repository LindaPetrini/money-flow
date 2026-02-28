---
phase: 07-hardening
verified: 2026-02-28T18:15:00Z
status: passed
score: 20/20 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 17/17
  gaps_closed:
    - "User can see their current storage mode (FSA file storage or IDB browser-local) in Settings"
    - "User can click 'Change folder' in Settings to pick a new data folder (FSA mode only)"
    - "On Firefox/Safari (IDB mode), the Settings Storage section shows a clear message that data is browser-local"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open app in Chrome/Edge, grant folder access, then revoke write permission mid-session (or simulate by calling _reportPermissionLost in DevTools). Trigger a write (edit a balance)."
    expected: "Blocking overlay appears with 'Storage access lost' heading and 'Re-grant access' button. All other UI is unreachable. Clicking the button triggers browser permission prompt and reloads."
    why_human: "FSA permission revocation requires a real browser FSA session; visual blocking behavior and z-index stacking must be confirmed visually."
  - test: "Open app in Firefox or Safari (no FSA API). Check for amber banner below the header."
    expected: "Amber banner visible with 'data is browser-local' warning. Click x — banner disappears. Reload — banner stays hidden."
    why_human: "Requires Firefox/Safari browser session to trigger fsaDriver === null path. localStorage persistence across reloads requires real browser interaction."
  - test: "Open app in a fresh browser profile with no data, no FSA permission. Confirm needsFsaPrompt === true and no accounts exist."
    expected: "Welcome to Money Flow card appears instead of tabs content. 'Choose data folder' button triggers folder picker."
    why_human: "Requires true first-run state (clean storage). Visual centering and card presentation need visual confirmation."
  - test: "Open Settings -> Storage tab in Chrome/Edge (FSA mode)."
    expected: "'File storage (File System Access API)' label visible. 'Change folder' button present. Clicking it opens directory picker. Cancelling does not crash."
    why_human: "Requires a real browser FSA session to test directory picker interaction."
  - test: "Open Settings -> Storage tab in Firefox/Safari (IDB mode)."
    expected: "'Browser storage (IndexedDB)' label visible with explanation text. No 'Change folder' button shown."
    why_human: "Requires Firefox/Safari to place app in IDB-only mode."
---

# Phase 7: Hardening Verification Report

**Phase Goal:** The app handles FSA permission loss, storage failures, and first-run onboarding gracefully — no silent data loss, no confusing error states
**Verified:** 2026-02-28T18:15:00Z
**Status:** PASSED
**Re-verification:** Yes — after gap closure (plan 03 added post-UAT; initial VERIFICATION.md predated plan 03 execution)

---

## Goal Achievement

### Success Criteria Coverage

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | When FSA directory handle loses permission, app shows clear re-prompt overlay blocking further use | VERIFIED | `permissionLost && <div className="fixed inset-0 z-50 ...">` in App.tsx line 46–58; `h2` "Storage access lost"; single `Button` "Re-grant access"; no close option |
| 2 | On Firefox/Safari (IDB-only mode), explicit "your data is browser-local" notice is surfaced | VERIFIED | Amber banner at App.tsx line 67 gated on `storageMode === 'idb' && fsaDriver === null && !idbNoticeDismissed`; Settings > Storage tab shows "Browser storage (IndexedDB)" explanation when `fsaDriver === null` |
| 3 | First-run onboarding screen clearly guides users to choose a data directory before allocation work | VERIFIED | `isFirstRun = needsFsaPrompt && accounts.length === 0`; onboarding card with "Welcome to Money Flow" heading and "Choose data folder" button replaces tab content when true |

### Observable Truths — Plan 01 (StorageErrorContext + Store Guards)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | StorageErrorContext.tsx exports `reportPermissionLost()`, `StorageErrorProvider`, `useStorageError()` | VERIFIED | Lines 14, 18, 35 of StorageErrorContext.tsx — all three `export function` declarations confirmed |
| 2 | `StorageErrorProvider` registers `_reportPermissionLost` via `useEffect` and cleans up on unmount | VERIFIED | Lines 21–26: `_reportPermissionLost = () => setPermissionLost(true)` in effect; `return () => { _reportPermissionLost = null; }` cleanup |
| 3 | `accountStore.setAccounts` and `accountStore.updateBalance` wrap storage.write in try/catch — NotAllowedError calls `reportPermissionLost()` and returns | VERIFIED | accountStore.ts lines 27–35 and 43–52: both write sites have `try { await storage.write... } catch (e) { if (e instanceof DOMException && e.name === 'NotAllowedError') { reportPermissionLost(); return; } throw e; }` |
| 4 | `allocationStore.appendAllocation` wraps storage.write in try/catch with identical NotAllowedError handling | VERIFIED | allocationStore.ts lines 26–35: identical pattern confirmed |
| 5 | `settingsStore.updateSettings` wraps storage.write in try/catch with identical NotAllowedError handling | VERIFIED | settingsStore.ts lines 36–45: identical pattern confirmed |
| 6 | No store re-throws NotAllowedError — memory state is preserved after permission loss | VERIFIED | In all three stores, NotAllowedError branch is `reportPermissionLost(); return;` — no re-throw; `set()` call precedes `try {}` in every case |

### Observable Truths — Plan 02 (App UX Hardening)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | `main.tsx` wraps `<App>` with `<StorageErrorProvider>` inside `<StrictMode>` | VERIFIED | main.tsx lines 24–28: `<StrictMode><StorageErrorProvider><App .../></StorageErrorProvider></StrictMode>` |
| 8 | App.tsx shows blocking `fixed inset-0 z-50` overlay when `permissionLost === true` — title "Storage access lost", "Re-grant access" button | VERIFIED | App.tsx lines 46–58: condition `{permissionLost && ...}`, `className="fixed inset-0 z-50 ..."`, `h2` "Storage access lost", `Button` "Re-grant access" |
| 9 | Overlay has no dismiss/close option | VERIFIED | Lines 46–58 contain only h2, p, and one Button — no close/dismiss button present |
| 10 | `handleReGrantAccess` calls `fsaDriver.requestPermission()` then `window.location.reload()` | VERIFIED | App.tsx lines 32–36: exact sequence confirmed |
| 11 | App.tsx shows dismissible amber banner when `storageMode === 'idb' && fsaDriver === null && !idbNoticeDismissed` | VERIFIED | App.tsx line 67: condition matches exactly; dismiss `×` button at line 73 calls `handleDismissIdbNotice` |
| 12 | IDB banner NOT shown when `storageMode === 'idb'` but `fsaDriver !== null` | VERIFIED | Condition requires `fsaDriver === null` — if fsaDriver is non-null, banner is suppressed |
| 13 | IDB banner dismiss state persisted to `localStorage['idb_notice_dismissed'] = '1'` and initialized from localStorage | VERIFIED | `handleDismissIdbNotice` (line 38–41) calls `localStorage.setItem('idb_notice_dismissed', '1')`; `useState` lazy initializer (line 22–24) reads `localStorage.getItem('idb_notice_dismissed') === '1'` |
| 14 | App.tsx shows onboarding card when `needsFsaPrompt === true && accounts.length === 0` — heading "Welcome to Money Flow", "Choose data folder" button | VERIFIED | `isFirstRun` at line 21; lines 116–129: Card with `h1` "Welcome to Money Flow", Button "Choose data folder" |
| 15 | When `needsFsaPrompt === true && accounts.length > 0` (returning visit): reconnect banner with "Reconnect" button | VERIFIED | Lines 84–93: `{needsFsaPrompt && !isFirstRun && ...}` — "Click to reconnect your data folder" + "Reconnect" button |
| 16 | Old `needsFsaPrompt` banner ("Grant folder access to use file storage") removed | VERIFIED | Pattern not found in App.tsx; old banner absent |
| 17 | Old header muted text displaying storage mode removed | VERIFIED | Header contains only `<span>Money Flow</span>` — no storage-mode indicator text |

### Observable Truths — Plan 03 (Storage Settings — Gap Closure)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 18 | User can see their current storage mode in Settings | VERIFIED | StorageSection.tsx renders "File storage (File System Access API)" when `fsaDriver !== null`, or "Browser storage (IndexedDB)" when `fsaDriver === null`; wired into SettingsPage under "Storage" tab |
| 19 | User can click "Change folder" in Settings to pick a new data folder (FSA mode only) | VERIFIED | StorageSection.tsx lines 43–45: `<Button variant="outline" size="sm" onClick={handleChangeFolder}>Change folder</Button>` rendered in the non-IDB branch; `handleChangeFolder` calls `fsaDriver.requestPermission()` then `window.location.reload()` |
| 20 | On Firefox/Safari (IDB mode), Settings Storage section shows clear browser-local data message | VERIFIED | StorageSection.tsx lines 23–33: IDB branch shows "Browser storage (IndexedDB)" heading + explanation "Your data is stored in this browser only..." with no button |

**Score:** 20/20 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/storage/StorageErrorContext.tsx` | React context + module-level setter for FSA permission-loss signaling | VERIFIED — WIRED | 37 lines; exports `reportPermissionLost`, `StorageErrorProvider`, `useStorageError`; imported by all three stores and App.tsx |
| `src/stores/accountStore.ts` | accountStore with NotAllowedError-safe write paths | VERIFIED — WIRED | 54 lines; two write sites both guarded; imports `reportPermissionLost` |
| `src/stores/allocationStore.ts` | allocationStore with NotAllowedError-safe write path | VERIFIED — WIRED | 37 lines; one write site guarded; imports `reportPermissionLost` |
| `src/stores/settingsStore.ts` | settingsStore with NotAllowedError-safe write path | VERIFIED — WIRED | 46 lines; one write site guarded; imports `reportPermissionLost` |
| `src/main.tsx` | App wrapped in StorageErrorProvider | VERIFIED — WIRED | 32 lines; StorageErrorProvider import confirmed; wraps App inside StrictMode |
| `src/App.tsx` | App with overlay, IDB banner, first-run onboarding card, reconnect banner | VERIFIED — WIRED | 142 lines; all four UX features present and conditioned correctly |
| `src/features/settings/StorageSection.tsx` | Storage settings section showing current mode and folder-change button | VERIFIED — WIRED | 51 lines; exports `StorageSection`; two display states based on `fsaDriver === null`; imported and rendered by SettingsPage |
| `src/features/settings/SettingsPage.tsx` | SettingsPage extended with Storage sub-section tab | VERIFIED — WIRED | 54 lines; `'storage'` in SettingsSection union type; `{ id: 'storage', label: 'Storage' }` in SECTIONS array; `{activeSection === 'storage' && <StorageSection />}` in render |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/stores/accountStore.ts` | `src/lib/storage/StorageErrorContext.tsx` | `import { reportPermissionLost }` | WIRED | Line 3 of accountStore.ts; called in two catch blocks |
| `src/stores/allocationStore.ts` | `src/lib/storage/StorageErrorContext.tsx` | `import { reportPermissionLost }` | WIRED | Line 3 of allocationStore.ts; called in catch block |
| `src/stores/settingsStore.ts` | `src/lib/storage/StorageErrorContext.tsx` | `import { reportPermissionLost }` | WIRED | Line 3 of settingsStore.ts; called in catch block |
| `src/main.tsx` | `src/lib/storage/StorageErrorContext.tsx` | `import { StorageErrorProvider }` | WIRED | Line 10 of main.tsx; StorageErrorProvider wraps App at render line 25 |
| `src/App.tsx` | `src/lib/storage/StorageErrorContext.tsx` | `import { useStorageError }` | WIRED | Line 4 of App.tsx; `useStorageError()` destructured at line 19; `permissionLost` used in overlay at line 46 |
| `src/App.tsx` | `src/lib/storage/storage` | `import { fsaDriver }` | WIRED | Line 2 of App.tsx; `fsaDriver` used in IDB banner condition (line 67) and both handlers |
| `src/features/settings/StorageSection.tsx` | `src/lib/storage/storage` | `import { fsaDriver }` | WIRED | Line 1 of StorageSection.tsx; `isIdbOnly = fsaDriver === null` drives display logic |
| `src/features/settings/SettingsPage.tsx` | `src/features/settings/StorageSection.tsx` | `import { StorageSection }` | WIRED | Line 7 of SettingsPage.tsx; rendered at line 51 when `activeSection === 'storage'` |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-04 | 07-01-PLAN.md, 07-02-PLAN.md | FSA permission lifecycle handled correctly — `queryPermission()` on startup, `requestPermission()` inside user gesture, graceful `NotAllowedError` recovery | SATISFIED | StorageErrorContext bridges NotAllowedError to UI; all three stores catch and signal NotAllowedError without re-throwing; blocking overlay with re-grant button completes the recovery flow; StorageSection provides in-app folder management |
| INFRA-05 | 07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md | IndexedDB fallback when FSA unavailable (Firefox/Safari) — all features work, no file persistence | SATISFIED | Amber IDB banner in App.tsx when `storageMode === 'idb' && fsaDriver === null`; StorageSection shows "Browser storage (IndexedDB)" with clear browser-local data explanation when `fsaDriver === null` |

No orphaned requirements. REQUIREMENTS.md confirms: "Phase 7 is hardening of INFRA-04/INFRA-05 to production quality." Both IDs are claimed across plans and both are satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/settings/SettingsPage.tsx` | 45 | Stale comment: `/* Section content — placeholders replaced in plans 02, 03, 04 */` | Info | Comment references old plan numbering from a prior phase; does not indicate missing implementation — all six sections are rendered below it |

No blockers or warnings. The stale comment is cosmetic only; all six section renders are present and functional.

---

### Build and Test Status

- `npm run build` — PASSED (zero TypeScript errors, 1878 modules transformed)
- `npm test` — PASSED (114/114 tests, 5 test files, all green)
- Commits confirmed in git log:
  - `d3ef01c` feat(07-01): create StorageErrorContext
  - `23d04e9` feat(07-01): add NotAllowedError try/catch guards
  - `9da2bf7` feat(07-02): wrap App in StorageErrorProvider
  - `4c0d6b5` feat(07-02): implement storage hardening UX
  - `cadfec9` feat(07-03): create StorageSection component
  - `baedbed` feat(07-03): wire StorageSection into SettingsPage

---

### Human Verification Required

The following behaviors require human testing in a real browser environment:

#### 1. FSA Permission Loss Overlay

**Test:** Open app in Chrome/Edge, grant folder access, then revoke write permission for the site in browser settings while the app is open (or simulate by calling `window.__debugTriggerPermissionLost?.()` in DevTools if wired). Edit a balance to trigger a write.
**Expected:** Full-screen blocking overlay appears with title "Storage access lost", explanation, and "Re-grant access" button. All other UI is covered and non-interactive. Clicking the button triggers browser permission prompt and reloads the app with all data intact.
**Why human:** FSA permission revocation requires a real browser FSA session. The visual blocking behavior and z-index stacking must be confirmed visually.

#### 2. Firefox/Safari IDB Notice Banner

**Test:** Open app in Firefox (or Safari), verify the amber banner appears below the header. Click the `x` dismiss button. Reload the page.
**Expected:** Banner shows on first load with "Your data is stored in this browser only" message. After dismiss, banner is hidden. After reload, banner stays hidden (localStorage persistence working).
**Why human:** Requires a Firefox/Safari session to trigger the `fsaDriver === null` path. localStorage persistence across reloads requires actual browser interaction.

#### 3. First-Run Onboarding Card

**Test:** Open app in a fresh browser profile with no data and no FSA permission granted.
**Expected:** Instead of tabs content, the "Welcome to Money Flow" card appears centered in the viewport. "Choose data folder" button triggers the browser folder picker. After picking a folder, app reloads into normal dashboard.
**Why human:** Requires true first-run state (clean storage). Visual centering and card presentation require visual confirmation.

#### 4. Settings Storage Tab — FSA Mode

**Test:** Open Settings in Chrome/Edge (FSA mode active). Click the "Storage" sub-tab.
**Expected:** "File storage (File System Access API)" label visible. "Change folder" button present. Clicking it opens the OS directory picker. Cancelling does not crash or navigate away.
**Why human:** Requires real browser FSA session to test directory picker interaction and AbortError handling.

#### 5. Settings Storage Tab — IDB Mode

**Test:** Open Settings in Firefox or Safari. Click the "Storage" sub-tab.
**Expected:** "Browser storage (IndexedDB)" label visible with explanation that data is browser-local and Chrome/Edge required for file storage. No "Change folder" button shown.
**Why human:** Requires Firefox/Safari to place app in IDB-only mode (fsaDriver === null).

---

### Re-Verification Summary

**Previous verification** (2026-02-28T17:40:00Z) covered plans 01 and 02 only — it predated plan 03 execution. Plan 03 was created after UAT revealed two gaps: (1) no in-app way to change the data folder, and (2) storage mode was invisible from the UI.

**This re-verification** confirms:
- All 17 truths from the initial verification remain intact (no regressions)
- 3 new truths added for plan 03 — all 3 verified
- StorageSection.tsx and SettingsPage.tsx updates are substantive, correctly wired, and free of anti-patterns
- Build and test suite continue to pass (114/114 tests)

All 20 observable truths verified. Phase goal fully achieved.

---

_Verified: 2026-02-28T18:15:00Z_
_Verifier: Claude (gsd-verifier)_
