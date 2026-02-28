# Phase 8: Verify Core UI - Research

**Researched:** 2026-02-28
**Domain:** GSD verification workflow — formal requirement closure via VERIFICATION.md
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INVOICE-01 | User can enter invoice: amount, currency, EUR equivalent (manual entry) | InvoiceForm.tsx confirmed present with all 3 fields + parseCents validation |
| INVOICE-02 | After invoice entry, app displays complete move instructions (amounts, destinations, reasons) in one view | AllocationResult.tsx confirmed rendering full move list with calculation + reason per move |
| INVOICE-03 | "Done" button confirms all moves atomically — updates all account balances in one operation and logs allocation to history | handleDone() in InvoicePage.tsx: setAccounts→appendAllocation in sequence, single state transition |
| INVOICE-04 | No partial confirmation — all moves confirmed together or not at all | Mutually exclusive entry/result state machine; handleDone guard `if (state.phase !== 'result') return` |
| DASH-01 | User can view all account balances on one dashboard screen | Dashboard.tsx renders AccountCard for each account from useAccountStore |
| DASH-02 | User can edit any account balance inline (manual update) | AccountCard inline edit: click → input → Enter/blur saves via updateBalance() |
| DASH-03 | Visual indicator shows each account's status: at target / near target / below target | AccountCard.getStatus() with green/yellow/red dot; thresholds >=100%, >=80%, <80% |
| DASH-04 | Dashboard shows current mode (Stabilize/Distribute) with brief explanation of why | Dashboard calls detectMode() → passes to ModeBadge; ModeBadge renders label + one-line explanation |
</phase_requirements>

---

## Summary

Phase 8 is a **verification-only phase** — its entire deliverable is a single VERIFICATION.md file placed at `.planning/phases/03-core-ui/03-VERIFICATION.md`. No source code changes are required. The phase closes the gap identified in the v1.0 audit: Phase 3 (Core UI) was fully implemented but never formally verified. All 8 requirements (INVOICE-01/02/03/04 and DASH-01/02/03/04) have confirmed implementation in the codebase — the task is to inspect the code, run verification checks, and document that the implementation satisfies each requirement's acceptance criteria.

The v1.0 milestone audit (`.planning/v1.0-MILESTONE-AUDIT.md`) did the integration checking work already. It confirms every one of the 8 requirements is correctly wired in source code. INVOICE-01 through INVOICE-04 are implemented in `src/features/invoice/InvoiceForm.tsx`, `AllocationResult.tsx`, and `InvoicePage.tsx`. DASH-01 through DASH-04 are implemented in `src/features/dashboard/Dashboard.tsx`, `AccountCard.tsx`, and `ModeBadge.tsx`. The build passes (1878 modules, 0 TS errors) and all 114 tests pass. Phase 8 formalizes what the audit already confirmed.

The verification process involves: reading each requirement's acceptance criteria from REQUIREMENTS.md and the Phase 3 plans, inspecting the relevant source files to confirm the criteria are met, running `npm run build` and `npm test` to confirm no regressions, and writing VERIFICATION.md documenting the evidence for each requirement. Success is entirely documented — no implementation, no new tests, no code changes.

**Primary recommendation:** One plan, one task: inspect existing Phase 3 source files against each requirement's acceptance criteria, run build + tests, write VERIFICATION.md at `.planning/phases/03-core-ui/03-VERIFICATION.md`.

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GSD VERIFICATION.md format | Project standard | Formal evidence document | Same format as Phase 01, 02, 05, 06, 07 VERIFICATIONs |
| npm run build | vite 7 + tsc | Regression gate | Build passing = no TypeScript regressions |
| npm test | vitest 3 | Regression gate | 114 passing tests = no unit regressions |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| grep / code inspection | built-in | Evidence gathering | Verify each requirement has the specific code pattern it requires |

### Alternatives Considered

None — this is a documentation-only phase. No library choices to make.

**Installation:** None required.

---

## Architecture Patterns

### Verification Document Structure

The VERIFICATION.md for Phase 3 should follow the same pattern used by Phases 01, 02, 05, 06, 07. The canonical format is:

