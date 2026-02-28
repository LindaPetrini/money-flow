# Phase 2: Allocation Engine - Research

**Researched:** 2026-02-28
**Domain:** Pure TypeScript financial allocation logic — Stabilize/Distribute engine
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ALLOC-01 | App auto-detects Stabilize vs Distribute mode — no manual toggle; detection based on floor coverage state and buffer balance | Mode detection is a pure derived computation: compare `bufferBalance` to `bufferTargetCents` and check `coveredThisMonth` flags on active floor items. Both data sources exist in `domain.ts` types. |
| ALLOC-02 | Stabilize mode: generates ordered move instructions to cover uncovered floor items in priority order until all floor items funded or invoice exhausted | Floor items have `priority: number` (lower = higher priority). Sorted ascending, process greedily until `remaining = 0`. Each move produces an `AllocationMove` with `rule: "floor"`. |
| ALLOC-03 | Distribute mode: generates surplus split instructions by user-defined overflow ratios across configured accounts | `OverflowRatio[]` from `Settings` provides `accountId` + `pct`. Use `splitCents(remaining, ratios.map(r => r.pct))` from existing `lib/cents.ts`. |
| ALLOC-04 | Tax allocation: fixed percentage of invoice total (default 37%, user-configurable) goes to tax account first, before any floor or distribute logic | `pctOf(invoiceAmountCents, settings.taxPct)` using existing `pctOf` from `lib/cents.ts`. Tax move always first. Remainder = `invoiceAmountCents - taxAmount`. |
| ALLOC-05 | Every generated move shows exact calculation, rule applied, and reason (e.g. "37% of €2,000 = €740 → Isybank (tax rule)") | `AllocationMove` type already has `calculation: string`, `rule: string`, `reason: string` fields. Engine must populate all three on every move. |
| ALLOC-06 | Allocation engine is pure TypeScript with zero React imports — fully unit-testable without a browser | Engine lives in `src/domain/`. No React imports. No `window` or `document` globals. Vitest already configured with `environment: 'jsdom'` but engine should pass even with `environment: 'node'`. |
</phase_requirements>

---

## Summary

Phase 2 implements the core financial decision logic of the Money Flow app as pure TypeScript functions with zero React dependencies. The allocation algorithm is a three-step pipeline: (1) extract tax first, (2) if Stabilize mode, greedily cover uncovered floor items by priority, (3) if Distribute mode, split the surplus across overflow ratios using the largest-remainder algorithm already implemented in `lib/cents.ts`. Mode detection is a derived boolean computation based on buffer balance vs. target and floor item coverage flags — there is no user toggle and no mutable mode state.

The entire engine is designed for Node-environment testability. All inputs arrive as function parameters (integer `Cents`, typed domain objects from `src/types/domain.ts`). All outputs are `AllocationMove[]` arrays with fully populated `calculation`, `rule`, and `reason` strings. The engine never reads from Zustand stores or calls any browser API. Stores call the engine, not the reverse.

Phase 1 has already provided all the foundational pieces the engine depends on: the `Cents` branded type, `parseCents`/`formatCents`/`pctOf`/`addCents`/`subCents`/`splitCents` arithmetic, and the `Account`, `Settings`, `FloorItem`, `OverflowRatio`, and `AllocationMove` domain types. No new dependencies need to be installed for Phase 2 — this is pure TypeScript business logic using what already exists.

