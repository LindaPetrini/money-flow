# Feature Research

**Domain:** Freelance personal finance / budget allocation (envelope-style, invoice-triggered)
**Researched:** 2026-02-27
**Confidence:** MEDIUM — core envelope budgeting features based on well-established market (HIGH); invoice-triggered workflow and Stabilize/Distribute auto-detection are novel patterns with no direct competitors found (LOW confidence on competitive analysis for these specific features)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Envelope / bucket budgeting | All major competitors (YNAB, Goodbudget, Actual Budget) use this mental model; it is the standard UI metaphor for allocation-first finance | LOW | Named buckets with amounts, priorities, destination accounts |
| Account balance display | Users need to see where money sits; every dashboard-style finance app shows this | LOW | Read balances from state; inline editable |
| Manual balance editing | No bank sync = users must update balances themselves; expected when sync is absent | LOW | Inline editing with atomic save; integer cents |
| Allocation confirmation ("Done" button) | Users need to commit a set of moves and know the state is saved; missing this = data anxiety | LOW | Atomic: mark moves done, update all account balances, append to history log |
| History log of past allocations | Standard in YNAB and every audit-trail-aware tool; users expect to look back | MEDIUM | Append-only log: date, invoice, mode, each move + reason |
| Budget bucket configuration | Users expect to customize categories; all competitors provide this | MEDIUM | Name, amount or %, destination account, priority order, expiry dates |
| Overflow / surplus distribution ratios | Envelope tools that only support fixed floors feel rigid; split rules are expected for the "extra money" scenario | MEDIUM | Percentage splits that sum to 100%; validation required |
| Tax withholding bucket | Freelancers universally need to set aside income tax; any freelance-oriented tool that lacks this is immediately rejected | LOW | % of invoice, sent to dedicated account; not touched until tax time |
| Monthly reset / period management | Envelope tools operate on periods; users expect a way to start a new cycle without losing history | LOW | "New Month" clears floor-item coverage flags, preserves balances and history |
| Per-move calculation display | Users need to know how an amount was computed; opaque black-box allocation instructions are not trusted | MEDIUM | Show rule applied + arithmetic for each move (e.g. "37% of €2,000 = €740 → Isybank") |
| Visual status indicators for accounts | Standard in any finance dashboard; users expect at-a-glance health signals | LOW | At/near/below target color coding |

---

### Differentiators (Competitive Advantage)

Features that set this product apart. Not universally expected, but high-value for the target user.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Invoice-triggered allocation workflow | No competitor starts from "an invoice just landed — what do I do with it?" YNAB starts from monthly budget, Goodbudget from envelopes, not from the income event itself | MEDIUM | Entry point is invoice amount + currency; all downstream logic flows from this event |
| Auto-detected Stabilize vs. Distribute mode | Removes decision fatigue entirely; the app always does the right thing based on current state | HIGH | Requires: floor items, their coverage state, buffer account balance; mode is derived, never toggled; this is the core differentiator |
| Stabilize mode: priority-ordered floor coverage | When income is tight, the app tells you what to fill first — removing the cognitively expensive "which bill do I prioritize?" question | MEDIUM | Walk floor items in priority order until invoice is exhausted; show remaining uncovered |
| Distribute mode: surplus split instructions | When floors are covered, the app computes exact amounts per overflow bucket — no arithmetic required | MEDIUM | Apply ratios to surplus; show exact cent amounts per destination |
| Wise buffer target for landing account | Freelancers using multi-currency accounts (e.g. Wise) need a buffer to absorb exchange-rate delays; this is a concrete workflow detail no generic app supports | MEDIUM | Buffer target on income landing account; Stabilize mode checks buffer before overflow |
| AI-assisted bucket sizing from CSV history | Removes the hardest question in setup: "how much should I budget for X?"; suggestions grounded in the user's own data, not generic rules | HIGH | CSV upload → AI categorizes into everyday/fun/one-off/recurring; suggests amounts from 6-month average; user can accept/adjust/ignore |
| Full reasoning transparency per AI suggestion | AI suggestions shown with detected pattern and confidence, not just a number; addresses the trust problem endemic to black-box AI in finance | MEDIUM | "We detected avg €380/month on dining + entertainment → suggesting €400 fun bucket" |
| Floor item expiry dates | Fixed expenses that end (e.g. a therapy course, a subscription trial) auto-deactivate; prevents stale floor items from distorting Stabilize mode | LOW | Date field on floor item; auto-deactivates when expired; shown differently in UI |
| Multi-currency invoice entry with manual EUR equivalent | Freelancers earning in USD, GBP, or other currencies need EUR for allocation; manual equivalent respects user control without exchange-rate API complexity | LOW | Invoice stores original currency + amount + EUR equivalent entered by user |
| Local-first with File System Access API | Privacy-first: no data leaves the browser; no account creation; survives browser clears; human-readable JSON | HIGH | File System Access API for persistence + IndexedDB fallback; requires Chrome/Edge; not available in Firefox or Safari for write operations |
| Open source / no proprietary dependencies | Users who care about privacy and longevity can inspect and fork; enables trust | LOW | No vendor-specific libraries; MIT-licensable stack |

