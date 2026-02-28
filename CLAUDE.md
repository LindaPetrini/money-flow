# Money Flow — Autonomous Overnight Run

You are continuing a GSD project initialization and full build for the Money Flow app.
This session runs UNATTENDED. The user is asleep. Do not ask questions. Auto-approve everything.

## IMMEDIATE: What to do right now

Run the full GSD workflow in this order:

1. **Research** (Step 6 of /gsd:new-project) — spawn 4 parallel research agents
2. **Requirements** (Step 7) — define from PROJECT.md + research
3. **Roadmap** (Step 8) — spawn gsd-roadmapper
4. **For each phase in the roadmap:**
   - `/gsd:plan-phase N` (auto-approve plan, skip discussion)
   - `/gsd:execute-phase N` (auto-approve all waves)
5. Continue until ALL phases are complete and the app works

## Rules (CRITICAL)

- **YOLO mode**: never wait for user input, never pause for approval
- **Commit after every artifact**: use `node /root/.claude/get-shit-done/bin/gsd-tools.cjs commit "..." --files ...`
- **All work in `/root/money-flow/`** — cd there if not already
- **Continue past errors**: log the error, work around it, keep going
- **Test as you go**: after each phase, verify the app still builds (`npm run build`)
- **When in doubt**: make the reasonable choice and document why

## Project context

See `.planning/PROJECT.md` for the full spec. Summary:

**Money Flow** — Freelance budget allocator. When an invoice arrives, tells you exactly where every euro goes.

Key features:
- Invoice entry → precise move instructions per account/bucket
- Two auto-detected modes: Stabilize (fill floor items first) vs Distribute (split surplus)
- Configurable budget buckets (default: 35% tax + configurable everyday/fun/savings/investing)
- CSV expense import → AI analysis → suggested bucket splits with full transparency
- Account balance tracking (multiple accounts, inline editable)
- History log of all allocations
- Every decision shows its calculation and reason (transparency is a core requirement)
- Local-first browser app (File System Access API + IndexedDB)
- Open source (GitHub publishable)

**Tech stack** (already decided):
- Vite 7 + React 19 + TypeScript
- Tailwind v4 + shadcn/ui (New York variant)
- Zustand 5 (no persist middleware — FSA handles persistence)
- File System Access API + IndexedDB (idb)
- Vitest 4
- Integer cents throughout (parseCents for all money math)
- `npm start` to run locally

## What already exists

- `.planning/config.json` — YOLO mode, standard depth, balanced models, all agents enabled
- `.planning/PROJECT.md` — full project spec

## What you need to create

1. `.planning/research/STACK.md` + `FEATURES.md` + `ARCHITECTURE.md` + `PITFALLS.md` + `SUMMARY.md`
2. `.planning/REQUIREMENTS.md`
3. `.planning/ROADMAP.md` + `.planning/STATE.md`
4. The actual app code (all phases)

## Starting point for research

Work from `/root/money-flow/`. The GSD tools are at `/root/.claude/get-shit-done/bin/gsd-tools.cjs`.

For research agents, use:
```
node /root/.claude/get-shit-done/bin/gsd-tools.cjs init new-project
```
to get the model config, then spawn 4 parallel gsd-project-researcher agents per the new-project workflow.

## Done criteria

The session is complete when:
- All roadmap phases are executed and verified
- `npm run build` succeeds
- `npm test` passes (or test failures are documented with reasons)
- The app runs on `npm start` and shows the dashboard with accounts
- All commits are clean