```
.planning/phases/03-core-ui/03-VERIFICATION.md
```

```yaml
---
phase: 03-core-ui
verified: YYYY-MM-DD
status: passed | partial | failed
requirements_checked: [INVOICE-01, INVOICE-02, INVOICE-03, INVOICE-04, DASH-01, DASH-02, DASH-03, DASH-04]
---
```

Body structure:
1. Summary of verification outcome
2. Per-requirement check table (req ID, status, evidence, file:line)
3. Build and test gate results
4. Any deviations or caveats

### Pattern 1: Requirement Evidence Table

**What:** For each requirement, provide: status (SATISFIED/PARTIAL/FAILED), the file and line that implements it, the specific behavior confirmed, and how it maps to the acceptance criteria.

**When to use:** Every requirement must have an evidence entry.

**Example (adapted from Phase 05 VERIFICATION style):**

```markdown
| Req | Status | Evidence | File |
|-----|--------|----------|------|
| INVOICE-01 | SATISFIED | InvoiceForm.tsx renders 3 inputs (amount, currency, eurEquivalent); parseCents called on submit | src/features/invoice/InvoiceForm.tsx:25-52 |
| DASH-03 | SATISFIED | getStatus() returns at-target/near-target/below-target; colored dot rendered per status | src/features/dashboard/AccountCard.tsx:10-21 |
```

### Evidence Mapping: Requirements to Code

This is fully determined by prior research — no code discovery required:

| Requirement | Primary File | Key Pattern | Evidence Location |
|-------------|-------------|-------------|-------------------|
| INVOICE-01 | src/features/invoice/InvoiceForm.tsx | 3 controlled inputs + parseCents on submit | Lines 14-52 |
| INVOICE-02 | src/features/invoice/AllocationResult.tsx | result.moves.map() with account name, amount, calculation, reason | Lines 18-92 |
| INVOICE-03 | src/features/invoice/InvoicePage.tsx | handleDone(): setAccounts + appendAllocation in sequence | Lines 57-108 |
| INVOICE-04 | src/features/invoice/InvoicePage.tsx | Mutually exclusive PageState (entry | result), guard at line 58 | Lines 12-21, 57-58 |
| DASH-01 | src/features/dashboard/Dashboard.tsx | accounts.map(account => AccountCard) | Lines 39-46 |
| DASH-02 | src/features/dashboard/AccountCard.tsx | startEditing/commitEdit/cancelEdit + onBalanceChange prop | Lines 35-58 |
| DASH-03 | src/features/dashboard/AccountCard.tsx | getStatus() function + STATUS_DOT_CLASSES with bg-green/yellow/red | Lines 8-21 |
| DASH-04 | src/features/dashboard/Dashboard.tsx + ModeBadge.tsx | detectMode() → mode prop → ModeBadge label + explanation | Dashboard:22-24, ModeBadge:1-29 |

### Anti-Patterns to Avoid

- **Marking SATISFIED without evidence:** Every SATISFIED status needs a file:line citation. The audit already identified the evidence — reference it.
- **Confusing the ALLOC-02 defect with INVOICE-03/04:** The floor item coverage defect (matching by destinationAccountId instead of floorItemId) is a bug in ALLOC-02 integration, not a failure of INVOICE-03 or INVOICE-04. INVOICE-03/04 concern atomic balance update + history append, which work correctly. The ALLOC-02 defect is tracked separately and fixed in Phase 10.
- **Creating new tests:** Phase 8 produces only documentation. Tests are regression-checked (run existing suite), not newly created.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verifying UI behavior | Custom browser automation | Code inspection + build/test gate | Phase is a documentation artifact, not an E2E test suite |
| Per-requirement proof | New test files | grep/Read of existing source files | Implementation already exists; evidence comes from reading code |

**Key insight:** This is a gap-closure documentation phase. All evidence exists in source files and SUMMARY.md files already written. The work is evidence gathering and document writing, not new implementation.

---

## Common Pitfalls

### Pitfall 1: Scope Creep into Code Changes

