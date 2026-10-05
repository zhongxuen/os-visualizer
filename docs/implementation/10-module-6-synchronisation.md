# 10 — Module 6: Synchronisation *(phase 2)*

Wave: **later** · Estimate: 1 week · Original plan: phase 5

## Goal

Show why concurrency needs synchronisation by making a race happen on demand. Two threads
increment a shared counter as load/add/store steps; you choose the interleaving (or let a
seeded scheduler choose) and watch an update get lost. Add a mutex and the race goes away.
Then run producer/consumer on a bounded buffer with semaphores.

## Prerequisites

09 (v1 shipped). Uses the tick-run builder from 02 and the timeline from 03.

---

## Deliverables

```
src/core/sync/
  program.ts         Zod schema: threads as lists of micro-ops
  machine.ts         registers per thread, shared memory, lock and semaphore state
  interleave.ts      interleave(program, schedule) => SimResult<SyncEvent>
  explore.ts         enumerate every interleaving (small programs) and group by result
  rules.ts           conventions for the RulesPanel (id, text, plain, whyItMatters)
  presets.ts  events.ts  citations.ts  scenarios.ts  state.ts  index.ts
src/core/events/types.ts          add SyncEvent to the union (the one shared-contract edit)
tests/fixtures/sync/*.test.ts
tests/oracle/sync.test.ts
src/modules/sync/                 ThreadColumns, ScheduleBar, MemoryView, OutcomeHistogram
src/app/(modules)/sync/page.tsx
```

---

## Steps

### 1. Model

- Micro-ops: `load r, x`, `add r, k`, `store x, r`, `lock m`, `unlock m`,
  `wait s` (P), `signal s` (V), `yield`. Each is one tick. A thread blocked on a lock or
  semaphore can't be scheduled; the UI greys it out.
- **Schedules:** manual (click or press **A/B** to run the next op of thread A or B), round
  robin with a quantum, or seeded random (vendored rng; seed shown and shareable). The
  keys are A/B, not 1/2, because the shared timeline binds 1–5 to playback speed
  (`docs/UIUX.md` B6); they are added to `keymap.ts` and covered by its uniqueness test.
- The mutex is modelled as an atomic test-and-set lock (OSTEP §28.7) and its spin is
  shown; semaphores follow OSTEP §31 (value may not go negative in this model; waiters
  queue FIFO).
- `rules.ts` lists these conventions for the RulesPanel. Besides its `id` and formal
  `text`, every rule carries **`plain`** (one plain sentence for students) and
  **`whyItMatters`** (what changes if a book uses another convention, e.g. "A book whose
  semaphore value goes negative counts waiters there; the outcomes are the same")
  (`docs/UIUX.md` G4). They are text only and change no logic.

### 2. Exhaustive exploration (`explore.ts`)

For programs with ≤ 2 threads × ≤ 6 ops, enumerate every interleaving, run each, and group
by final state: "20 interleavings: 14 give 2, 6 give 1". Clicking a group loads one of its
interleavings into the stepper. This turns "a race *can* happen" into a count.

### 3. Presets

- *Counter race* (OSTEP §26.4): two threads, `counter++` as load/add/store.
- *Counter with a mutex*: every interleaving gives the expected value.
- *Forgotten unlock*: a thread holds the lock forever → the other blocks (links to the
  Deadlock module).
- *Lock ordering deadlock*: T1 locks A then B, T2 locks B then A.
- *Producer/consumer* (OSTEP §31.4) with `empty`, `full` and a mutex, buffer size 1 and 2;
  then the broken version with the mutex outside the semaphore waits (deadlocks).

### 4. Tests

- Worked examples: the counter race gives both correct and lost-update results for the
  schedules in OSTEP §26.4; the correct producer/consumer never under- or overflows.
- Oracle: `explore` on the unlocked counter finds at least one wrong result; with the
  mutex, every interleaving is correct.
- Properties: at most one thread is inside a critical section guarded by the mutex at any
  tick; semaphore value = initial + signals − completed waits; blocked threads never run.

---

## Acceptance criteria

- [ ] Manual, RR and seeded schedules all work and replay from the URL
- [ ] The outcome histogram matches brute force for every preset
- [ ] Mutual-exclusion and semaphore properties pass on seeded programs
- [ ] Manual thread keys are A/B, listed in `keymap.ts` and the ShortcutsSheet; no key
      clashes with the timeline's 1–5
- [ ] Every rule in `rules.ts` has a non-empty `plain` and `whyItMatters`
- [ ] UIUX §2.3 Y2: a lost update is visible: the overwritten value is struck through in
      MemoryView with a "lost update" label
- [ ] UIUX §7.2.6 animations, through the shared motion primitives only: the
      program-counter arrow steps down the ops; a blocked thread greys with a lock icon and
      a slow, reduced-motion-safe pulse; register and memory values roll (`<Ticker>`); the
      lock-owner chip moves between threads (FLIP); semaphore waiters queue as chips;
      histogram bars grow once and a clicked bar fills the schedule bar
- [ ] `/sync` is keyboard operable and axe clean; a lesson with checkpoints exists
- [ ] `npm run verify` and `npm run test:e2e` pass

---

## Prompts to execute

### Prompt 10.core — synchronisation core

```
Read docs/implementation/00-overview.md and docs/implementation/10-module-6-synchronisation.md.

Add SyncEvent to the OsEvent union in src/core/events/types.ts (the only shared-contract
change this module makes; explain it in the commit). In src/core/sync, implement the
program schema, the machine (per-thread registers, shared memory, test-and-set lock,
semaphores with FIFO waiters), interleave() as a tick run with manual, RR and seeded
schedules, explore() for exhaustive interleavings, and rules.ts (each rule with `plain`
and `whyItMatters` strings). Add OSTEP ch. 26-31 citations,
presets, scenarios.ts and the state.ts branch, and the tests in step 4.

Done when `npm run verify` passes. Commit on feat/sync-core.
```

### Prompt 10.ui — synchronisation module

```
Read docs/implementation/10-module-6-synchronisation.md, 03-ui-shell-and-visual-blocks.md
and docs/UIUX.md §2.2, §2.3 (Synchronisation), §6 and §7.2.6.

Build src/modules/sync and the /sync route inside the shared workspace: ThreadColumns
(ops with a program counter, blocked state; thread chips are rounded squares),
ScheduleBar (manual keys A/B registered in keymap.ts, RR, seeded), MemoryView (shared
variables, lock owner, semaphore values and wait queues; a lost update strikes through
the overwritten value with a "lost update" label), and OutcomeHistogram from explore(),
which loads an interleaving when clicked. Use StepInspector (Rule-used chip) and
RulesPanel. Presets first, Edit reveals controls; one human validation message per field.
Wrap the first use of each glossary term (race condition, critical section, mutex,
semaphore, interleaving, …; add any missing ones to src/content/glossary.ts) in <Term>.
Add every animation in UIUX §7.2.6 through the shared motion primitives only. Supply the
EndOfRunCard's "Try this next" preset and a link to /deadlock. Add the lesson MDX at
/learn/sync with checkpoints, update docs/ACCURACY.md, and flip the registry entry to
'ready'.

e2e: on the counter race, find a lost update using only the keyboard (A/B) and check it
is struck through; then load the mutex preset and check the histogram has a single
outcome; check pressing 1-5 changes speed, not the thread; the reduced-motion e2e; axe.
Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```
