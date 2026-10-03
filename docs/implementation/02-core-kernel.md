# 02 — Core kernel: playback, events, citations, URL state

Wave: **W1** · Estimate: 1–1.5 days · Original plan: phase 0 (second half)

## Goal

The contracts every module builds on: the vendored playback kernel, a local `SimResult`,
the `OsEvent` type and run builder, the citation registry, the URL share-state codec and
the scenario catalogue. After this phase, algorithm cores can be written in parallel
without talking to each other.

## Prerequisites

01.

---

## Deliverables

```
VENDORED.md
src/core/sim/            playback.ts  rng.ts   (vendored, unchanged)  result.ts (local)
src/core/events/         types.ts  builder.ts  index.ts
src/core/citations/      types.ts  registry.ts  index.ts  general.ts
src/core/state/          shareState.ts  schema.ts  modules.ts
src/core/scenarios.ts    scenario catalogue (empty, filled by modules)
src/core/{sched,vm,replace,deadlock}/   events.ts  citations.ts  scenarios.ts  state.ts  (placeholders)
tests/determinism.test.ts
tests/citations.test.ts
```

---

## Steps

### 1. Vendor the kernel

Copy `src/core/sim/playback.ts` and `rng.ts` (and their tests) from
`../internet-visualizer` at commit `59ae4ad`. Don't edit them. Record source path, commit
and reason in `VENDORED.md`.

**Don't copy `result.ts`.** Internet Visualizer's version imports its PDU and packet event
types. Write a local `src/core/sim/result.ts` that exports the same names `playback.ts`
imports, with the same shape minus PDUs:

```ts
export interface TimedEvent { at: number }       // virtual ms
export interface PhaseSummary { index; id; title; description; startMs; endMs; plain? }  // same as IV
export interface SimResult<E extends TimedEvent = TimedEvent> {
  events: E[]; phases: PhaseSummary[]; durationMs: number;
}
export function summarizePhases(...)             // same semantics as IV: half-open [startMs, endMs)
```

The default type parameter lets the vendored `import type { SimResult } from './result'`
compile unchanged. Note this in `VENDORED.md` ("result.ts is a local re-implementation of
the same contract"). Add a test that the vendored `timelineFrom` accepts a local result.

### 2. Two kinds of run, one builder

- **Tick runs** (scheduling, synchronisation): one tick = `TICK_MS = 1000` virtual ms, so
  1× speed is one tick per second.
- **Step runs** (translation, replacement, deadlock): step *n* starts at `n * STEP_MS`,
  `STEP_MS = 800`.

`builder.ts` exports `createRun<E>({ unit: 'tick' | 'step' })` with `emit(event)`,
`phase(id, title, description)` (starts a new phase at the current position),
`advance(n = 1)` and `finish(): SimResult<E>`. Several events may share one tick.

### 3. `OsEvent` (the shared contract)

A discriminated union. Each module owns its own variants, declared in its own folder and
joined here:

```ts
// src/core/events/types.ts
export interface EventBase extends TimedEvent {
  id: string;              // stable within a run: `${module}.${phase}.${index}`
  label: string;           // one short sentence, plain language, says *why*
  detail?: string;         // optional longer explanation
  citation: CitationId;    // must resolve in the registry
}
export type OsEvent = SchedEvent | VmEvent | ReplEvent | DlEvent;
```

**Events carry snapshots.** Each variant includes the full module state after the event
(`state: SchedSnapshot` etc.), so stepping to any index is a lookup and step back can
never drift. Input limits in each module's Zod schema keep this small.

To let W2 agents work in parallel, this phase creates **placeholder** files
`src/core/<name>/events.ts` exporting
`type <Name>Event = EventBase & { kind: '<name>.placeholder' }`. Each core prompt replaces
its own placeholder. Nobody edits `types.ts` after this phase.

### 4. Citations

```ts
export type CitationId = string; // e.g. 'ostep.8.3', 'osc10.8.6.3'
export interface Citation {
  id: CitationId;
  source: 'OSTEP' | 'OSC10';      // OSTEP v1.10; Silberschatz, Operating System Concepts 10th ed.
  chapter: number; section?: string; title: string; url?: string;
}
```

OSTEP citations must have a `url` (the chapter PDF on pages.cs.wisc.edu/~remzi/OSTEP/).
OSC10 has no free URL; `url` is optional for it. Each module has its own
`src/core/<name>/citations.ts` exporting a `Citation[]`; `citations/index.ts` imports them
all (one line each, append-only). `general.ts` holds shared citations (e.g. the process
model, OSTEP ch. 4).

### 5. Share state

`?s=<base64url(JSON)>`. The schema is a Zod discriminated union keyed by module
(`{ m: 'sched', v: 1, step, input: {...} }`). Each module declares its branch in its own
`state.ts` and registers it in `state/modules.ts` (one line, append-only). Invalid or
oversized (> 4 KB) state falls back to the module default and never throws. base64url is
hand-written in core (no `Buffer`, no `btoa`) and tested against `Buffer` in tests.

### 6. Scenario catalogue, determinism and citation tests

`src/core/scenarios.ts` concatenates each module's `scenarios.ts`, a list of
`{ id, title, run: () => SimResult<OsEvent> }`. Every preset in the product must be in
here.

- `tests/determinism.test.ts`: runs every scenario twice; results must be
  `toStrictEqual`. Also serialises each result to JSON and back and checks equality (no
  `undefined`, `Map` or class instances in events, so snapshots survive the URL/share path).
- `tests/citations.test.ts`: every event in every scenario has a `citation` that exists in
  the registry; every OSTEP citation has a URL.

Both pass on an empty catalogue and gain coverage as modules land.

---

## Acceptance criteria

- [ ] `playback.ts` and `rng.ts` are byte-identical to the source commit; `VENDORED.md`
      says so and explains the local `result.ts`
- [ ] `createRun` output is accepted by the vendored `timelineFrom` for both units (test)
- [ ] Share-state encode→decode is identity; garbage and oversized input return the default
- [ ] Placeholder `events.ts`, `citations.ts`, `scenarios.ts` and `state.ts` exist for
      sched, vm, replace and deadlock
- [ ] `npm run verify` passes

---

## Prompts to execute

### Prompt 2.1 — vendor kernel, result, events, citations

```
Read docs/implementation/00-overview.md and docs/implementation/02-core-kernel.md.

Vendor src/core/sim/playback.ts and rng.ts (and their tests) from ../internet-visualizer
(commit 59ae4ad) without edits. Write a local src/core/sim/result.ts with the same
SimResult/PhaseSummary/summarizePhases contract minus PDUs, as step 1 describes, and
record all of it in VENDORED.md.

Build src/core/events (EventBase, the OsEvent union, createRun with tick and step units)
and src/core/citations exactly as steps 2-4 specify, including the placeholder events.ts
and citations.ts for sched, vm, replace and deadlock, so later agents can work in
parallel without touching shared files.

Done when `npm run verify` passes. Commit.
```

### Prompt 2.2 — share state, scenarios, determinism and citation tests

```
Read docs/implementation/02-core-kernel.md steps 5-6.

Implement src/core/state (Zod share-state codec, per-module registration via
state/modules.ts, hand-written base64url, 4 KB limit, safe fallback) with placeholder
state.ts files for each module. Add src/core/scenarios.ts with per-module placeholder
scenarios.ts files, tests/determinism.test.ts (twice-run toStrictEqual plus a JSON
round-trip) and tests/citations.test.ts.

Done when `npm run verify` passes. Commit.
```
