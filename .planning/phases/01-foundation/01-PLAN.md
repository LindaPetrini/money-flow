---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - vite.config.ts
  - tsconfig.json
  - tsconfig.app.json
  - tsconfig.node.json
  - index.html
  - src/main.tsx
  - src/App.tsx
  - src/index.css
  - src/vite-env.d.ts
  - src/test/setup.ts
  - components.json
  - .gitignore
autonomous: true
requirements:
  - INFRA-01
  - INFRA-02

must_haves:
  truths:
    - "Running `npm start` in /root/money-flow/ opens a Vite dev server on localhost with no server-side process required"
    - "Running `npm run build` produces a dist/ folder with no TypeScript errors"
    - "Running `npm test` runs Vitest and reports 0 failures (test suite runs, even with 0 tests)"
    - "All dependency licenses are MIT or Apache-2.0 — no proprietary packages"
    - "No tailwind.config.js exists; Tailwind is configured only via @theme in src/index.css"
    - "components.json has `\"config\": \"\"` (empty string) — required for npx shadcn add to work"
  artifacts:
    - path: "package.json"
      provides: "npm start alias + all correct dependency versions"
      contains: "\"start\": \"vite\""
    - path: "vite.config.ts"
      provides: "Vite 7 + React + Tailwind v4 plugin + Vitest config"
      exports: ["defineConfig"]
    - path: "src/index.css"
      provides: "Tailwind v4 imports + tw-animate-css + @theme OKLCH tokens"
      contains: "@import \"tailwindcss\""
    - path: "components.json"
      provides: "shadcn/ui New York config for Tailwind v4"
      contains: "\"config\": \"\""
    - path: "src/test/setup.ts"
      provides: "Vitest + @testing-library/jest-dom setup"
      contains: "@testing-library/jest-dom"
    - path: "tsconfig.app.json"
      provides: "@/* path alias for shadcn imports"
      contains: "\"@/*\": [\"./src/*\"]"
  key_links:
    - from: "vite.config.ts"
      to: "src/index.css"
      via: "@tailwindcss/vite plugin (NOT postcss)"
      pattern: "tailwindcss.*from.*@tailwindcss/vite"
    - from: "vite.config.ts"
      to: "src/test/setup.ts"
      via: "test.setupFiles config key"
      pattern: "setupFiles.*test/setup"
---

<objective>
Scaffold the Money Flow project from scratch using the exact Vite 7 + React 19 + TypeScript + Tailwind v4 + shadcn/ui New York configuration required for all subsequent phases.

Purpose: Every other phase depends on this scaffold. Getting the Tailwind v4 + shadcn/ui config exactly right now prevents cryptic failures in later phases.
Output: A working project in /root/money-flow/ that passes `npm start`, `npm run build`, and `npm test`.
</objective>

<execution_context>
@/root/.claude/get-shit-done/workflows/execute-plan.md
@/root/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/root/money-flow/.planning/PROJECT.md
@/root/money-flow/.planning/ROADMAP.md
@/root/money-flow/.planning/STATE.md
@/root/money-flow/.planning/phases/01-foundation/01-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Vite 7 project with exact dependency versions and npm start alias</name>
  <files>package.json, vite.config.ts, tsconfig.json, tsconfig.app.json, tsconfig.node.json, index.html, src/main.tsx, src/App.tsx, src/vite-env.d.ts, .gitignore</files>
  <action>
Work in /root/money-flow/. The directory already has CLAUDE.md and .planning/ — do NOT reinitialize git or overwrite those.

Step 1 — Verify Node version is 20.19+ (Vite 7 requirement):
```
node --version
```
If below 20.19, use nvm to switch: `nvm use 20` or `nvm use 22`.

Step 2 — Scaffold Vite project INTO the existing directory. Because /root/money-flow/ already exists, use:
```
cd /root/money-flow && npm create vite@latest . -- --template react-ts
```
When prompted "Current directory is not empty", choose "Ignore files and continue" (not overwrite).

Step 3 — Install core dependencies:
```
npm install
npm install tailwindcss @tailwindcss/vite
npm install zustand idb
npm install tw-animate-css
npm install -D vitest @testing-library/react@16 @testing-library/user-event @testing-library/jest-dom jsdom
```

