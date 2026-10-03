# OS Visualizer — Implementation Roadmap

Written: 2026-09-22
Status: **[planned]**
Series: Visualizer Series (Operating Systems)
Repo: `os-visualizer`. Hosting: its own Vercel project. **No database.**
Shared decisions for all five portfolio projects: [../README.md](../README.md)

This folder replaces the single `docs/os-visualizer-plan.md`. The content is the same
plan, reviewed against the project aims and split into phases that can be run as separate
Claude Code prompts. The changes made during that review are listed in
[§6](#6-changes-from-the-original-plan).

Each numbered file is **one self-contained phase** with the same shape:

1. **Goal** — what exists at the end of the phase
2. **Prerequisites** — which phases must be done first
3. **Deliverables** — files created or changed
4. **Steps** — the work, in order
5. **Acceptance criteria** — how you know the phase is done
6. **Prompts to execute** — copy-paste prompts for Claude Code, one per chunk of work

---

## 1. Pitch

The parts of an operating system that textbooks draw as static diagrams, made into
something you can step through. Build a set of processes, pick a scheduler and watch the
Gantt chart form tick by tick. Translate an address through page tables and a TLB. Build a
deadlock and watch the detector find the cycle.

**Portfolio gap it fills:** the Operating Systems course. It is the third project in the
Visualizer Series, after Internet Visualizer and Crypto Visualizer, and uses the same
kernel pattern, timeline and quality bar.

## 2. Project aims

Every phase is judged against these. If a task doesn't serve one of them, it's out of scope.

1. **Teach by stepping.** Every algorithm advances one tick or one step at a time, forwards
   and backwards, on the shared timeline, with the reason for each decision shown ("P3
   runs: shortest remaining time, 2 ticks").
2. **Be provably correct.** Each algorithm is checked three ways: the textbook worked
   examples, property tests on invariants, and a brute-force oracle where one is feasible
   (OPT, Banker's safety, deadlock detection).
3. **Be deterministic and shareable.** Every tie-break and ordering rule is written down,
   shown in the UI, and tested. Same input = the same run, and any workload or graph can
   be shared as a URL.
4. **Be useful for the course.** Workloads and graphs are editable, presets reproduce the
   classic textbook situations (convoy effect, starvation, Belady's anomaly, an unsafe
   state), and the metrics match the textbook definitions so a student can check homework.
5. **Be honest.** Say plainly that these are the textbook algorithms, not a real kernel,
   and which modelling conventions were chosen where textbooks disagree.
6. **Match the portfolio's quality bar.** Pure core, boundary lint rules, axe on every
   route, keyboard-only operation (including the deadlock graph), reduced motion, a JS
   budget per route.

## 3. Modules

| # | Module | What you step through | Metrics shown | Reference |
|---|---|---|---|---|
| 1 | **CPU Scheduling** | FCFS, SJF, SRTF, Priority (preemptive or not, optional aging), Round Robin (quantum slider), MLFQ (configurable queues, quantum and allotment per level, priority boost). Optional I/O bursts. Configurable context-switch cost | Waiting, turnaround and response time per process and on average, CPU utilisation, throughput, context switches | OSTEP ch. 7–8; Silberschatz ch. 5 |
| 2 | **Compare** | The same workload under 2–4 schedulers at once, one Gantt chart each on a shared time axis and a shared cursor | Side-by-side metrics table, best value per row marked | — |
| 3 | **Address Translation** | Virtual address → VPN/offset split → TLB lookup (hit/miss) → page-table walk (1 or 2 levels) → valid and protection checks → frame → physical address. A page-table size calculator (linear vs two-level) | TLB hit rate, memory references per access | OSTEP ch. 18–20 |
| 4 | **Page Replacement** | A reference string over N frames: FIFO, LRU, OPT, Clock. Faults-vs-frames curve for every policy. Generated workloads (no locality, 80/20, looping) | Page faults, hit rate, Belady's anomaly (FIFO, 3 vs 4 frames) | OSTEP ch. 22; Silberschatz ch. 10 |
| 5 | **Deadlock** | A resource-allocation graph (single- and multi-instance resources) built with a form or by dragging. Cycle detection, the detection algorithm, Banker's safety and request algorithms with the Need matrix shown, and recovery (terminate or preempt). The four Coffman conditions shown live | Safe sequence, or the deadlocked set | OSTEP ch. 32; Silberschatz ch. 8 |
| 6 | **Synchronisation** *(phase 2)* | Two threads interleaving load/add/store on a shared counter → a race → a mutex fixes it. Producer/consumer with semaphores. Count of interleavings that give the wrong answer | Final value vs expected | OSTEP ch. 26–31 |

v1 = modules 1–5. Module 6 is phase 2.

## 4. Phase index and waves

| File | Phase | Depends on | Wave |
|---|---|---|---|
| [01](./01-scaffolding-and-tooling.md) | Scaffolding, tooling, boundary rules | — | W0 |
| [02](./02-core-kernel.md) | Core kernel: vendored playback, events, citations, URL state | 01 | W1 |
| [03](./03-ui-shell-and-visual-blocks.md) | UI shell, timeline UI, Gantt, bit field, frame strip, matrix | 02 | W2 / W3 |
| [04](./04-module-1-cpu-scheduling.md) | Module 1: CPU scheduling | 02 (core), 03 (UI) | W2 / W3 |
| [05](./05-module-2-compare.md) | Module 2: Compare | 04 core, 03 | W4 |
| [06](./06-module-3-address-translation.md) | Module 3: Address translation | 02 (core), 03 (UI) | W2 / W3 |
| [07](./07-module-4-page-replacement.md) | Module 4: Page replacement | 02 (core), 03 (UI) | W2 / W3 |
| [08](./08-module-5-deadlock.md) | Module 5: Deadlock | 02 (core), 03 (UI) | W2 / W3 |
| [09](./09-quality-and-release.md) | Lessons, quality, deploy, portfolio entry | 04–08 | W4 / W5 |
| [10](./10-module-6-synchronisation.md) | Module 6: Synchronisation *(phase 2)* | 09 | later |

Each module file has a `core` prompt (pure TypeScript + tests, no UI) and a `ui` prompt
(React module + route). Cores only need phase 02, so they can run long before the UI
exists. Scheduling is the largest core and is split into two prompts (4.core-a, 4.core-b).

### Running in waves

| Wave | Prompts (run the ones in one row in parallel) | Notes |
|---|---|---|
| **W0** | 1.1 → 1.2 | Sequential. Nothing else can start. |
| **W1** | 2.1 → 2.2 | Sequential. Defines the event, citation and share-state contracts. |
| **W2** | 3.1, 4.core-a, 6.core, 7.core, 8.core | Five parallel agents. Each core lives in its own `src/core/<name>/` folder. 3.1 is the only UI work. |
| **W3** | 3.2 first, then 4.core-b, 4.ui, 6.ui, 7.ui, 8.ui | 3.2 adds the shared components the UIs use. 4.core-b (MLFQ) and 4.ui both touch scheduling but different folders. |
| **W4** | 5.1, 9.1 | Compare needs the finished scheduling core. 9.1 writes lessons for modules that exist. |
| **W5** | 9.2 → 9.3 → 9.4 | Quality pass, deploy, portfolio entry. |
| **later** | 10.core → 10.ui | Phase 2. |

**Sequential alternative:** run the files in number order, core prompt then UI prompt.
That's the lowest-risk option for one person and takes about the same total effort.

### Rules for parallel agents

- Give each parallel agent its own git worktree and branch (`claude --worktree` or
  `git worktree add ../osv-<name> -b feat/<name>`). Merge one branch at a time at the end
  of the wave and run `npm run verify` after each merge.
- An agent only touches its own folders: `src/core/<name>/`, `src/modules/<name>/`,
  `src/app/(modules)/<route>/`, `tests/fixtures/<name>/` and `tests/oracle/<name>.test.ts`.
- The only shared files a module agent may edit are **append-only**:
  `src/core/citations/index.ts` (one import line), `src/core/scenarios.ts` (one import
  line), `src/core/state/modules.ts` (one import line), `src/modules/registry.ts` (flip
  its own entry's `status`) and `tests/fixtures/README.md` (its own rows). Merge conflicts
  there are one-line and resolved by keeping both sides. (`docs/ACCURACY.md` is written
  once, in 9.1, from every module's citations and rules.)
- If an agent needs to change a shared contract (event types, the timeline, a shared
  component), it stops and reports instead of changing it.

## 5. Architecture summary

Full detail is in phases 01 and 02.

```
src/core/            pure TS. No React, no DOM, no Math.random, no Date.now. Enforced by ESLint.
  sim/               playback.ts + rng.ts vendored from Internet Visualizer; result.ts local
  events/            OsEvent union, run builder (ticks or steps → SimResult)
  citations/         citation registry + per-module citation files
  state/             URL share-state codec (Zod), per-module branches
  scenarios.ts       every preset, for the determinism and citation tests
  sched/             schedule(workload, policy) => SchedRun        (tick-based)
  vm/                translate(config, addresses) => VmRun
  replace/           replace(refString, frames, policy) => ReplRun
  deadlock/          detect(graph) / safety(state) / request(state, req) => DlRun
  sync/              (phase 2) interleave(program, schedule) => SyncRun
src/components/      shared UI: timeline, Gantt, bit field, frame strip, matrix, inspector
src/modules/<name>/  one folder per module; renders events, never decides anything itself
src/app/             routes: /, /scheduling, /compare, /translation, /replacement,
                     /deadlock, /learn, /about   (later: /sync)
tests/fixtures/      textbook worked examples, each with book, edition, chapter, section
tests/oracle/        brute-force checks (OPT, Banker's, detection, address arithmetic)
```

Three kinds of test: **worked-example tests** (the textbook numbers), **property and
oracle tests** (invariants and brute force, seeded with fast-check), and **determinism +
citation tests** (every preset runs twice deep-equal; every event cites something that
resolves).

## 6. Changes from the original plan

The review against the aims above changed these things:

1. **Every modelling convention is written down.** Scheduling textbooks disagree on small
   rules that change the answer: whether a process preempted at the end of its quantum
   goes behind or ahead of a process arriving on the same tick, whether lower priority
   numbers mean higher priority, when a context-switch cost is charged. Phase 04 fixes one
   rule for each, shows them in a "Rules used" panel and tests them. Without this,
   "matches the textbook" can't be checked.
2. **Priority scheduling has both preemptive and non-preemptive variants**, and aging is a
   toggle with a configurable interval, so the starvation preset can be run with and
   without it.
3. **Optional I/O bursts.** A process may alternate CPU and I/O bursts (I/O is a fixed wait,
   no device queue). Without this, MLFQ can't show the one thing it exists for: an
   interactive job keeping high priority. The disclaimer changed from "no I/O" to "I/O is
   a fixed wait".
4. **MLFQ has a per-level allotment and an "old rule 4" toggle.** OSTEP's rule 4 is stated
   in terms of allotment, and its "gaming the scheduler" example needs the original rules
   4a/4b to show the problem the fix solves. A preset reproduces it.
5. **The runtime invariant was wrong.** "Total runtime equals the sum of bursts plus idle
   time" is only true with zero context-switch cost. It is now *CPU bursts + idle ticks +
   context-switch ticks*.
6. **Deadlock detection was conflated with Banker's.** A cycle means deadlock only when
   every resource has one instance. With multiple instances a cycle is necessary but not
   sufficient, so the module now runs the **detection algorithm** (Silberschatz §8.7.2,
   Available/Allocation/Request) separately from **Banker's safety** (which uses Need). A
   preset shows a cycle that is not a deadlock.
7. **Coffman conditions are shown honestly.** Mutual exclusion and no preemption are
   properties of the model, not things a graph can show. The panel marks them "assumed by
   the model" and only evaluates hold-and-wait and circular wait live, until the user
   preempts a resource.
8. **Recovery added to the deadlock module** (terminate a process, or preempt a resource,
   then re-run detection). Detection without a next step leaves the lesson unfinished, and
   it's a small addition.
9. **Keyboard access to the deadlock graph.** Dragging in React Flow is not keyboard
   accessible. The graph is edited through a form ("P2 requests 1 of R1") as well, and the
   drag editor is an extra.
10. **Oracle tests added.** There's no reference implementation to run a differential test
    against (unlike AES vs WebCrypto), so brute force plays that role: exhaustive search for
    the minimum faults on short strings (must equal OPT), all orderings for a safe
    sequence (must agree with Banker's), and plain arithmetic for address translation.
11. **LRU and OPT stack property tested.** Faults never increase with more frames for LRU
    and OPT. FIFO is exempt, which is what Belady's anomaly is. The page-replacement
    module plots faults vs frames for every policy so the anomaly is visible, not just
    stated.
12. **Textbook fixtures cite edition and section, not page numbers.** OSTEP is published as
    separate chapter PDFs whose page numbers change between versions. Fixtures record
    OSTEP v1.10 chapter + section, and Silberschatz *Operating System Concepts* 10th
    edition section + figure/example number.
13. **Share state uses `?s=`**, as the shared decisions doc specifies (the original plan
    said `?w=`). `localStorage` keeps the `osv:v1` key.
14. **Events carry snapshots.** "Step back re-derives state from the event log" becomes:
    each event carries the full (small) state after it, so stepping to any index is a
    lookup. Input limits (≤ 10 processes, ≤ 300 ticks, reference strings ≤ 40, ≤ 8
    processes × 5 resource types) keep this well under a megabyte.
15. **Vendoring is precise.** Internet Visualizer's `result.ts` imports its PDU and event
    types, so it can't be copied unchanged. `playback.ts` and `rng.ts` are vendored
    unchanged, and this repo writes its own `result.ts` with the same `SimResult` shape
    (events with `at`, `phases`, `durationMs`) without PDUs.
16. **A page-table size calculator** was added to module 3, because the reason for
    multi-level page tables (OSTEP ch. 20) is memory saved on a sparse address space,
    which a single translation doesn't show.
17. **The Gantt chart has a table view.** An SVG chart is not readable by a screen reader.
    Every chart has a "Show as table" toggle, and process colours are paired with labels
    and patterns so they are colour-blind safe.
18. **Accuracy doc and lessons defined.** `docs/ACCURACY.md` lists every source, as in
    Internet Visualizer. Each module has a guided walkthrough (MDX) with "predict the next
    step" checkpoints, plus a free-play mode. `/learn` tracks completion.
19. **The portfolio entry is its own prompt** (9.4), run inside the portfolio repo, not
    this one.
