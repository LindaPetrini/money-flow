# PITFALLS: Money Flow — Local-First Browser Budget Allocator

**Research date:** 2026-02-27
**Domain:** Vite 7 + React 19 + TypeScript + Tailwind v4 + shadcn/ui New York + Zustand 5 + File System Access API + IndexedDB + CSV parsing + client-side AI

---

## Critical Pitfalls

### 1. FSA Handle Stored But Permission Revoked on Every Session Close

**Description:** `FileSystemDirectoryHandle` can be serialized to IndexedDB and retrieved across sessions — but the *permission* to use it is tab-lifetime only. Retrieving the handle from IDB does not mean you can read/write with it.

**Warning signs:**
- App silently fails to load saved data on second visit
- `handle.getFileHandle()` throws `NotAllowedError` without an obvious trigger

**Prevention:**
```typescript
const handle = await getHandleFromIDB();
const permission = await handle.queryPermission({ mode: 'readwrite' });
if (permission !== 'granted') {
  // Must be inside a user gesture (click handler)
  await handle.requestPermission({ mode: 'readwrite' });
}
```
Always call `queryPermission()` → `requestPermission()` on startup inside a user gesture, never on page load.

**Phase:** Phase 1 (persistence layer setup)

---

### 2. Background-Tab Permission Auto-Revocation

**Description:** Chrome revokes FSA write permission when a tab is backgrounded for extended periods. A user who leaves the app open and returns later may find writes silently failing.

**Warning signs:**
- `handle.createWritable()` throws `NotAllowedError` intermittently
- Saves appear to succeed (no error shown) but file isn't updated

**Prevention:**
```typescript
try {
  await storage.write(data);
} catch (e) {
  if (e instanceof DOMException && e.name === 'NotAllowedError') {
    await reRequestPermission();
  }
}
```
Every FSA write path needs try/catch for `NotAllowedError` with graceful re-prompt.

**Phase:** Phase 1 (persistence layer)

---

### 3. Floating-Point Leaking Through Despite Cents Architecture

**Description:** `parseFloat("19.99") * 100 = 1998.9999...`. A cents architecture only works if `parseCents` is the single, correct entry point. Distribution splits that don't use a largest-remainder algorithm will accumulate rounding errors — bucket totals won't equal the invoice amount.

**Warning signs:**
- Unit test: `parseCents("19.99") === 1999` fails
- Allocation totals are ±1 cent off invoice amount
- `typeof amount === 'number'` passes but value is fractional

**Prevention:**
```typescript
// lib/cents.ts — the ONLY place division/multiplication happens
export function parseCents(input: string): Cents {
  return Math.round(parseFloat(input) * 100) as Cents;
}

// Largest-remainder for splits
export function splitCents(total: Cents, ratios: number[]): Cents[] {
  const sum = ratios.reduce((a, b) => a + b, 0);
  const floats = ratios.map(r => (r / sum) * total);
  const floored = floats.map(f => Math.floor(f) as Cents);
  const remainders = floats.map((f, i) => f - floored[i]);
  const leftover = total - (floored.reduce((a, b) => a + b, 0) as Cents);
  const indices = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .slice(0, leftover)
    .map(x => x.i);
  return floored.map((v, i) => (indices.includes(i) ? (v + 1) as Cents : v));
}
```

Use a branded `Cents = number & { __brand: 'Cents' }` type to catch raw number passing at compile time.

**Phase:** Phase 1 (foundation — must be correct from day 1)

---

### 4. Zustand Initialized with Empty State Before FSA Load Completes

**Description:** Without `persist` middleware, Zustand stores start empty. Any write triggered before the async FSA load completes will overwrite the saved file with empty data.

**Warning signs:**
- Dashboard briefly flashes empty on startup before showing real data
- After refresh, some data is missing (overwrite race)

**Prevention:**
```typescript
interface AppState {
  initialized: boolean;
  accounts: Account[];
}
// Never write to FSA until initialized = true
// All write paths must guard: if (!store.getState().initialized) return;
```

**Phase:** Phase 1 (persistence layer + store setup)

---

### 5. Multi-Tab State Divergence

**Description:** Two open tabs both have Zustand state in memory. Tab A saves; Tab B overwrites with stale state. Silent data loss.

**Warning signs:**
- Changes made in two tabs, one set disappears

**Prevention:**
```typescript
const channel = new BroadcastChannel('money-flow-sync');
channel.postMessage({ type: 'state-updated', timestamp: Date.now() });
channel.onmessage = (e) => {
  if (e.data.type === 'state-updated') {
    showToast('Another tab updated data. Refresh to see changes.');
  }
};
```

**Phase:** Phase 2

---

### 6. Tailwind v4 / shadcn New York — No tailwind.config.js

**Description:** Tailwind v4 is CSS-first. Many tutorials still reference `tailwind.config.js`, `tailwindcss-animate`, and HSL colors — none apply to v4.

**Warning signs:**
- `tailwind.config.js` referenced anywhere
- `tailwindcss-animate` in `package.json`
- `border` class renders no visible border

**Prevention:**
- `@tailwindcss/vite` plugin, NOT PostCSS
- `tw-animate-css` not `tailwindcss-animate`
- `components.json` must have `"config": ""` (empty string)
- Theme customization in `globals.css` `@theme {}` block
- Use `border-border` explicitly (v4 border default is `currentColor`)
- Colors are OKLCH, not HSL

**Phase:** Phase 1 (scaffold)

---

### 7. CSV Parsing Fails on Real Bank Exports

**Description:** Bank CSV exports are inconsistent. UTF-8 BOM corrupts first column header. European banks use `;` delimiter and `,` decimal separator.

**Warning signs:**
- First column parsed as `ï»¿Date` instead of `Date`
- Amount field is NaN

**Prevention:**
- `papaparse` with `{ bom: true, dynamicTyping: false }`
- Bank-specific adapters: `WiseAdapter`, `N26Adapter`, `RevolutAdapter`
- Normalize decimal: replace `,` with `.` before `parseFloat`
- Show preview of parsed rows before confirming import

**Phase:** Phase 3 (CSV import)

---

### 8. AI API Key in Client-Side Bundle

**Description:** `VITE_ANTHROPIC_API_KEY` in `.env` is bundled into JS output and visible in source. Critical security violation.

**Warning signs:**
- Any `import.meta.env.VITE_*` key for external API in bundle

**Prevention:**
- User provides key at runtime via settings form
- Store in `localStorage`, never in env vars or FSA files
- Show clear warning: "Your key is stored locally in this browser only"

**Phase:** Phase 3 (AI CSV analysis)

---

## Summary Table

| # | Pitfall | Phase | Severity |
|---|---------|-------|----------|
| 1 | FSA permission revoked each session | Phase 1 | Critical |
| 2 | Background-tab permission auto-revocation | Phase 1 | High |
| 3 | Float leaking through cents layer | Phase 1 | Critical |
| 4 | Zustand write before FSA load | Phase 1 | Critical |
| 5 | Multi-tab state divergence | Phase 2 | Medium |
| 6 | Tailwind v4 / shadcn config mismatches | Phase 1 | High |
| 7 | CSV format inconsistencies | Phase 3 | High |
| 8 | AI API key in client bundle | Phase 3 | Critical (security) |

---

*Research completed: 2026-02-27*