**Primary recommendation:** Implement the engine as three co-located files in `src/domain/` — `modeDetection.ts`, `floorCalculator.ts`, and `allocationEngine.ts` — each a set of pure exported functions. Test with Vitest covering the six documented edge cases. The planner should structure tasks as: mode detection first, then tax extraction, then stabilize branch, then distribute branch, then transparency strings, then full integration tests.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript 5.7+ | Already installed (Phase 1) | Type safety for Cents branded type, domain interfaces | Strict mode enforces `Cents` vs `number` distinction at compile time |
| Vitest 3 (via vitest.config.ts) | Already installed (Phase 1) | Unit test runner | Vite-native, Node-compatible, Jest API — runs engine tests without a browser |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/cents.ts` (project file) | Phase 1 artifact | All money arithmetic | Import `pctOf`, `subCents`, `addCents`, `splitCents` — never roll arithmetic manually |
| `src/types/domain.ts` (project file) | Phase 1 artifact | `Account`, `Settings`, `FloorItem`, `OverflowRatio`, `AllocationMove` types | Engine function signatures use these exclusively |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom pure TS | Dinero.js | Dinero adds currency abstraction we don't need; our cents layer already handles the math correctly and is proven by 25 passing tests |
| Hand-rolled split | `splitCents` from `lib/cents.ts` | `splitCents` implements largest-remainder correctly; hand-rolling distribution is where off-by-one cents errors happen |

**Installation:**
```bash
# No new packages required. All dependencies exist from Phase 1.
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── domain/
│   ├── modeDetection.ts      # detectMode() — pure, no side effects
│   ├── floorCalculator.ts    # computeUncoveredFloor(), sortedActiveFloors()
│   └── allocationEngine.ts   # computeAllocation(), stabilize(), distribute()
├── domain/
│   ├── modeDetection.test.ts
│   ├── floorCalculator.test.ts
│   └── allocationEngine.test.ts
```

Note: test files co-located alongside domain files OR in `src/__tests__/domain/` — either works with the existing vitest config. Co-location is preferred for this project (see ARCHITECTURE.md).

### Pattern 1: Three-Stage Allocation Pipeline

**What:** Every invoice runs through exactly three stages in sequence. Each stage reduces `remaining` cents and appends moves. The pipeline is deterministic and side-effect-free.

**When to use:** Always. The three-stage order is a hard business rule: tax before floor, floor before distribute.

**Stages:**
1. **Tax extraction** — `pctOf(invoiceEurCents, settings.taxPct)` → move to `settings.taxAccountId`
2. **Mode detection** — compare buffer balance to target + check floor coverage flags
3. **Stabilize or Distribute** — branch based on mode, consume `remaining` cents

**Example:**
```typescript
// src/domain/allocationEngine.ts
import { pctOf, subCents, addCents, splitCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';
import type { Account, Settings, AllocationMove } from '@/types/domain';
import { detectMode } from './modeDetection';

export interface AllocationResult {
  mode: 'stabilize' | 'distribute';
  moves: AllocationMove[];
}

export function computeAllocation(
  invoiceEurCents: Cents,
  accounts: Account[],
  settings: Settings,
): AllocationResult {
  const moves: AllocationMove[] = [];

  // Stage 1: Tax first
  const taxAmount = pctOf(invoiceEurCents, settings.taxPct);
  const taxAccount = accounts.find(a => a.id === settings.taxAccountId);
  moves.push({
    destinationAccountId: settings.taxAccountId,
    amountCents: taxAmount,
    rule: 'tax',
    calculation: `${settings.taxPct}% of ${formatCents(invoiceEurCents)} = ${formatCents(taxAmount)}`,
    reason: `Tax withholding (${settings.taxPct}% rule)`,
  });
  let remaining = subCents(invoiceEurCents, taxAmount);

  // Stage 2: Mode detection
  const bufferAccount = accounts.find(a => a.id === settings.bufferAccountId);
  const mode = detectMode(bufferAccount, settings);

  // Stage 3: Branch
  const stageMoves = mode === 'stabilize'
    ? stabilize(remaining, accounts, settings)
    : distribute(remaining, accounts, settings);

  return { mode, moves: [...moves, ...stageMoves] };
}
```

### Pattern 2: Mode Detection as Pure Derived Computation

**What:** `detectMode` accepts the buffer account and settings, returns `'stabilize' | 'distribute'`. No mutable state. No side effects. The result changes automatically when the underlying data changes.

**Stabilize condition:** `bufferBalance < bufferTargetCents` OR any active, unexpired floor item has `coveredThisMonth === false`.

**Distribute condition:** buffer is funded AND all active floor items are covered.

**Example:**
```typescript
// src/domain/modeDetection.ts
import type { Account, Settings, FloorItem } from '@/types/domain';

export function detectMode(
  bufferAccount: Account | undefined,
  settings: Settings,
): 'stabilize' | 'distribute' {
  // Buffer unfunded → Stabilize
  if (!bufferAccount || bufferAccount.balanceCents < settings.bufferTargetCents) {
    return 'stabilize';
  }
  // Any active uncovered floor → Stabilize
  const today = new Date().toISOString().slice(0, 10);
  const hasUncovered = settings.floorItems.some(
    f => f.active && !f.coveredThisMonth && (!f.expiryDate || f.expiryDate >= today),
  );
  return hasUncovered ? 'stabilize' : 'distribute';
}
```

**Note on expiry date handling:** Floor items with `expiryDate < today` are treated as inactive for mode detection. The `active` flag is the primary gate; `expiryDate` is a secondary auto-deactivation trigger. Both must be checked. The engine should be pure — pass `today` as a string parameter in tests to avoid non-determinism.

### Pattern 3: Stabilize Mode — Priority-Ordered Greedy Fill

**What:** Sort active uncovered floor items by `priority` ascending (lower number = higher priority). Walk the sorted list, allocate `Math.min(remaining, floorItem.amountCents)` to each, subtract from `remaining`. Stop when `remaining === 0` or list exhausted.

**When to use:** When `detectMode` returns `'stabilize'`.

**Key insight:** A floor item may be partially funded if the invoice doesn't cover it fully. In that case, the move amount is `remaining` (not `floorItem.amountCents`). The item is NOT marked covered — that only happens when the full amount is delivered. The engine generates the move with the actual amount transferred.

**Example:**
```typescript
// src/domain/allocationEngine.ts
import { sortedActiveUncoveredFloors } from './floorCalculator';

function stabilize(
  remaining: Cents,
  accounts: Account[],
  settings: Settings,
  today: string = new Date().toISOString().slice(0, 10),
): AllocationMove[] {
  const moves: AllocationMove[] = [];
  const floors = sortedActiveUncoveredFloors(settings.floorItems, today);

  for (const floor of floors) {
    if (remaining <= 0) break;
    const allocation = Math.min(remaining, floor.amountCents) as Cents;
    moves.push({
      destinationAccountId: floor.destinationAccountId,
      amountCents: allocation,
      rule: 'floor',
      calculation: `Floor item "${floor.name}": ${formatCents(allocation as Cents)} of ${formatCents(floor.amountCents as Cents)}`,
      reason: `Priority ${floor.priority} floor item — ${allocation < floor.amountCents ? 'partial (invoice exhausted)' : 'fully funded'}`,
    });
    remaining = subCents(remaining, allocation);
  }
  return moves;
}
```

### Pattern 4: Distribute Mode — Exact-Sum Split

**What:** When all floors are covered and buffer is funded, the remaining post-tax amount is split across overflow ratio accounts using `splitCents`. The ratios come from `settings.overflowRatios`. `splitCents` guarantees the split sums exactly to `remaining` — no cent left over or double-counted.

**When to use:** When `detectMode` returns `'distribute'`.

**Example:**
```typescript
function distribute(
  remaining: Cents,
  accounts: Account[],
  settings: Settings,
): AllocationMove[] {
  const { overflowRatios } = settings;
  if (overflowRatios.length === 0) return [];

  const ratioWeights = overflowRatios.map(r => r.pct);
  const splits = splitCents(remaining, ratioWeights);

  return overflowRatios.map((ratio, i) => ({
    destinationAccountId: ratio.accountId,
    amountCents: splits[i],
    rule: 'distribute',
    calculation: `${ratio.pct}% of ${formatCents(remaining)} = ${formatCents(splits[i] as Cents)}`,
    reason: `Surplus distribution (${ratio.pct}% overflow ratio)`,
  }));
}
```

### Pattern 5: Floor Calculator as Separate File

**What:** Extract floor item querying and sorting into `floorCalculator.ts`. This keeps `allocationEngine.ts` from mixing data querying with allocation logic.

**Functions to expose:**
- `sortedActiveUncoveredFloors(floorItems: FloorItem[], today: string): FloorItem[]` — filters active, unexpired, uncovered items and sorts by `priority` ascending
- `totalUncoveredCents(floorItems: FloorItem[], today: string): Cents` — sum of `amountCents` for active uncovered floors (used for transparency reporting, not allocation)

**Example:**
```typescript
// src/domain/floorCalculator.ts
import type { FloorItem } from '@/types/domain';
import type { Cents } from '@/lib/cents';
import { addCents } from '@/lib/cents';

export function sortedActiveUncoveredFloors(
  floorItems: FloorItem[],
  today: string,
): FloorItem[] {
  return floorItems
    .filter(f => f.active && !f.coveredThisMonth && (!f.expiryDate || f.expiryDate >= today))
    .sort((a, b) => a.priority - b.priority);
}

export function totalUncoveredCents(floorItems: FloorItem[], today: string): Cents {
  return sortedActiveUncoveredFloors(floorItems, today)
    .reduce((sum, f) => addCents(sum, f.amountCents as Cents), 0 as Cents);
}
```

### Pattern 6: Transparency Strings — Exact Calculation Per Move

**What:** Every `AllocationMove` must have a human-readable `calculation` string that includes the arithmetic and a `reason` string that explains the rule. These are produced by the engine, not the UI.

**Format conventions (from ALLOC-05 example):**
- Tax: `"37% of €2,000 = €740"` + reason: `"Tax withholding (37% rule)"`
- Floor: `"Floor item \"Rent\": €1,200 / €1,200 (fully funded)"` + reason: `"Priority 1 floor item"`
- Distribute: `"35% of €800 = €280"` + reason: `"Surplus distribution (35% overflow ratio)"`

**Implementation note:** `formatCents` from `lib/cents.ts` formats as `de-DE` locale by default (e.g. `"2.000,00 €"`). Since the example in ALLOC-05 uses `€2,000`, there's a locale question. Use `formatCents` consistently throughout the engine — the UI can choose the display format. The `calculation` string is the source of truth from the engine.

### Pattern 7: Injecting `today` for Testability

**What:** Pass the current date as a string parameter (defaulting to `new Date().toISOString().slice(0, 10)`) rather than reading `new Date()` inside the engine. This makes date-sensitive tests deterministic.

**Example:**
```typescript
export function computeAllocation(
  invoiceEurCents: Cents,
  accounts: Account[],
  settings: Settings,
  today: string = new Date().toISOString().slice(0, 10),
): AllocationResult { ... }
```

### Anti-Patterns to Avoid

- **Importing from Zustand stores inside domain files:** The engine must not import `useAccountStore`, `useSettingsStore`, or any store. Stores call the engine; the engine never calls stores. Violation breaks Node testability.
- **Using `window`, `document`, or `localStorage` inside domain files:** These globals don't exist in Vitest node environment. The engine is pure data-in, data-out.
- **Calling `new Date()` inside a non-injectable location:** Makes tests non-deterministic. Always accept `today: string` as a parameter with a safe default.
- **Marking floor items as covered inside the engine:** Coverage marking is a side effect — it belongs in `settingsStore` after confirmation, not in the engine computation. The engine only reads `coveredThisMonth`, never writes it.
- **Hand-rolling the distribute split:** Use `splitCents` from `lib/cents.ts`. Writing `Math.round(remaining * ratio.pct / 100)` per bucket will produce off-by-one-cent errors when fractions don't resolve cleanly (proven by Phase 1's `splitCents` tests).
- **Partial moves for distribute mode:** In distribute mode, all `overflowRatios` must receive their split simultaneously. Never early-exit the distribute loop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distribute split summing to exact total | Custom per-bucket rounding | `splitCents(remaining, ratioWeights)` from `lib/cents.ts` | Largest-remainder algorithm proven by 25 tests; hand-rolled rounding fails on odd cent counts (e.g., 3 equal buckets of €1) |
| Money arithmetic | Raw `* 100`, `/ 100`, `Math.round()` in domain files | `pctOf`, `addCents`, `subCents` from `lib/cents.ts` | Floating-point leakage risk; cents.ts is the only audited arithmetic boundary |
| Floor item sorting | Inline `.sort()` in allocationEngine.ts | `sortedActiveUncoveredFloors` from `floorCalculator.ts` | Expiry date logic + active flag + priority sorting in one place; easier to test in isolation |
| Test date injection | `jest.useFakeTimers()` / mocking `Date` | Pass `today: string` parameter | Simpler, no mocking required, engine stays pure |

**Key insight:** The only genuinely complex algorithmic piece — cent-perfect distribution — is already solved in Phase 1. Phase 2 is primarily about orchestration, ordering, and correct branching, not algorithmic novelty.

---

## Common Pitfalls

### Pitfall 1: Mode Detection Missing the Buffer Condition

**What goes wrong:** Checking only floor item coverage for mode detection, ignoring the buffer balance condition. The buffer account (`bufferAccountId` / `bufferTargetCents`) is a separate condition — even if all floors are covered, the system stays in Stabilize if the buffer is underfunded.

**Why it happens:** The floor coverage check is the more obvious condition; the buffer target is easy to miss.

**How to avoid:** `detectMode` must check TWO conditions with OR logic: `bufferUnfunded || anyFloorUncovered`. Both must be false to reach Distribute.

**Warning signs:** Tests pass where buffer is always funded but fail when buffer is below target with all floors covered.

### Pitfall 2: Floor Item Partial Coverage Semantics

**What goes wrong:** Assuming a floor item is "covered" when the engine allocates to it in Stabilize mode. Coverage marking is NOT the engine's responsibility.

**Why it happens:** It feels natural to mark items covered as you process them. But the engine produces instructions — the user may cancel the allocation before confirming ("Done"). Coverage must only update after confirmation.

**How to avoid:** Engine reads `coveredThisMonth` but never writes it. `settingsStore.markFloorCovered(id)` is called by the store's `confirmAllocation` action, not by the engine.

**Warning signs:** Tests that check `coveredThisMonth` after calling `computeAllocation` directly.

### Pitfall 3: Expired Floor Items Included in Processing

**What goes wrong:** Processing floor items where `expiryDate < today`, inflating the uncovered amount and generating incorrect moves.

**Why it happens:** The `active` flag is the documented gate, but `expiryDate` is an additional auto-deactivation trigger that runs in parallel.

**How to avoid:** Filter in `sortedActiveUncoveredFloors`: `f.active && !f.coveredThisMonth && (!f.expiryDate || f.expiryDate >= today)`.

**Warning signs:** End-of-month tests where some floor items have past expiry dates still show up in moves.

### Pitfall 4: Invoice Smaller Than Tax Amount

**What goes wrong:** `remaining` goes negative (or zero) after tax extraction, then the engine tries to allocate floor items with `remaining <= 0`, producing zero-amount moves or crashing.

**Why it happens:** Edge case — invoice is very small relative to the tax percentage.

**How to avoid:** After tax extraction, check `if (remaining <= 0) return earlyResult`. No floor or distribute moves are generated. This is a valid (if unusual) outcome.

**Warning signs:** Tests with small invoices (e.g., €5 invoice with 37% tax) producing unexpected moves.

### Pitfall 5: Distribute Mode With Empty Overflow Ratios

**What goes wrong:** `overflowRatios` is an empty array (e.g., first run before user configures them). `splitCents(remaining, [])` returns `[]` correctly, but the `remaining` cent is then unaccounted for.

**Why it happens:** Configuration is incomplete — user hasn't set up overflow ratios yet.

**How to avoid:** Return a single "unallocated surplus" move or a clear error result when `overflowRatios.length === 0`. Document the behavior — do NOT silently drop the remaining amount.

**Warning signs:** Distribute mode producing a `moves` array that doesn't sum to the invoice amount.

### Pitfall 6: pctOf Floors Down, Creating Residual Cents

**What goes wrong:** `pctOf(invoiceEurCents, 37)` uses `Math.floor`, which means the tax move amount is slightly less than 37%. The residual (1-2 cents) stays in `remaining` and flows to floor/distribute. This is correct behavior, but it must be documented.

**Why it happens:** `pctOf` is intentionally conservative (floors, not rounds) to avoid over-allocating tax.

**How to avoid:** Accept this behavior — it is correct. Do NOT use `Math.round` for tax to try to fix it. The residual cent belongs in the next stage. Document in engine comments.

**Warning signs:** Tests that expect `taxAmount === invoiceAmount * 0.37` exactly (floating point) — use integer assertions only.

---

## Code Examples

Verified patterns from project source (Phase 1 artifacts):

### Cents Arithmetic Available

```typescript
// Source: /root/money-flow/src/lib/cents.ts
import { pctOf, subCents, addCents, splitCents, formatCents } from '@/lib/cents';
import type { Cents } from '@/lib/cents';

// Tax computation
const taxAmount = pctOf(200000 as Cents, 37); // => 74000 (Math.floor)
const remaining = subCents(200000 as Cents, taxAmount); // => 126000

// Distribute split (largest-remainder, always sums to total)
const splits = splitCents(126000 as Cents, [35, 15, 50]);
// splits.reduce((a,b) => a+b, 0) === 126000 guaranteed
```

### Domain Types Available

```typescript
// Source: /root/money-flow/src/types/domain.ts
interface AllocationMove {
  destinationAccountId: string;
  amountCents: number;        // integer cents
  rule: string;               // 'tax' | 'floor' | 'distribute'
  calculation: string;        // e.g. "37% of €2,000 = €740"
  reason: string;             // human-readable explanation
}

interface FloorItem {
  id: string;
  name: string;
  amountCents: number;        // monthly floor amount
  priority: number;           // lower = higher priority
  destinationAccountId: string;
  coveredThisMonth: boolean;
  expiryDate?: string;        // ISO date, undefined = no expiry
  active: boolean;
}

interface Settings {
  taxPct: number;             // default 37
  taxAccountId: string;
  bufferAccountId: string;
  bufferTargetCents: number;
  overflowRatios: OverflowRatio[];
  floorItems: FloorItem[];
}
```

### Vitest Test Structure (matching Phase 1 pattern)

```typescript
// Source: /root/money-flow/src/lib/cents.test.ts (pattern)
import { describe, it, expect } from 'vitest';
import { computeAllocation } from './allocationEngine';

describe('computeAllocation', () => {
  // Build minimal test fixtures inline — no browser globals needed
  const baseSettings: Settings = {
    taxPct: 37,
    taxAccountId: 'tax',
    bufferAccountId: 'buffer',
    bufferTargetCents: 500000,
    overflowRatios: [
      { accountId: 'savings', pct: 50 },
      { accountId: 'invest', pct: 50 },
    ],
    floorItems: [],
  };

  it('extracts tax first before any other allocation', () => {
    const accounts: Account[] = [
      { id: 'buffer', balanceCents: 600000, targetCents: 500000, role: 'income-hub', name: 'Buffer' },
      { id: 'tax', balanceCents: 0, targetCents: 0, role: 'tax', name: 'Tax' },
    ];
    const result = computeAllocation(200000 as Cents, accounts, baseSettings);
    expect(result.moves[0].rule).toBe('tax');
    expect(result.moves[0].amountCents).toBe(74000); // pctOf(200000, 37)
  });
});
```

### Critical Edge Cases to Cover in Tests

```
1. Invoice < tax threshold  → remaining = 0 after tax, no floor/distribute moves
2. Invoice covers tax + some (not all) floors → Stabilize, partial floor fill by priority
3. Invoice covers tax + all floors → Distribute (if buffer funded), splits sum exactly to remaining
4. Buffer unfunded, all floors covered → Stabilize (buffer condition overrides)
5. Empty overflowRatios in Distribute mode → handle gracefully, no silent cent loss
6. Expired floor item → excluded from Stabilize processing
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Floating-point money math | Integer cents + largest-remainder (`splitCents`) | Phase 1 | No rounding errors in allocation |
| Manual mode toggle | Auto-detected from account/floor state | Architecture decision | No user error possible; mode is derived truth |
| Inline allocation logic in React components | Pure `domain/allocationEngine.ts` | Architecture decision | Testable in Node without browser |

**Deprecated/outdated:**
- Dinero.js (popular library): Unnecessary — our `lib/cents.ts` is purpose-built, already tested, and lighter. Do not introduce it.

---

## Open Questions

1. **Buffer deficit handling in Stabilize mode**
   - What we know: Stabilize mode triggers when buffer is underfunded. The current floor item processing greedily fills floor items by priority.
   - What's unclear: Should the engine also generate a move to top up the buffer account before filling floor items? Or is buffer top-up a separate mechanism driven by the income-hub account role?
   - Recommendation: Treat buffer top-up as a future enhancement. For v1, Stabilize mode covers floor items only. The buffer balance is used for MODE DETECTION but does not itself generate an allocation move. Document this behavior explicitly in engine comments.

2. **AllocationMove `amountCents` type: `number` vs `Cents`**
   - What we know: `AllocationMove.amountCents` is typed as `number` in `domain.ts`, not `Cents`. The engine computes values as `Cents` branded type.
   - What's unclear: Should the domain type be updated to use `Cents`, or cast on assignment?
   - Recommendation: Use `amountCents: allocation as number` in the move object to satisfy the existing type. Do NOT change `domain.ts` in Phase 2 unless the planner explicitly includes a refactor task — changing shared types has downstream impact on stores.

3. **Invoice EUR cents vs. invoice amount input**
   - What we know: `AllocationRecord` has both `invoiceAmountCents` (original currency) and `invoiceEurEquivalentCents` (EUR). The engine should operate on EUR cents.
   - What's unclear: Which field does the engine receive? The function signature should document this.
   - Recommendation: Engine parameter should be named `invoiceEurCents: Cents` explicitly. The UI (Phase 3) is responsible for passing the EUR equivalent, not the original currency amount.

---

## Sources

### Primary (HIGH confidence)

- `/root/money-flow/src/lib/cents.ts` — actual Phase 1 implementation: `pctOf` uses `Math.floor`, `splitCents` uses largest-remainder algorithm; 25 tests passing
- `/root/money-flow/src/types/domain.ts` — actual type definitions: `AllocationMove` with `calculation`/`rule`/`reason` strings, `FloorItem` with `priority`/`coveredThisMonth`/`expiryDate`/`active`, `Settings` with `bufferAccountId`/`bufferTargetCents`/`overflowRatios`/`floorItems`
- `/root/money-flow/.planning/research/ARCHITECTURE.md` — `domain/allocationEngine.ts` design: pure functions, detectMode, stabilize, distribute signatures
- `/root/money-flow/.planning/REQUIREMENTS.md` — ALLOC-01 through ALLOC-06 requirement text
- `/root/money-flow/.planning/phases/01-foundation/01-VERIFICATION.md` — confirmed Phase 1 artifacts: 25 cents tests passing, all stores initialized

### Secondary (MEDIUM confidence)

- `/root/money-flow/.planning/research/SUMMARY.md` — architecture rationale, pitfall documentation
- `/root/money-flow/vitest.config.ts` — actual test runner config: `environment: 'jsdom'`, `globals: true`, `reporters: ['default']`

### Tertiary (LOW confidence)

- None. All findings are derived from project source files (Phase 1 artifacts) and project planning documents — all HIGH confidence.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new dependencies. All tools confirmed present from Phase 1 verification report.
- Architecture: HIGH — Engine structure specified in ARCHITECTURE.md, domain types from `domain.ts` are authoritative, arithmetic library from `cents.ts` is tested.
- Pitfalls: HIGH — Derived from direct analysis of the existing code, domain types, and Phase 1 decisions (all code is available, not hypothetical).

**Research date:** 2026-02-28
**Valid until:** Stable — no external dependencies. Re-research not required unless `domain.ts` or `cents.ts` are modified.
