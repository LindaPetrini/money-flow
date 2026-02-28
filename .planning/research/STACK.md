# Stack Research

**Domain:** Local-first browser app — freelance budget allocator
**Researched:** 2026-02-27
**Confidence:** HIGH (core stack verified via official docs and current npm releases)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | 7.3.1 | Build tool + dev server | Industry standard replacement for CRA. Vite 7 ships ESM-only, targets `baseline-widely-available` (Chrome 107, Firefox 104, Safari 16), drops Node 18. First-party `@tailwindcss/vite` plugin gives tighter Tailwind integration than PostCSS. Fastest HMR in the ecosystem. |
| React | 19.2.4 | UI framework | Concurrent rendering by default. New `use()` hook, `useActionState`, `useFormStatus`, `useOptimistic`. React Compiler reduces need for manual `useMemo`/`useCallback`. Required by shadcn/ui Tailwind v4 + New York path. |
| TypeScript | 5.7+ (bundled with Vite template) | Type safety | Minimum required by Zustand 5. Vite transpiles via esbuild (~20-30x faster than `tsc`). Strict mode essential for money-math type safety (cents as `number` vs mixed types). |
| Tailwind CSS | 4.2.1 | Utility-first CSS | v4 is CSS-first: no `tailwind.config.js`, no PostCSS config needed. Single `@import "tailwindcss"` in CSS. Auto content detection. Up to 100x faster incremental builds. OKLCH color system. `@theme` directive replaces JS config. |
| @tailwindcss/vite | 4.2.1 | Vite plugin for Tailwind | First-party Vite plugin — replaces PostCSS integration. Must match Tailwind major.minor version. Added to `vite.config.ts` plugins array. |
| shadcn/ui | latest CLI | Component library | Not a package — components copied into `src/components/ui/`. New York variant is now the default in Tailwind v4. HSL colors migrated to OKLCH. `tailwindcss-animate` replaced by `tw-animate-css`. `ForwardRef` removed; `data-slot` attributes added. Fully supports Tailwind v4 + React 19. |
| Zustand | 5.0.11 | Client UI state | Minimal boilerplate, zero provider setup, works outside React tree. No `persist` middleware — FSA + idb own persistence; Zustand holds in-session runtime state only. `use-sync-external-store` is now a peer dependency (React 19 provides it). React 19 concurrent mode compatible. |
| idb | 8.0.3 | IndexedDB wrapper | Tiny (~1.19kB brotli). Mirrors IndexedDB API with Promises. Used for: (1) persisting FSA `FileSystemDirectoryHandle` objects across sessions, (2) metadata/config storage as fallback when FSA directory is not yet opened. |
| File System Access API | Browser-native | Primary persistence | User selects a directory once; app writes human-readable JSON files directly to disk. Survives browser cache clears. FileHandles serialized into IndexedDB via structured clone algorithm. Chrome 122+ persistent permission prompt available. |
| Vitest | 4.0.18 | Test runner | Vite-native (reuses vite config, no separate bundler startup). Jest-compatible API. v4 adds stable Browser Mode, visual regression, Playwright trace support. `basic` reporter removed. Requires Vite 7 (min Vitest 3.2 for Vite 7 support; v4 exceeds that). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | 4.x | React + HMR support in Vite | Required plugin for React in Vite. Use Babel-based (not SWC) — more stable with shadcn transforms. |
| @testing-library/react | 16.x | Component testing utilities | All component tests. React 19 support added in v16. Do NOT use v14/v15 with React 19. |
| @testing-library/user-event | 14.x | Realistic user interaction simulation | Form tests, button clicks, input changes. More realistic than `fireEvent`. |
| @testing-library/jest-dom | 6.x | Custom DOM matchers | `toBeInTheDocument()`, `toHaveValue()`, etc. Import in vitest setup file. |
| jsdom | 25.x | DOM environment for Vitest | Configure as `environment: 'jsdom'` in vitest config. Required for React component tests. |
| tw-animate-css | 1.x | Animation utilities | Replaces deprecated `tailwindcss-animate`. Import with `@import "tw-animate-css"` in globals.css. Provides `accordion-down`, animate-in/out vocabulary. |
| lucide-react | 0.x (latest) | Icons | shadcn/ui default icon set. Tree-shakeable SVG icons used throughout shadcn components. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Node.js 20.19+ or 22.12+ | Runtime | Vite 7 dropped Node 18 (EOL April 2025). Verify with `node --version` before scaffolding. |
| npm | Package manager | Prefer npm for open-source `npm start` compatibility. |
| ESLint | Linting | Included in Vite react-ts template. |
| tsc --noEmit | Type checking | esbuild transpiles but does NOT type-check. Run separately in CI. |
| React DevTools | Debug | Browser extension. Zustand DevTools middleware optional in dev mode. |

