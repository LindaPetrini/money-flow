---
phase: 01-foundation
plan: 02
type: tdd
wave: 2
depends_on: ["01-PLAN"]
files_modified:
  - src/lib/cents.ts
  - src/lib/cents.test.ts
autonomous: true
requirements:
  - INFRA-06

must_haves:
  truths:
    - "parseCents('19.99') returns exactly 1999 (integer) — no floating-point leakage"
    - "parseCents('1.01') returns exactly 101"
    - "splitCents with 3 equal-ratio buckets always sums to the input total exactly (largest-remainder guarantee)"
    - "formatCents(199900 as Cents) returns a human-readable EUR string"
    - "pctOf(200000 as Cents, 37) returns exactly 74000 (floor, no floats)"
    - "No code outside src/lib/cents.ts performs * 100 or / 100 money arithmetic"
  artifacts:
    - path: "src/lib/cents.ts"
      provides: "parseCents, formatCents, pctOf, addCents, subCents, splitCents — all type-safe"
      exports: ["Cents", "parseCents", "formatCents", "pctOf", "addCents", "subCents", "splitCents"]
    - path: "src/lib/cents.test.ts"
      provides: "Vitest unit tests proving no floating-point leakage and largest-remainder correctness"
      contains: "describe('parseCents'"
  key_links:
    - from: "src/lib/cents.test.ts"
      to: "src/lib/cents.ts"
      via: "import named functions"
      pattern: "import.*parseCents.*from.*./cents"
---

<objective>
Implement and TDD-verify the integer cents arithmetic library that all money math in the app must use.

Purpose: A single floating-point leak in parseCents or splitCents corrupts allocation totals silently. TDD with known-problematic values (19.99, 1.01, 99.99) proves correctness before any domain logic is built on top.
Output: src/lib/cents.ts with full test coverage; npm test passes.
</objective>

<execution_context>
@/root/.claude/get-shit-done/workflows/execute-plan.md
@/root/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/root/money-flow/.planning/phases/01-foundation/01-RESEARCH.md
@/root/money-flow/.planning/phases/01-foundation/01-01-SUMMARY.md
</context>

<feature>
  <name>Integer cents arithmetic library</name>
  <files>src/lib/cents.ts, src/lib/cents.test.ts</files>
  <behavior>
    Cents type: `type Cents = number & { readonly __brand: 'Cents' }` — branded to catch raw number leakage at compile time.

    parseCents(input: string) -> Cents:
    - '19.99' -> 1999 (not 1998.9999...)
    - '1.01' -> 101
    - '99.99' -> 9999
    - '2000' -> 200000 (whole numbers: multiply by 100)
    - '0' -> 0
    - '19.9' -> 1990 (single decimal place)
    - strips non-numeric-except-dot characters before parsing
    - uses Math.round(parseFloat(cleaned) * 100) — NEVER Math.floor or Math.ceil

    formatCents(cents: Cents, locale = 'de-DE') -> string:
    - 199900 as Cents -> '1.999,00 €' (de-DE locale, EUR currency)
    - 0 as Cents -> '0,00 €'
    - uses Intl.NumberFormat with style: 'currency', currency: 'EUR'

    pctOf(amount: Cents, pct: number) -> Cents:
    - pctOf(200000 as Cents, 37) -> 74000 (37% of €2000)
    - pctOf(100 as Cents, 33) -> 33 (floors: 33.33... -> 33)
    - uses Math.floor — conservative, remainder handled by caller

    addCents(...amounts: Cents[]) -> Cents:
    - addCents(100 as Cents, 200 as Cents, 300 as Cents) -> 600

    subCents(a: Cents, b: Cents) -> Cents:
    - subCents(1000 as Cents, 300 as Cents) -> 700

    splitCents(total: Cents, ratios: number[]) -> Cents[]:
    - LARGEST-REMAINDER ALGORITHM — bucket totals must always equal total exactly
    - splitCents(100 as Cents, [1, 1]) -> [50, 50]
    - splitCents(100 as Cents, [1, 1, 1]) -> array that sums to 100 (e.g. [34, 33, 33])
    - splitCents(1000 as Cents, [33, 33, 34]) -> array summing to 1000
    - splitCents(200000 as Cents, [37, 35, 15, 13]) -> array summing to 200000
    - splitCents(100 as Cents, []) -> []
    - splitCents(100 as Cents, [0, 0]) -> [0, 0] (all-zero ratios)
    - Uneven ratios: the cents that can't divide evenly go to the buckets with the largest remainders
  </behavior>
  <implementation>
    RED phase: Write src/lib/cents.test.ts first with all describe/it blocks above. Run `npm test` — all tests MUST fail (functions don't exist yet). Commit as: `test(01-02): add failing cents unit tests`

    GREEN phase: Write src/lib/cents.ts implementing all functions exactly as specified. Run `npm test` — all tests MUST pass. Commit as: `feat(01-02): implement integer cents library`

    REFACTOR phase (only if needed): Clean up without changing behavior. Run `npm test` — must still pass.

    Implementation notes for GREEN phase:
    - parseCents: `const cleaned = input.replace(/[^0-9.]/g, ''); return Math.round(parseFloat(cleaned) * 100) as Cents;`
    - splitCents largest-remainder:
      1. Compute `floats[i] = (ratios[i] / sum) * total` for each bucket
      2. Floor all floats: `floored[i] = Math.floor(floats[i])`
      3. Compute `remainder = total - floored.reduce((a,b) => a+b, 0)`
      4. Sort indices by descending fractional remainder: `floats[i] - floored[i]`
      5. Add 1 to the top `remainder` indices
      6. Return as Cents[]
    - All return values must use `as Cents` cast
    - No `* 100` or `/ 100` operations should appear anywhere else in the codebase
  </implementation>
</feature>

<verification>
```
cd /root/money-flow && npm test 2>&1
```
Expected: All tests in cents.test.ts pass. No floating-point leakage. `npm test` exits 0.
</verification>

<success_criteria>
1. `npm test` exits 0 with all cents tests passing
2. `parseCents('19.99') === 1999` proven by test
3. `splitCents(100 as Cents, [1,1,1]).reduce((a,b)=>a+b,0) === 100` proven by test
4. `pctOf(200000 as Cents, 37) === 74000` proven by test
5. No floating-point literals appear in src/lib/cents.ts implementation (only integers)
</success_criteria>

<output>
After completion, create `/root/money-flow/.planning/phases/01-foundation/01-02-SUMMARY.md` with:
- Test results (pass/fail counts)
- Any edge cases discovered beyond the plan's behavior spec
- Confirmation that no * 100 / / 100 exists outside cents.ts
</output>