**What goes wrong:** Verifier discovers the ALLOC-02 integration defect (floor item marking by destinationAccountId) and changes InvoicePage.tsx to fix it as part of Phase 8.
**Why it happens:** The defect is visible in the files being inspected. It's tempting to fix it.
**How to avoid:** Phase 8 success criteria explicitly require "no regressions" — meaning no code changes that could introduce them. The ALLOC-02 fix is planned for Phase 10. Document the defect as a known issue in VERIFICATION.md but mark INVOICE-03/04 SATISFIED (the atomic confirmation itself works; the floor coverage matching is a separate issue tracked in Phase 10).
**Warning signs:** Any `git diff` showing changes to `.ts` or `.tsx` files.

### Pitfall 2: Failing INVOICE-03/04 Due to ALLOC-02 Defect

**What goes wrong:** The verifier treats the floor-item coverage defect as a failure of INVOICE-03 or INVOICE-04, marking those requirements PARTIAL or FAILED.
**Why it happens:** The defect is in `handleDone()`, the same function that implements INVOICE-03/04.
**How to avoid:** INVOICE-03 requires "updates all account balances in one operation and logs the allocation to history" — this works correctly. INVOICE-04 requires "no partial confirmation" — this also works correctly. The floor coverage sub-step has a logic error in which items get marked, but the atomicity of balance update + history append is not affected. Assess each requirement against its stated acceptance criteria.

### Pitfall 3: Writing VERIFICATION.md to Wrong Path

**What goes wrong:** VERIFICATION.md created at `.planning/phases/08-verify-core-ui/03-VERIFICATION.md` or `03-core-ui/08-VERIFICATION.md`.
**Why it happens:** Phase 8 is the executing phase, but the document lives in Phase 3's directory.
**How to avoid:** The VERIFICATION.md must be written to `.planning/phases/03-core-ui/03-VERIFICATION.md`. This is the path the roadmap and audit reference.

### Pitfall 4: Omitting the Build/Test Gate

**What goes wrong:** VERIFICATION.md written without running `npm run build` and `npm test` as part of the verification step.
**Why it happens:** Everything appears to work from code inspection alone.
**How to avoid:** The phase success criteria explicitly require "No regressions — npm run build and npm test still pass." Run both commands during the verification task and document the output in VERIFICATION.md.

---

## Code Examples

Verified patterns from source code inspection:

### Atomic Confirmation (INVOICE-03/04 evidence)

```typescript
// Source: src/features/invoice/InvoicePage.tsx lines 57-108
const handleDone = async () => {
  if (state.phase !== 'result') return;   // Guard: no-op unless in result phase

  // 1. Build updated accounts in one pass (no intermediate writes)
  const updatedAccounts = accounts.map(account => { ... });

  // 4. Commit everything — setAccounts writes to storage atomically
  await setAccounts(updatedAccounts);      // All balances in one write
  await appendAllocation(record);          // History in one append

  // 6. Return to entry state (no partial result possible)
  setState({ phase: 'entry' });
};
```

### Status Indicator Logic (DASH-03 evidence)

```typescript
// Source: src/features/dashboard/AccountCard.tsx lines 10-21
function getStatus(account: Account): Status {
  if (account.targetCents === 0) return 'at-target'; // no target = always "ok"
  if (account.balanceCents >= account.targetCents) return 'at-target';
  if (account.balanceCents >= account.targetCents * 0.8) return 'near-target';
  return 'below-target';
}

const STATUS_DOT_CLASSES: Record<Status, string> = {
  'at-target': 'bg-green-500',
  'near-target': 'bg-yellow-400',
  'below-target': 'bg-red-500',
};
```

### Mode Detection + Badge (DASH-04 evidence)

```typescript
// Source: src/features/dashboard/Dashboard.tsx lines 22-24
const bufferAccount = accounts.find(a => a.id === settings.bufferAccountId);
const mode = detectMode(bufferAccount, settings, today);
// ...
<ModeBadge mode={mode} />

// Source: src/features/dashboard/ModeBadge.tsx lines 7-18
const MODE_CONFIG = {
  stabilize: {
    label: 'Stabilize',
    explanation: 'Buffer or floor items need funding',
    variant: 'outline' as const,
  },
  distribute: {
    label: 'Distribute',
    explanation: 'All floors covered — splitting surplus',
    variant: 'default' as const,
  },
};
```