---

## Installation

```bash
# 1. Scaffold project (Vite 7 + React 19 + TypeScript template)
npm create vite@latest money-flow -- --template react-ts
cd money-flow
npm install

# 2. Tailwind v4 + Vite plugin
npm install tailwindcss @tailwindcss/vite
# No tailwind.config.js needed — CSS-first from here

# 3. shadcn/ui init (latest supports Tailwind v4 + React 19)
npx shadcn@latest init
# Select: New York style, OKLCH colors, leave Tailwind config path blank

# 4. shadcn animation dependency (tw-animate-css replaces tailwindcss-animate)
npm install tw-animate-css

# 5. State management
npm install zustand

# 6. IndexedDB wrapper
npm install idb

# 7. Icons (shadcn dependency)
npm install lucide-react

# Dev dependencies (testing)
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

### vite.config.ts (critical Tailwind v4 integration)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // First-party Vite plugin — do NOT use PostCSS config
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

### src/index.css (Tailwind v4 CSS-first)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* shadcn/ui New York OKLCH tokens injected here by npx shadcn init */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  /* ... full OKLCH palette from shadcn init output ... */
}
```

### components.json (shadcn — Tailwind v4 mode)

```json
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

Note: `"config": ""` is required for Tailwind v4. Any non-empty value causes shadcn CLI to look for a JS config file that does not exist, breaking `npx shadcn add [component]`.

### tsconfig.app.json (path alias for shadcn)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vite 7 | Next.js App Router | If SSR or server components were needed. Not applicable — app is fully client-side local-first. |
| Tailwind v4 | Tailwind v3 | Only for existing v3 codebases. Greenfield projects should always use v4. |
| shadcn/ui New York | shadcn/ui Default style | Default style is deprecated — New York is the new standard. There is no meaningful reason to use Default on a new project. |
| Zustand 5 (no persist) | Zustand 5 + persist middleware | Use persist only if you have no custom persistence layer. Here, FSA + idb IS the persistence layer; persist middleware creates a redundant second source of truth and doubles storage writes. |
| Zustand 5 | Jotai | Jotai is fine but the atomic model adds unnecessary complexity for this app's data shape (flat stores per domain). |
| Zustand 5 | Redux Toolkit | Excessive boilerplate for a single-user local app with no async side-effects needing middleware. |
| idb 8 | idb-keyval | idb-keyval (simpler key-value API) is sufficient only for simple key-value storage. Use full `idb` because this app needs multiple typed object stores (budgets, accounts, history, handles). |
| File System Access API | localStorage | localStorage has 5MB limit and provides no file export story. FSA writes unlimited human-readable JSON directly to the user's disk. Use localStorage only as a fallback when FSA is unavailable. |
| Vitest 4 | Jest | Jest requires separate bundler config, slower startup, no native Vite integration. Vitest reuses vite.config.ts entirely and is significantly faster. |
| @testing-library/react 16 | Enzyme | Enzyme is unmaintained for React 19. Do not use. |
| jsdom | happy-dom | Either works. jsdom is more complete and battle-tested. |
| @vitejs/plugin-react (Babel) | @vitejs/plugin-react-swc | SWC is faster in dev but has occasional edge-case incompatibilities with Babel transforms some shadcn components rely on. Speed difference is negligible for this app size. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tailwindcss-animate` | Deprecated in shadcn/ui Tailwind v4 path. Using both causes duplicate animation definitions and class conflicts. | `tw-animate-css` |
| `tailwind.config.js` | Not auto-detected in Tailwind v4. Must be explicitly loaded via `@config` if used. In Tailwind v4 + shadcn: use `@theme` directive in CSS only. | `@theme` block in `index.css` |
| Zustand `persist` middleware | Creates a second source of truth alongside FSA. Stale localStorage data can override fresh FSA data on hydration, causing subtle state corruption bugs. | FSA writes in store mutation callbacks; idb for FSA handle storage |
| Individual `@radix-ui/react-*` packages | shadcn/ui New York with Tailwind v4 switched to unified `radix-ui` package. Installing individual packages causes version conflicts. | Let `npx shadcn add [component]` manage Radix imports automatically |
| Create React App (CRA) | Unmaintained since 2022, webpack-based, no Vite integration, incompatible with modern toolchain. | `npm create vite@latest -- --template react-ts` |
| Floating point for money math | `0.1 + 0.2 === 0.30000000000000004`. Any financial calculation using JS floats produces wrong results. | Integer cents throughout: `parseCents(input)` converts input to integer; all arithmetic in cents; `formatCents(amount)` for display |
| React Router | This app has no multi-page routing. Adding React Router for view switching adds unnecessary complexity. | State-driven view rendering via Zustand (e.g., `activeView` state) |
| TanStack Query | No server state to manage. TanStack Query is designed for server data caching/refetching. Overkill for a fully local app. | Direct FSA reads in useEffect; Zustand for in-memory state |