---

### Anti-Features (Deliberately Not Building)

Features to explicitly avoid, despite being common in the space.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Bank API sync (Plaid, Teller, etc.) | Automatic balance updates remove manual work | Massive compliance surface (open banking regulations vary by country), privacy liability, fragile integrations that break when banks change APIs, credential handling risks, ongoing API costs; multiple major apps (Mint) shut down partly due to this complexity | Manual inline balance editing; user copies balance from their bank app in 30 seconds |
| Automatic exchange rates (OpenExchangeRates, etc.) | One less thing to look up | Introduces network dependency, API key management, rate-staleness edge cases, potential costs; the EUR equivalent is entered once at invoice time, not on an ongoing basis | Manual EUR equivalent field on invoice entry; user knows the rate from their bank |
| Spending category tracking (ongoing) | Full picture of where money goes | Scope creep: this product is about allocation decisions at income time, not ongoing expense tracking; adding transaction tracking doubles complexity with no marginal benefit for the core use case | CSV import covers historical analysis; category tracking is a separate product category |
| Forecasting and charts | Visual trends and projections look impressive | High implementation cost for features that don't serve the core use case (what to do when an invoice arrives); charts also require sufficient historical data to be meaningful | Allocation history log gives full audit trail; users can export to spreadsheet for charts |
| Mobile app (iOS/Android) | Finance is done on phones | React web app in localhost context cannot be easily ported to native; File System Access API is not available on mobile; the use case (receiving invoice, running allocation) is a desktop/laptop task with deliberate focus | Web app works on mobile browsers for reading; primary workflow is desktop |
| Multi-user / household sharing | Partners and business partners want to share | Complex auth, sync conflicts, permission models; the target user is a single freelancer; multi-user is a different product | Single-user, local-first; user can share JSON file manually |
| Dark mode | Universal user preference | Not zero-cost; Tailwind v4 + shadcn/ui can support it but requires design decisions on every component; deferred to avoid scope creep in v1 | Tailwind dark: classes can be added later without architectural changes |
| Undo/redo | Safety net for mistakes | Allocation confirmations are intentional, atomic transactions; undo creates state complexity inconsistent with local-first atomic writes; "Done" button is the commitment point | History log + manual balance editing covers correction scenarios |

---

## Feature Dependencies

```
Invoice Entry
    └──requires──> Account Configuration (destination accounts must exist)
    └──requires──> Floor Item Configuration (to compute Stabilize vs. Distribute)
    └──requires──> Tax Bucket Configuration (to compute tax withholding move)

Stabilize/Distribute Auto-Detection
    └──requires──> Floor Items with coverage state
    └──requires──> Wise buffer target on landing account
    └──requires──> Account balances (to compare against targets)

Allocation Confirmation ("Done")
    └──requires──> Invoice Entry + Move Instructions generated
    └──writes──> Account Balances (atomic update)
    └──writes──> Allocation History Log (append)

Monthly Reset
    └──requires──> Floor Items (coverage flags to clear)
    └──preserves──> Account Balances
    └──preserves──> Allocation History Log

AI CSV Analysis
    └──requires──> CSV upload (from user's bank)
    └──writes──> Suggested bucket amounts (user can accept/adjust/ignore)
    └──enhances──> Bucket Configuration (pre-populates values, does not override)

Floor Item Expiry
    └──enhances──> Stabilize Mode (expired items excluded from floor total)
    └──requires──> Floor Item Configuration

History Log
    └──requires──> Allocation Confirmation
    └──enhances──> Audit / accountability workflow

Visual Status Indicators
    └──requires──> Account Balances
    └──requires──> Account Target amounts
```

### Dependency Notes

