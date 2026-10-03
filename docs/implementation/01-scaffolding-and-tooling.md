# 01 — Scaffolding, tooling and boundary rules

Wave: **W0** · Estimate: 1 day · Original plan: phase 0 (first half)

## Goal

A running Next.js + TypeScript + Tailwind v4 app with the folder layout, lint/format/test
tooling, CI, and the **architecture boundary rules** every later phase relies on. No
product features.

## Prerequisites

None. Node 22+ and npm 10+.

---

## Deliverables

```
package.json  tsconfig.json  next.config.ts  eslint.config.mjs  .prettierrc
vitest.config.mts  playwright.config.ts  .env.example  CLAUDE.md  AGENTS.md
.github/workflows/ci.yml
src/
  app/layout.tsx  app/page.tsx  app/globals.css
  core/README.md            # what may and may not be imported here
  components/README.md
  modules/README.md  modules/registry.ts
  lib/cn.ts  lib/site.ts
tests/setup.ts
tests/fixtures/README.md    # empty table: example | book | edition | chapter/section | test
tests/oracle/README.md
e2e/smoke.spec.ts
```

---

## Steps

### 1. Scaffold

`create-next-app` with App Router, TypeScript, Tailwind, ESLint, `src/` and the `@/*`
alias. Use the **same Next major as Internet Visualizer (16.x)**. Next 16 has breaking
changes: read the relevant guide in `node_modules/next/dist/docs/` before writing code,
and keep the `AGENTS.md` block `next dev` writes. Keep the existing `README.md`, `docs/`
and `.gitignore`.

### 2. Dependencies

Runtime: `zustand`, `zod`, `clsx`, `tailwind-merge`, `lucide-react`, `motion`,
`@xyflow/react` (deadlock graph only, lazy-loaded), `@next/mdx` + `@mdx-js/react` +
`remark-gfm` (for lessons), `@vercel/analytics`.

Dev: `vitest`, `@vitest/coverage-v8`, `fast-check`, `@testing-library/react`,
`@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test`,
`@axe-core/playwright`, `prettier`, `prettier-plugin-tailwindcss`,
`eslint-plugin-boundaries`.

Match Internet Visualizer's versions where it has the same package.

### 3. Boundary rules (`eslint.config.mjs`)

Copy the structure of Internet Visualizer's `eslint.config.mjs` and adapt it:

1. `src/core/**` (non-test files) may not import `react`, `react-dom`, `next`, `next/*`,
   `motion`, `@xyflow/*`, `@/components/**`, `@/modules/**`, `@/app/**`.
2. `src/core/**` may not call `Math.random` or `Date.now` / `new Date()` / `performance.now`
   (`no-restricted-properties`, `no-restricted-syntax`). Randomness goes through the
   vendored seeded rng.
3. `src/modules/<a>/**` may not import `src/modules/<b>/**`. **Exception:** `compare` may
   import the scheduling module's exported renderers from `src/modules/scheduling/index.ts`
   only (declare this explicitly in the boundaries config, with a comment).
4. `src/components/**` may not import `src/modules/**` (the registry is the exception).
5. `@xyflow/react` may only be imported under `src/modules/deadlock/**`, so it can never
   end up in another route's bundle.

Add a comment block at the top explaining each rule and why, as Internet Visualizer does.

### 4. Tests

- Vitest with two projects: `core` (node environment: `src/core/**`, `tests/**`) and `ui`
  (jsdom: `src/components/**`, `src/modules/**`).
- fast-check runs with a fixed seed from `tests/setup.ts` (`fc.configureGlobal({ seed })`),
  and a failing seed is printed so it can be replayed.
- Playwright: Chromium only locally, all three browsers in CI. `e2e/smoke.spec.ts` loads
  `/` and runs axe.

### 5. Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `test`,
`test:watch`, `test:coverage`, `test:e2e`, and
`verify` = `lint && typecheck && test && build`.

### 6. Registry

`src/modules/registry.ts` lists the five v1 modules plus Synchronisation with
`{ slug, route, title, blurb, number, status: 'planned' | 'ready', phase: 1 | 2 }`.
The home page renders it as a list of cards; `planned` cards are not links.

### 7. CI

GitHub Actions: install, `npm run verify`, Playwright against the production build.

### 8. `CLAUDE.md`

Project summary, the aims from `00-overview.md` §2, the boundary rules, the rule that
every tie-break is stated in the UI and tested, and the rules for parallel agents
(00-overview §4).

---

## Acceptance criteria

- [ ] `npm run verify` passes on a clean clone
- [ ] `Math.random()` or `Date.now()` in `src/core` fails lint (keep a lint fixture test)
- [ ] Importing `react` or `@xyflow/react` from `src/core` fails lint
- [ ] Importing `@xyflow/react` from `src/modules/scheduling` fails lint
- [ ] `/` renders the six module cards from the registry, axe clean
- [ ] CI is green

---

## Prompts to execute

### Prompt 1.1 — scaffold and tooling

```
Read docs/implementation/00-overview.md and docs/implementation/01-scaffolding-and-tooling.md.
Also look at ../internet-visualizer/eslint.config.mjs, vitest.config.mts, playwright.config.ts
and package.json for the conventions to copy.

Scaffold the Next.js app in this repo (keep the existing README.md, docs/ and .gitignore).
Use the same Next major as Internet Visualizer. Before writing Next code, read the relevant
guides in node_modules/next/dist/docs/.

Install the dependencies in step 2. Configure Vitest with the node `core` project and the
jsdom `ui` project, fast-check with a fixed global seed, Playwright with axe, Prettier, and
the npm scripts in step 5 including `verify`.

Write eslint.config.mjs with all five boundary rules from step 3, including the Compare
exception and the rule that confines @xyflow/react to src/modules/deadlock. Add lint
fixture tests proving the Math.random, Date.now and @xyflow bans work.

Done when `npm run verify` passes. Commit on a branch named chore/scaffold.
```

### Prompt 1.2 — registry, home page, CI, CLAUDE.md

```
Read docs/implementation/01-scaffolding-and-tooling.md steps 6-8.

Create src/modules/registry.ts with the six modules from 00-overview.md §3 (all status
'planned'), a minimal home page that lists them as cards, the e2e smoke test with axe,
the GitHub Actions workflow, and CLAUDE.md with the aims, boundary rules and parallel
agent rules. Write the README files for src/core, src/components, src/modules,
tests/fixtures (with the empty fixture table) and tests/oracle.

Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```