---

## Stack Patterns by Variant

**This is a pure client-side local-first app (no server, no auth, no routing):**
- No React Query / TanStack Query
- No React Router
- No tRPC / fetch wrappers
- Zod: optional — useful for validating CSV import data shape; add only if CSV parsing logic warrants schema validation

**For AI CSV analysis:**
- Client-side `fetch` call to an LLM API (Anthropic, OpenAI, etc.)
- User provides API key (stored in idb or sessionStorage — never hardcoded or committed)
- No AI SDK required; raw `fetch` to API endpoint is sufficient for this use case

**For money math (all stores and calculations):**
- Parse: `const cents = Math.round(parseFloat(input) * 100)`
- Store: always as integer cents
- Arithmetic: all operations in cents (no float intermediates)
- Display: `(cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })`

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Vite 7.3.x | Node.js 20.19+ or 22.12+ | Node 18 dropped at Vite 7. Verify before scaffolding. |
| Vitest 4.x | Vite 7.x | Min Vitest 3.2 for Vite 7; v4 fully supported. |
| React 19.2.x | Zustand 5.0.11 | Zustand 5 requires React 18+; React 19 fully compatible. |
| tailwindcss 4.2.x | @tailwindcss/vite 4.2.x | Must stay in sync — same major.minor version. |
| shadcn/ui (latest CLI) | Tailwind 4.x + React 19 | shadcn February 2025 update fully supports Tailwind v4 + React 19. New York is now the default style. |
| @testing-library/react 16.x | React 19.x | React 19 support requires @testing-library/react v16+. v14 and v15 do not support React 19. |
| idb 8.x | All modern browsers | Targets Chrome 86+, Firefox, Safari. Aligns with FSA browser support requirements. |
| @vitejs/plugin-react 4.x | Vite 7.x | Compatible. No version conflicts expected. |

---

## Setup / Config Gotchas for This Specific Stack

### Gotcha 1: Tailwind v4 + Vite — Use the Plugin, Not PostCSS

**Wrong:** Adding `tailwindcss` to `postcss.config.js`
**Right:** Import `tailwindcss` from `@tailwindcss/vite` and add to `plugins[]` in `vite.config.ts`

Mixing PostCSS config with the Vite plugin causes double-processing and broken builds. Delete any `postcss.config.js` file when migrating.

### Gotcha 2: shadcn New York + Tailwind v4 — `"config": ""` is Intentional

Leaving `tailwind.config` blank in `components.json` is required for Tailwind v4. The shadcn CLI uses CSS-based detection. Any non-empty value causes the CLI to look for a JS config that does not exist, breaking `npx shadcn add [component]` with a cryptic error.

### Gotcha 3: Zustand 5 — `useShallow` Required for Object Selectors

In Zustand v5, if a selector returns a new object reference on every call, it triggers an infinite render loop via `useSyncExternalStore`.

```typescript
// WRONG — creates new object reference every render → infinite loop in Zustand 5
const { buckets, accounts } = useBudgetStore(state => ({
  buckets: state.buckets,
  accounts: state.accounts,
}))

// RIGHT — useShallow gives stable reference
import { useShallow } from 'zustand/shallow'
const { buckets, accounts } = useBudgetStore(
  useShallow(state => ({ buckets: state.buckets, accounts: state.accounts }))
)
```

Do NOT compute derived values inside `useShallow` selectors (e.g., `.map()` calls). Extract raw state first, then compute outside the selector.

### Gotcha 4: FSA + idb — Two Separate Concerns, One Pattern

idb stores the `FileSystemDirectoryHandle` (serializable via structured clone). FSA uses that handle to read/write JSON files. They do not conflict.

