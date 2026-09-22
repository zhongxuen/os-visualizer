# OS Visualizer — Implementation Plan

Written: 2026-09-22
Status: **[planned]**
Series: Visualizer Series (Operating Systems)
Repo: new, `os-visualizer`. Hosting: its own Vercel project. **No database**

---

## 1. Pitch

The parts of an operating system that textbooks draw as static diagrams, made into something you can step through. Build a set of processes, pick a scheduler and watch the Gantt chart form tick by tick. Translate an address through page tables and a TLB. Build a deadlock and watch the detector find the cycle.

---

## 2. Modules

| Module | Stepping through | Metrics shown | Reference |
|---|---|---|---|
| **1. CPU Scheduling** | FCFS, SJF, SRTF, Priority (with aging), Round Robin (quantum slider), MLFQ (configurable queues + priority boost) | Waiting, turnaround and response time per process and on average, CPU utilisation, context switches | OSTEP ch. 7–8 |
| **2. Compare** | The same workload run under 2–4 schedulers at once, one Gantt chart each | Side-by-side metrics table | — |
| **3. Address Translation** | Virtual address → split into VPN/offset → TLB lookup (hit/miss) → page table walk (1 or 2 levels) → frame → physical address | TLB hit rate, memory references per access | OSTEP ch. 18–20 |
| **4. Page Replacement** | A reference string over N frames: FIFO, LRU, OPT, Clock | Page faults, Belady's anomaly demo (FIFO 3 vs 4 frames) | OSTEP ch. 22 |
| **5. Deadlock** | A resource-allocation graph you build by dragging. Detection (cycle / Banker's safety algorithm, with the Need matrix shown), avoidance (Banker's grants or refuses a request), and the four Coffman conditions ticked off live | Safe sequence, or none | OSTEP ch. 32; Silberschatz ch. 8 |
| **6. Synchronisation** (phase 2) | Two threads interleaving on a shared counter → a race → a mutex fixes it. Producer/consumer with semaphores | Final counter value vs expected | OSTEP ch. 26–31 |

---

## 3. Architecture

Same kernel pattern as Internet Visualizer (copy the timeline + event stream into `src/vendor/`):

```
src/core/
  sched/     schedule(workload, policy) => SchedEvent[]   (tick-based, pure)
  vm/        translate(addr, pageTable, tlb) => VmEvent[]
  replace/   run(refString, frames, policy) => ReplEvent[]
  deadlock/  detect(graph) / bankers(state, request) => DlEvent[]
src/modules/<n>/   UI renderers
```

- Every policy is a pure function over the workload, with ties broken deterministically (lower PID first, stated in the UI).
- Workloads are Zod-validated JSON. Presets include "convoy effect", "starvation under SJF" and "RR quantum too small".
- Stepping works on clock ticks. Step back re-derives the state from the event log, so it can never get out of sync.
- React Flow for the deadlock graph. A custom SVG for the Gantt chart and page tables.

---

## 4. Correctness

- **Textbook-worked-example tests:** each algorithm is checked against its worked examples in OSTEP / Silberschatz. Record the exact example and page number in `tests/fixtures/README.md`.
- **Invariant/property tests** (fast-check, seeded): only one process runs per tick. Total runtime equals the sum of bursts plus idle time. OPT never faults more than LRU or FIFO. Banker's algorithm never grants a request that leads to an unsafe state.
- Determinism test and a citations test, as in the rest of the series.

---

## 5. Data and state

Everything runs in the browser. Custom workloads and graphs are stored in `localStorage` (`osv:v1`) and can be shared as `?w=<base64url>`. No database.

---

## 6. Honest disclaimers (draft)

- "Models the textbook algorithms, not a real kernel. There are no interrupts, I/O queues, multicore or real hardware timings, and context switches cost a fixed, configurable number of ticks."
- "MLFQ follows the rules as OSTEP states them. Real schedulers (Linux CFS/EEVDF, Windows) are described in lessons, not simulated."

---

## 7. Phases

| Phase | Deliverable | Estimate |
|---|---|---|
| 0 | Scaffold, vendored timeline, Gantt component | 2 days |
| 1 | Scheduling (all policies) + Compare | 1.5 weeks |
| 2 | Address translation + page replacement | 1.5 weeks |
| 3 | Deadlock (graph editor, detection, Banker's) | 1 week |
| 4 | Lessons, accessibility pass, portfolio entry | 3–4 days |
| 5 (later) | Synchronisation module | 1 week |

---

## 8. Portfolio entry (draft)

technologies: Next.js, TypeScript, React, Tailwind CSS, Zustand, React Flow, Vitest, Playwright. Highlight: one pure scheduling kernel behind every policy, property-tested invariants, and side-by-side policy comparison.
