# src/core

Pure TypeScript: the algorithms, the event/timeline contract, citations and URL share
state. Everything here runs in plain node and is tested in the Vitest `core` project.

## May import

- Other files in `src/core/**`
- `zod` (share-state codec)

## May not import (enforced in `eslint.config.mjs`)

- `react`, `react-dom`, `next`, `next/*`, `motion`, `@xyflow/*`
- `@/components/**`, `@/modules/**`, `@/app/**`

## May not call

- `Math.random` — use the vendored seeded rng in `sim/rng.ts` (phase 02)
- `Date.now`, `new Date()`, `Date()`, `performance.now` — time is the simulation tick

## Planned layout (phase 02 onwards)

```
sim/        playback.ts + rng.ts vendored from Internet Visualizer; result.ts local
events/     OsEvent union, run builder
citations/  citation registry + per-module citation files
state/      URL share-state codec (?s=), per-module branches
scenarios.ts
sched/  vm/  replace/  deadlock/  sync/
```

Every tie-break and ordering rule is written down, shown in the UI and tested.