```typescript
// On app start: retrieve handle from idb, verify permission
const savedHandle = await db.get('handles', 'workDir')
if (savedHandle) {
  const perm = await savedHandle.queryPermission({ mode: 'readwrite' })
  if (perm !== 'granted') {
    await savedHandle.requestPermission({ mode: 'readwrite' })
  }
  // Now use handle to read app data
}

// When user picks directory: save handle to idb
const handle = await window.showDirectoryPicker()
await db.put('handles', handle, 'workDir')
```

Permission check is mandatory on every session start — permissions are NOT guaranteed to persist without the Chrome 122+ persistent permission prompt.

### Gotcha 5: Zustand Without Persist — Hydration Pattern

Zustand holds runtime state only. On mount, load from FSA into Zustand. On mutations, write back to FSA.

```typescript
// In a top-level component useEffect or a dedicated hydration hook
useEffect(() => {
  async function hydrate() {
    const data = await readFromFSA('accounts.json')
    useAccountStore.getState().setAccounts(data)
  }
  hydrate()
}, [])

// In Zustand store — write-through on every mutation
const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  setAccounts: (accounts) => {
    set({ accounts })
    writeToFSA('accounts.json', accounts)  // fire-and-forget or with error handling
  },
}))
```

### Gotcha 6: Vitest 4 — `basic` Reporter Removed

```typescript
// OLD (breaks in Vitest 4)
reporters: ['basic']

// NEW
reporters: ['default']
```

### Gotcha 7: `tw-animate-css` Not Found After `npx shadcn add`

If `npx shadcn add [component]` fails with a missing `tw-animate-css` import error:

```bash
npm install tw-animate-css
```

Then in `src/index.css`:
```css
@import "tailwindcss";
@import "tw-animate-css";   // Add this line
```

### Gotcha 8: Node.js Version Check Before `npm create vite@latest`

Vite 7 requires Node 20.19+ or 22.12+. Running scaffold on Node 18 installs successfully but fails at build time with cryptic ESM errors.

```bash
node --version  # Must be 20.19+ or 22.12+
```

---

## Sources

- [Vite 7.0 announcement](https://vite.dev/blog/announcing-vite7) — Node requirement, baseline-widely-available target, ESM-only, breaking changes **[HIGH confidence — official blog]**
- [Vite GitHub releases](https://github.com/vitejs/vite/releases) — version 7.3.1 confirmed current **[HIGH confidence]**
- [React 19.2 blog post](https://react.dev/blog/2025/10/01/react-19-2) — feature list, version 19.2.4 **[HIGH confidence — official]**
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first, @theme directive, Vite plugin **[HIGH confidence — official]**
- [@tailwindcss/vite npm](https://www.npmjs.com/package/@tailwindcss/vite) — version 4.2.1 **[HIGH confidence]**
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — New York default, OKLCH, tw-animate-css, components.json config:"" **[HIGH confidence — official docs]**
- [shadcn/ui changelog February 2025](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4) — Tailwind v4 + React 19 support shipped **[HIGH confidence]**
- [tw-animate-css GitHub](https://github.com/Wombosvideo/tw-animate-css) — replacement for tailwindcss-animate **[HIGH confidence]**
- [Zustand v5 migration guide](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5) — breaking changes, persist behavioral change, useShallow requirement **[HIGH confidence — official docs]**
- [Announcing Zustand v5](https://pmnd.rs/blog/announcing-zustand-v5) — version 5.0.11, React 19 compatible **[HIGH confidence]**
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) — stable browser mode, visual regression, basic reporter removed **[HIGH confidence — official]**
- [Vitest 4.0 VoidZero post](https://voidzero.dev/posts/announcing-vitest-4) — Vite 7 support from Vitest 3.2 **[HIGH confidence]**
- [idb GitHub](https://github.com/jakearchibald/idb) — version 8.0.3, FSA handle serialization **[HIGH confidence]**
- [FSA persistent permissions Chrome 122](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) — queryPermission() pattern, three-way prompt **[HIGH confidence — official Chrome docs]**
- [FSA + idb handle storage pattern](https://www.xjavascript.com/blog/file-system-access-api-is-it-possible-to-store-the-filehandle-of-a-saved-or-loaded-file-for-later-use/) — structured clone algorithm, idb integration **[MEDIUM confidence — community verified against MDN]**

---

*Stack research for: local-first browser app — freelance budget allocator (Money Flow)*
*Researched: 2026-02-27*