- **Invoice Entry requires Account Configuration**: Until the user has defined at least one destination account, move instructions cannot be generated. Account setup is a hard prerequisite for the core workflow.
- **Stabilize/Distribute detection requires Floor Items + Buffer**: Mode logic reads floor item coverage flags and the Wise buffer balance. If no floor items are configured, Stabilize mode is vacuously satisfied — system falls through to Distribute.
- **AI CSV Analysis enhances but does not block Bucket Configuration**: User can configure buckets manually; AI suggestions are additive. This means the AI feature can be deferred to v1.x without blocking MVP.
- **Monthly Reset preserves History Log**: Reset is not a destructive operation on history; it only clears coverage flags. Misimplementing this as a data wipe would be a critical regression.
- **File System Access API is a dependency for the persistence layer, not a user-facing feature**: All features that write state depend on FSA being initialized. FSA prompt must succeed before first write. IndexedDB fallback may be used before FSA is granted.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the core premise: "invoice arrives, app tells you exactly where every euro goes."

- [ ] Account configuration (name, target balance, type: landing/spending/reserve/savings)
- [ ] Floor item configuration (name, amount, priority, optional expiry date)
- [ ] Tax bucket configuration (% of invoice, destination account)
- [ ] Overflow bucket ratios (% splits for surplus distribution)
- [ ] Invoice entry (amount, currency, EUR equivalent)
- [ ] Stabilize/Distribute auto-detection + move instruction generation
- [ ] Per-move calculation display (rule + arithmetic + reason, every move)
- [ ] Allocation confirmation ("Done") with atomic balance updates
- [ ] Allocation history log (date, invoice, mode, all moves)
- [ ] Account balance dashboard with visual status indicators
- [ ] Inline balance editing
- [ ] Monthly reset (clear coverage flags, preserve balances + history)
- [ ] Local persistence (File System Access API + IndexedDB)

### Add After Validation (v1.x)

Features to add once core workflow is confirmed working and used.

- [ ] AI CSV analysis + bucket size suggestions — trigger: user asks "how do I know what to budget for everyday spending?"
- [ ] Floor item expiry dates — trigger: user has a temporary expense they don't want to manually remove
- [ ] Multi-currency invoice entry UX polish — trigger: user finds EUR-equivalent field confusing
- [ ] Export allocation history to CSV — trigger: user wants to put data into a spreadsheet

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Recurring floor items that auto-reset monthly — why defer: monthly reset handles this adequately in v1; automation adds state complexity
- [ ] Budget target forecasting ("you will cover floors in X months at current income") — why defer: out of scope for invoice-moment use case; requires historical income data

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Invoice entry + move instructions | HIGH | MEDIUM | P1 |
| Stabilize/Distribute auto-detection | HIGH | HIGH | P1 |
| Per-move transparency (calculation + reason) | HIGH | MEDIUM | P1 |
| Account balance dashboard | HIGH | LOW | P1 |
| Floor item configuration | HIGH | MEDIUM | P1 |
| Tax bucket (% of invoice) | HIGH | LOW | P1 |
| Allocation confirmation + history log | HIGH | MEDIUM | P1 |
| Monthly reset | HIGH | LOW | P1 |
| Overflow bucket ratios | MEDIUM | MEDIUM | P1 |
| Visual status indicators | MEDIUM | LOW | P1 |
| Floor item expiry dates | MEDIUM | LOW | P2 |
| AI CSV analysis + bucket suggestions | HIGH | HIGH | P2 |
| AI suggestion transparency / reasoning display | MEDIUM | MEDIUM | P2 |
| Multi-currency polish | LOW | LOW | P2 |
| Export to CSV | LOW | LOW | P2 |
| Forecasting / charts | LOW | HIGH | P3 |
| Dark mode | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | YNAB | Copilot | Goodbudget | Actual Budget | Money Flow (our approach) |
|---------|------|---------|------------|---------------|--------------------------|
| Core mental model | Zero-based, give every dollar a job | AI-assisted categorization, adaptive budget | Digital envelope system | Local-first envelope budgeting | Invoice-triggered allocation — income event is the entry point |
| Irregular income support | Supported via "Ready to Assign" pool | Incidental; bank-sync focused | Manual; no specific freelance mode | Manual | First-class: Stabilize/Distribute modes designed for lumpy income |
| Tax reservation | Manual category creation | None built-in | Manual envelope | Manual | Built-in: % of each invoice, dedicated account |
| Allocation transparency | Moderate: shows budget vs. actual | Low: AI black-box | Low: envelope totals only | Moderate | High: every move shows exact calculation, rule, and reason |
| Bank sync | Yes (required) | Yes (required, iOS/macOS only) | Optional (premium) | Optional | No — deliberate anti-feature; manual balance edits |
| AI features | None | AI categorization, adaptive rebalancing | None | None | AI CSV analysis for bucket sizing; suggestions always shown with reasoning |
| CSV import | No | No | No | Yes (QIF/OFX/CSV) | Yes — for AI analysis of spending history, not ongoing tracking |
| Open source / local-first | No | No | No | Yes (MIT) | Yes — runs on localhost, no account required |
| Allocation history | Transaction history | Transaction history | None | Transaction history | Allocation-level log: invoice, mode, all moves per allocation event |
| Invoice-triggered workflow | No | No | No | No | Yes — unique to this product |
| Stabilize vs. Distribute auto-detection | No | No | No | No | Yes — unique to this product |

