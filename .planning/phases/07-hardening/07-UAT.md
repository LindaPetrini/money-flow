---
status: complete
phase: 07-hardening
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md]
started: 2026-02-28T00:00:00Z
updated: 2026-02-28T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. App loads normally
expected: Run `npm start`. The app opens in the browser with no errors. Main dashboard renders — accounts panel, allocation form, and navigation tabs are all visible.
result: pass

### 2. First-run onboarding card
expected: On a fresh browser profile (or after clearing site data / IndexedDB), open the app. Instead of the main dashboard, a card appears with the heading "Welcome to Money Flow", a brief explanation about JSON files and privacy, and a single "Choose data folder" button. No allocation UI is shown yet.
result: pass

### 3. IDB fallback notice banner (Firefox/Safari only)
expected: Open the app in Firefox or Safari (no File System Access API). An amber/yellow banner is visible below the header warning that "data is browser-local" (not in a file). The main app UI is still usable beneath it. Skip this test if you're only testing on Chrome/Edge.
result: issue
reported: "i don't see the banner"
severity: major
note: Unclear if tested on Firefox. If on Chrome+FSA the banner correctly won't show. Needs confirmation.

### 4. IDB banner dismissal persists
expected: (Requires test 3 to pass first — Firefox/Safari IDB banner visible.) Click the × dismiss button on the amber banner. The banner disappears. Reload the page — the banner is still gone (not re-shown). Skip if on Chrome/Edge.
result: skipped
reason: depends on test 3

### 5. Reconnect banner for returning users
expected: When FSA permission has lapsed (e.g. close and reopen the tab, or revoke permission in browser site settings while accounts exist), a banner appears saying something like "Click to reconnect your data folder" with a "Reconnect" button — NOT the full onboarding card. The main UI skeleton is visible behind it.
result: pass
note: Chrome auto-granted on reopen — no banner needed, straight to dashboard.

### 6. Permission-lost overlay
expected: (Advanced — simulate FSA permission loss mid-session.) Grant folder access, then revoke write permission for the site in browser settings while the app is still open. Make a change (e.g. edit a balance). A full-screen blocking overlay appears with title "Storage access lost", an explanation about the tab being backgrounded, and a single "Re-grant access" button. There is no way to dismiss it without clicking the button. Clicking "Re-grant access" triggers the browser permission prompt and reloads the app. Skip if hard to reproduce.
result: skipped
reason: hard to reproduce manually

## Summary

total: 6
passed: 3
issues: 1
pending: 0
skipped: 2

## Gaps

- truth: "On Firefox/Safari (no FSA), an amber banner warns the user that data is browser-local"
  status: failed
  reason: "User reported: i don't see the banner (browser used unconfirmed — may be Chrome)"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "User can change the data folder from within the app (e.g. via Settings)"
  status: failed
  reason: "User reported: i can't see anywhere where to change the folder"
  severity: major
  test: 0
  root_cause: "SettingsPage has no folder management UI. No in-app way to change or re-select the data folder once chosen."
  artifacts:
    - path: "src/features/settings/SettingsPage.tsx"
      issue: "Missing folder management section"
  missing:
    - "Add a 'Storage' section to SettingsPage with current folder name and a 'Change folder' button that calls fsaDriver.requestPermission() with showDirectoryPicker"
  debug_session: ""