### Move List with Transparency (INVOICE-02 evidence)

```typescript
// Source: src/features/invoice/AllocationResult.tsx lines 53-73
{result.moves.map((move, index) => {
  const accountName = (accounts.find(a => a.id === move.destinationAccountId)?.name
    ?? move.destinationAccountId) || '(unallocated)';
  return (
    <Card key={index}>
      <CardContent>
        <span>{accountName}</span>
        <span>{formatCents(move.amountCents as Cents)}</span>
        <p>{move.calculation}</p>   {/* e.g. "37% of €2,000.00 = €740.00" */}
        <p>{move.reason}</p>        {/* muted reason string */}
      </CardContent>
    </Card>
  );
})}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase marked complete when SUMMARY.md exists | Phase verified when VERIFICATION.md exists confirming acceptance criteria | GSD workflow design | Provides formal closure record that audits can reference |
| Requirements marked [x] by executor | Requirements closed by verifier with evidence | v1.0 audit identified gap | Separates execution claims from verified outcomes |

**Context:** Phases 01, 02, 05, 06, 07 all have VERIFICATION.md files. Phase 03 (Core UI) and Phase 04 (Configuration) are the only phases missing them — this is the gap Phases 8 and 9 close.

---

## Open Questions

1. **ALLOC-02 Defect vs INVOICE-03/04 Satisfaction**
   - What we know: InvoicePage.handleDone() uses destinationAccountId to mark floor items covered (a logic defect for multi-floor-item-same-account edge case). The balance update + history append are atomic and correct.
   - What's unclear: Whether to mark INVOICE-03/04 as SATISFIED with a caveated note, or PARTIAL.
   - Recommendation: Mark INVOICE-03/04 as **SATISFIED** — their acceptance criteria (atomic balance update, no partial confirmation) are fully met. Document the ALLOC-02 defect as a separate known issue, noted in VERIFICATION.md under "Caveats", not as a failure of INVOICE-03/04. The defect affects ALLOC-02 (floor coverage accuracy), not INVOICE-03/04 (atomicity of confirmation).

2. **REQUIREMENTS.md Traceability Update**
   - What we know: REQUIREMENTS.md still shows INVOICE-01 through DASH-04 as "Pending" with Phase 8 assignment. After verification, they should be marked Complete.
   - What's unclear: Whether Phase 8 plan should update REQUIREMENTS.md or leave it for Phase 10 cleanup.
   - Recommendation: Update REQUIREMENTS.md traceability table as part of Phase 8 to mark all 8 requirements Complete — this is the natural outcome of formal verification.

---

## Sources

### Primary (HIGH confidence)

- Source code inspection: `src/features/invoice/InvoiceForm.tsx`, `AllocationResult.tsx`, `InvoicePage.tsx` — direct read of implementation
- Source code inspection: `src/features/dashboard/AccountCard.tsx`, `ModeBadge.tsx`, `Dashboard.tsx` — direct read of implementation
- `.planning/phases/03-core-ui/03-01-SUMMARY.md` through `03-04-SUMMARY.md` — confirmed execution and deviations
- `.planning/v1.0-MILESTONE-AUDIT.md` — integration checker findings for all 8 requirements
- `npm run build` output (run 2026-02-28): 0 errors, 1878 modules — current state confirmed
- `npm test` output (run 2026-02-28): 114/114 tests passing — current state confirmed

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — acceptance criteria for each requirement
- `.planning/ROADMAP.md` — Phase 8 success criteria definition

### Tertiary (LOW confidence)

None — all findings come from direct code inspection and official project documents.

---

## Metadata

**Confidence breakdown:**
- What needs to be built: HIGH — source files exist and are readable; evidence is concrete
- Verification process: HIGH — well-defined from GSD workflow and prior phase examples
- ALLOC-02 vs INVOICE-03/04 scoping: MEDIUM — a judgment call about whether a floor coverage defect affects atomicity acceptance criteria; recommendation is defensible but could be argued either way

**Research date:** 2026-02-28
**Valid until:** N/A — verification phases are point-in-time; document is consumed once by the planner