---

## Key Findings for Roadmap

1. **The core workflow (invoice -> move instructions) has no direct competitor.** All existing tools model income as "add to pool, then budget from pool." Money Flow models income as an event that triggers a decision tree. This is the differentiator worth building first and well.

2. **Table stakes are mostly low complexity.** Account dashboard, balance editing, history log, and monthly reset are all straightforward state management. These should be completed in early phases to give the app a usable shell.

3. **Stabilize/Distribute logic is the highest-complexity core feature.** It depends on multiple configured entities (accounts, floor items, buffer target, ratios) and must handle edge cases (invoice smaller than tax, invoice covers tax but not all floors, etc.). It warrants its own phase with detailed unit tests.

4. **AI CSV analysis is a P2 differentiator, not a P1 blocker.** The core value proposition works without it — users can configure buckets manually. AI analysis helps with onboarding friction but is not on the critical path.

5. **Anti-features are load-bearing decisions.** Excluding bank sync, exchange rates, and forecasting keeps the scope coherent and the privacy story clean. These decisions should be documented in the README so users understand they are intentional.

6. **Transparency is a first-class feature, not an afterthought.** Every competitor either hides the math (Copilot AI) or requires the user to do the math (YNAB). Showing the exact calculation for every move is a concrete differentiator and must be built into the move-generation logic from day one — retrofitting it later would require touching every allocation code path.

---

## Sources

- [YNAB Features — ynab.com/features](https://www.ynab.com/features) — official feature list (MEDIUM confidence: verified from official site)
- [YNAB Irregular Income Guide — ynab.com/guide/irregular-income](https://www.ynab.com/guide/irregular-income) — how YNAB handles freelancer income (MEDIUM confidence)
- [Copilot Money — copilot.money](https://www.copilot.money/) — official feature list (MEDIUM confidence)
- [Copilot Money Review 2026 — thecollegeinvestor.com](https://thecollegeinvestor.com/41976/copilot-review/) — feature details and pricing (MEDIUM confidence: third-party review, cross-referenced with official site)
- [Goodbudget 2025 Features Recap — goodbudget.com](https://goodbudget.com/blog/2025/11/2025-goodbudget-features-recap/) — official feature recap (HIGH confidence: official source)
- [Actual Budget — actualbudget.org](https://actualbudget.org/) — open-source envelope budgeting features (HIGH confidence: official source)
- [NerdWallet Best Budget Apps 2026 — nerdwallet.com](https://www.nerdwallet.com/finance/learn/best-budget-apps) — comparative analysis of table stakes across major apps (MEDIUM confidence)
- [Ramsey Budgeting Apps Comparison 2025 — ramseysolutions.com](https://www.ramseysolutions.com/budgeting/budgeting-apps-comparison) — EveryDollar vs. competitors (MEDIUM confidence)
- [Koody CSV Import — koody.com](https://koody.com/blog/personal-finance-app-csv-import) — AI categorization from CSV in personal finance apps (LOW confidence: single source)
- [Top 7 AI Tools for Expense Categorization 2025 — lucid.now](https://www.lucid.now/blog/top-7-ai-tools-for-expense-categorization-2025/) — AI categorization accuracy benchmarks (LOW confidence: marketing content)
- [Top 7 Budgeting Apps for Freelancers 2025 — freelancefin.com](https://freelancefin.com/best-budgeting-apps-freelancers-2025/) — freelancer-specific feature gaps (LOW confidence: editorial content)
- [Privacy concerns in personal finance apps — rollingout.com](https://rollingout.com/2025/09/17/finance-apps-expose-your-private-data/) — rationale for no bank sync (LOW confidence: journalism, but consistent with broader reporting)
- [Make.com YNAB + Invoice Ninja template](https://www.make.com/en/templates/4597-create-ynab-transactions-from-invoice-ninja-invoices) — evidence that invoice-triggered allocation requires external automation in YNAB; not built-in (MEDIUM confidence)

---

*Feature research for: Freelance personal finance / budget allocation app*
*Researched: 2026-02-27*
