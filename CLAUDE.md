@AGENTS.md

# OS Visualizer

Operating system internals you can step through: CPU scheduling, address translation,
page replacement and deadlock (v1), synchronisation (phase 2). Third project in the
Visualizer Series after Internet Visualizer and Crypto Visualizer, with the same kernel
pattern, timeline and quality bar. Next.js 16 + TypeScript + Tailwind v4. Own Vercel
project. **No database.**

Plan: `docs/implementation/00-overview.md` (one file per phase, each with its prompts).

## Aims

Every task is judged against these. If it doesn't serve one, it's out of scope.

1. **Teach by stepping.** Every algorithm advances one tick or step at a time, forwards
   and backwards, on the shared timeline, with the reason for each decision shown.
2. **Be provably correct.** Textbook worked examples, property tests on invariants, and a
   brute-force oracle where feasible (OPT, Banker's safety, deadlock detection).
3. **Be deterministic and shareable.** Every tie-break and ordering rule is written down,
   shown in the UI and tested. Same input = same run. Any workload or graph is a URL
   (`?s=`; `localStorage` key `osv:v1`).
4. **Be useful for the course.** Editable inputs, presets for the classic situations,
   metrics matching textbook definitions.
5. **Be honest.** These are the textbook algorithms, not a real kernel. State which
   convention was chosen where textbooks disagree.
6. **Match the portfolio's quality bar.** Pure core, boundary lint rules, axe on every
   route, keyboard-only operation (including the deadlock graph), reduced motion, a JS
   budget per route.

**Every tie-break is stated in the UI ("Rules used" panel) and has a test.**

## Boundary rules (enforced in `eslint.config.mjs`)

1. `src/core/**` may not import `react`, `react-dom`, `next`, `motion`, `@xyflow/*`, or
   anything in `src/components`, `src/modules`, `src/app`.
2. `src/core/**` may not call `Math.random`, `Date.now`, `new Date()` or
   `performance.now`. Use the seeded rng.
3. `src/modules/<a>/**` may not import `src/modules/<b>/**`. Exception: `compare` may
   import `src/modules/scheduling/index.ts` only.
4. `src/components/**` may not import `src/modules/**` (except `registry.ts`).
5. `@xyflow/react` only under `src/modules/deadlock/**`.

`tests/lint-boundaries.test.ts` proves rules 1, 2 and 5 fire. Don't weaken a rule; move
the code.

## Commands

- `npm run dev` — dev server on :3000
- `npm run verify` — lint, typecheck, unit tests, build. Must pass before every commit.
- `npm run test` — Vitest: `core` project (node: `src/core`, `tests/`) and `ui`
  project (jsdom: `src/components`, `src/modules`, `src/lib`)
- `npm run test:e2e` — Playwright + axe against a production build on :3100
  (Chromium locally, three browsers in CI)
- `npm run format` / `format:check` — Prettier

fast-check uses a fixed global seed (`tests/setup-core.ts`); `FC_SEED=<n>` overrides it.

## Rules for parallel agents

- Each parallel agent gets its own git worktree and branch
  (`git worktree add ../osv-<name> -b feat/<name>`). Merge one branch at a time at the
  end of a wave; run `npm run verify` after each merge.
- An agent only touches its own folders: `src/core/<name>/`, `src/modules/<name>/`,
  `src/app/(modules)/<route>/`, `tests/fixtures/<name>/`, `tests/oracle/<name>.test.ts`.
- Shared files a module agent may edit are **append-only**:
  `src/core/citations/index.ts`, `src/core/scenarios.ts`, `src/core/state/modules.ts`
  (one import line each), `src/modules/registry.ts` (flip its own `status`) and
  `tests/fixtures/README.md` (its own rows). Resolve conflicts there by keeping both
  sides.
- If an agent needs to change a shared contract (event types, the timeline, a shared
  component), it stops and reports instead of changing it.
