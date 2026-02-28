# Phase 7: Hardening - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden three specific edge cases in storage and first-run UX: (1) FSA permission revoked mid-session — app surfaces re-prompt dialog instead of silently failing; (2) Firefox/Safari IDB-only mode — app shows explicit persistent notice instead of burying it in header text; (3) first-run onboarding — new users see a proper welcome card guiding them to set up storage before any allocation work begins. No new features, no new domain logic, no changes to the allocation engine or settings. Pure UX hardening of the storage layer boundary.

</domain>

<decisions>
## Implementation Decisions

### FSA permission-loss mid-session (INFRA-04)
- When `storage.write()` throws `NotAllowedError` (FSA permission revoked in background tab), stores catch the error and signal it upward
- Signal mechanism: a lightweight React context `StorageErrorContext` with a single `reportPermissionLost()` function — no new Zustand store
- `StorageErrorContext.Provider` wraps the app in `main.tsx`; each store's write path wraps `await storage.write(...)` in try/catch and calls `reportPermissionLost()` if `e instanceof DOMException && e.name === 'NotAllowedError'`
- `App.tsx` consumes `useStorageError()` and renders a blocking full-screen overlay modal when `permissionLost === true`:
  - Title: "Storage access lost"
  - Body: "Money Flow lost access to your data folder (e.g. the tab was backgrounded). Click below to re-grant access."
  - Single button: "Re-grant access" — calls `fsaDriver.requestPermission()` then `window.location.reload()`
  - Overlay cannot be dismissed — forces resolution before any further writes
- The modal renders above all content via `fixed inset-0 z-50` — no shadcn Dialog dependency, raw Tailwind

### Firefox/Safari IDB notice (INFRA-05)
- Current: tiny muted text "Browser storage (data is browser-local)" in the header — too easy to miss
- New: dismissible amber banner rendered below the header when `storageMode === 'idb'` AND `fsaDriver === null` (true Firefox/Safari — no FSA available at all; NOT just permission-not-yet-granted)
- Banner text: "Your data is stored in this browser only — it won't appear in other browsers or devices. Use Chrome or Edge to enable file storage."
- Dismiss button (×) stores `localStorage.setItem('idb_notice_dismissed', '1')` — banner stays hidden on subsequent loads
- The existing small header text (`storageMode === 'idb' ? 'Browser storage...' : 'File storage'`) is removed to avoid duplication
- Banner is NOT shown when `storageMode === 'idb'` but `fsaDriver !== null` (permission-pending case) — that's handled by the "Grant access" button

### First-run onboarding (INFRA-04 / UX)
- First-run detection: `needsFsaPrompt === true` (FSA available, no permission yet) AND `accounts.length === 0` (no data stored = truly first time)
- When first-run detected: hide tab content, show a centered onboarding card in `<main>`:
  - Heading: "Welcome to Money Flow"
  - Body: "Money Flow stores your data as JSON files in a folder you choose. This keeps everything private and portable."
  - Single button: "Choose data folder" — triggers the existing `handleGrantAccess()` flow
- After `handleGrantAccess()` succeeds → `window.location.reload()` already happens → normal app loads
- If user is on IDB (Firefox/Safari, `storageMode === 'idb'` + `fsaDriver === null`): no onboarding card (IDB initializes immediately, data just works) — the amber banner (above) handles the notice
- If `needsFsaPrompt === false` and `accounts.length === 0`: user chose a folder on a previous session but folder is empty (e.g. new folder) → skip onboarding, show normal app with empty state

### Removed: small "Grant access" banner above tabs
- The existing `{needsFsaPrompt && <div>Grant folder access...</div>}` banner is replaced by the onboarding card on first-run
- On returning visits where permission lapsed (needsFsaPrompt=true but accounts>0): show a simplified banner "Click to reconnect your data folder" with a "Reconnect" button — NOT the full onboarding card

### Claude's Discretion
- Exact Tailwind classes for the overlay modal and onboarding card
- Whether to add a small info icon to the IDB banner
- Animation on the overlay modal (recommend none — this is an error state, not decorative)

</decisions>

<specifics>
## Specific Ideas

- User authorized all decisions — these are Claude's choices based on the existing codebase patterns
- The overlay modal MUST be blocking (no dismiss without action) — silent data loss is a core concern per PROJECT.md
- Keep changes minimal: no new libraries, no new store files, no new routes — just App.tsx + store write paths + a new context file
- `FsaDriver.write()` already catches `NotAllowedError` and re-throws — stores just need to catch it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FsaDriver.write()` already re-throws `NotAllowedError` — just need stores to catch it
- `handleGrantAccess()` in `App.tsx` — reuse for the onboarding "Choose data folder" button
- `Button` from `@/components/ui/button` — onboarding card CTA
- `Card`, `CardContent` from `@/components/ui/card` — onboarding card container

### Established Patterns
- `AppProps.needsFsaPrompt: boolean` and `AppProps.storageMode: 'fsa' | 'idb'` already passed to App
- `useAccountStore(s => s.accounts)` — read to check first-run
- `fsaDriver` exported from `@/lib/storage/storage` — available for re-grant call
- localStorage direct access pattern already used in CsvAiSection for API key

### Integration Points
- `src/main.tsx`: wrap App with `StorageErrorContext.Provider`
- `src/lib/storage/StorageErrorContext.tsx`: new context file (only new file)
- `src/stores/accountStore.ts`, `allocationStore.ts`, `settingsStore.ts`: add try/catch to write calls
- `src/App.tsx`: consume context for overlay; onboarding card in `<main>`; IDB banner; remove old needsFsaPrompt banner

### Key constraint
- `requestPermission()` MUST be called from a user gesture (click handler) — already enforced in existing `handleGrantAccess()`
- The overlay "Re-grant access" button is a click handler → safe to call `requestPermission()` directly

</code_context>

<deferred>
## Deferred Ideas

- Toast notifications when another tab updates data (BroadcastChannel) — v2 requirement NOTF-01
- IDB data export/import for Firefox users — v2 EXPORT-02
- Animated transitions on the onboarding screen — polish, not hardening

</deferred>

---

*Phase: 07-hardening*
*Context gathered: 2026-02-28*