Step 4 — Replace vite.config.ts with the exact required content:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    reporters: ['default'],
  },
});
```
CRITICAL: tailwindcss() must come from '@tailwindcss/vite', NOT from postcss. Delete any postcss.config.js or postcss.config.cjs if created by scaffolding.

Step 5 — Update package.json scripts to add `"start": "vite"`:
```json
"scripts": {
  "start": "vite",
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

Step 6 — Update tsconfig.app.json to add path alias (required for shadcn @/ imports). Merge into existing compilerOptions:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "strict": true
  }
}
```

Step 7 — Delete tailwind.config.js if it exists (Tailwind v4 uses CSS-only config, no JS config file).

Step 8 — Verify no PostCSS config exists. If postcss.config.js or postcss.config.cjs exists, delete it.

Step 9 — Update src/main.tsx to a minimal working entry:
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Step 10 — Update src/App.tsx to a minimal "Money Flow is alive" shell:
```typescript
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <h1 className="text-2xl font-semibold">Money Flow</h1>
    </div>
  );
}
```

Step 11 — Run `npm run build` and fix any TypeScript errors. If @types/node is missing (path.resolve error), install it: `npm install -D @types/node`.
  </action>
  <verify>
    <automated>cd /root/money-flow && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
`npm run build` exits 0 with no TypeScript errors. dist/ directory is created. No tailwind.config.js exists. No postcss.config.* exists. package.json has "start": "vite" in scripts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Configure Tailwind v4 CSS, shadcn/ui New York, and Vitest setup</name>
  <files>src/index.css, components.json, src/test/setup.ts</files>
  <action>
Step 1 — Run shadcn init to configure the component library:
```
cd /root/money-flow && npx shadcn@latest init
```
When prompted:
- Style: New York
- Base color: Zinc
- CSS variables: Yes
- Tailwind config path: LEAVE BLANK (press Enter for empty — required for Tailwind v4)

The shadcn init will overwrite src/index.css. After it completes, verify src/index.css contains:
- `@import "tailwindcss";` (first import)
- OKLCH color tokens in an `@theme inline { ... }` block (NOT HSL)

Step 2 — Add tw-animate-css import to src/index.css immediately after the tailwindcss import:
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* shadcn init will have placed OKLCH tokens here — preserve them exactly */
}
```
Do NOT import tailwindcss-animate (deprecated). Only tw-animate-css.

Step 3 — Verify components.json was created by shadcn init and has the correct Tailwind v4 config:
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
CRITICAL: `"config": ""` must be an empty string (not a path). If it contains any path value, fix it to `""`.

Step 4 — Create src/test/setup.ts:
```typescript
import '@testing-library/jest-dom';
```

Step 5 — Run `npm test` to verify the test runner starts successfully (expect "0 tests passed" or similar — no failures):
```
cd /root/money-flow && npm test 2>&1
```
If "Unknown reporter: basic" error appears, verify vite.config.ts uses `reporters: ['default']` (not 'basic').

Step 6 — Install a minimal shadcn component to verify the setup works end-to-end:
```
cd /root/money-flow && npx shadcn@latest add button
```
This should succeed without errors. The Button component will be created at src/components/ui/button.tsx.

Step 7 — Run `npm run build` one final time to confirm everything compiles:
```
cd /root/money-flow && npm run build 2>&1
```
  </action>
  <verify>
    <automated>cd /root/money-flow && npm test 2>&1; echo "---"; cat /root/money-flow/components.json | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['tailwind']['config'] == '', 'config must be empty string'; print('components.json OK')"</automated>
  </verify>
  <done>
`npm test` exits 0 (Vitest runs, no errors). `components.json` has `"config": ""`. `src/test/setup.ts` exists. `src/components/ui/button.tsx` exists (shadcn CLI works). `npm run build` exits 0.
  </done>
</task>

</tasks>

<verification>
Run all three: `npm start` (verify dev server starts), `npm run build` (verify 0 errors), `npm test` (verify test runner works).

Check:
1. No tailwind.config.js exists in /root/money-flow/
2. No postcss.config.* exists in /root/money-flow/
3. `components.json` has `"config": ""`
4. `src/index.css` imports `tw-animate-css` (not tailwindcss-animate)
5. `vite.config.ts` imports tailwindcss from `@tailwindcss/vite`
6. `package.json` scripts includes `"start": "vite"`
7. `tsconfig.app.json` has `"@/*": ["./src/*"]` path alias
</verification>

<success_criteria>
1. `npm start` opens Vite dev server on localhost — no server required
2. `npm run build` exits 0 with a dist/ folder
3. `npm test` runs Vitest with no failures
4. All installed packages are MIT or Apache-2.0 licensed
5. `npx shadcn@latest add [any-component]` works (verified with button)
</success_criteria>

<output>
After completion, create `/root/money-flow/.planning/phases/01-foundation/01-01-SUMMARY.md` with:
- What was built
- Exact package versions installed (from package.json)
- Any deviations from the plan and why
- Verification results
</output>
