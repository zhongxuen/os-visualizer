# 04 — Module 1: CPU scheduling

Wave: **W2** (4.core-a), **W3** (4.core-b, 4.ui) · Estimate: 1 week · Original plan: phase 1

## Goal

Build a set of processes, pick a policy, and watch the Gantt chart form tick by tick with
the reason for every scheduling decision. FCFS, SJF, SRTF, Priority (preemptive and
non-preemptive, optional aging), Round Robin and MLFQ, all from one pure tick-based
kernel, all matching the textbook numbers.

## Prerequisites

02 for the core prompts. 03 (both prompts) for the UI prompt.

---

## Deliverables

```
src/core/sched/
  workload.ts        Zod schema + limits for Workload and PolicyConfig
  kernel.ts          the shared tick loop: arrivals, I/O, dispatch, context switch, metrics
  policies/          fcfs.ts sjf.ts srtf.ts priority.ts rr.ts mlfq.ts   (each: pick/preempt rules)
  schedule.ts        schedule(workload, policy) => SimResult<SchedEvent>
  metrics.ts         per-process and aggregate metrics
  rules.ts           the conventions list shown in the RulesPanel
  presets.ts  events.ts  citations.ts  scenarios.ts  state.ts  index.ts
tests/fixtures/sched/*.test.ts
tests/oracle/sched.test.ts       (property tests)
src/modules/scheduling/          WorkloadEditor, PolicyPicker, SchedulingView, index.ts
src/app/(modules)/scheduling/page.tsx
```

---

## Steps

### 1. Workload model

```ts
Process  { pid: string /* 'P1'..'P10' */; arrival: int >= 0; bursts: int[] /* CPU, IO, CPU, ... odd length, each >= 1 */; priority: int 0..9 }
Workload { processes: Process[] /* 1..10 */; contextSwitch: int 0..3 }
Policy   = { kind: 'fcfs' } | { kind: 'sjf' } | { kind: 'srtf' }
         | { kind: 'priority'; preemptive: boolean; aging?: { every: int; by: int } }
         | { kind: 'rr'; quantum: int 1..10 }
         | { kind: 'mlfq'; levels: { quantum: int; allotment: int }[] /* 2..4 */;
             boostEvery?: int; rule4: 'allotment' | 'original' }
```

Limits: total simulated time ≤ 300 ticks (the kernel stops with an explicit "limit
reached" event rather than running forever). A single CPU burst is the default; I/O
bursts are opt-in per process.

### 2. The tick loop and its conventions (`kernel.ts`, `rules.ts`)

One loop for every policy. Policies only decide *who is picked* and *whether the running
process is preempted*. At each tick `t`, in this order:

1. Processes arriving at `t` join the ready queue, **lowest PID first**.
2. Processes whose I/O completes at `t` join the ready queue, lowest PID first.
3. If the running process finished its CPU burst, it leaves (to I/O or done).
   If its quantum expired (RR, MLFQ), it goes to the **tail** of its queue **after** the
   arrivals from steps 1–2 (the Silberschatz/OSTEP convention).
4. Preemptive policies check whether a ready process should preempt the running one.
   **Equal keys never preempt** (SRTF with equal remaining time keeps the running process).
5. If the CPU is free, the policy picks the next process. Ties: **lower PID first**.
6. A context switch costs `contextSwitch` ticks, charged whenever the CPU starts running a
   process other than the one that ran last. **The very first dispatch is free.** CS ticks
   are neither busy nor idle.
7. The running process (if any) runs for one tick; otherwise the tick is idle.

Other fixed rules: lower `priority` number = higher priority. SJF/SRTF use the length of
the *next CPU burst* (known in advance, as the textbooks assume). Aging lowers the
priority number of a ready process by `by` for every `every` ticks it has waited, floored
at 0, reset when it runs. MLFQ follows OSTEP rules 1–5: new jobs enter the top queue;
with `rule4: 'allotment'`, time used at a level is accumulated across I/O and the job is
demoted when it reaches the allotment; with `rule4: 'original'` (OSTEP rules 4a/4b), a
job that gives up the CPU before its quantum ends keeps its level; `boostEvery` moves every
job to the top queue.

`rules.ts` exports these rules as data. The RulesPanel renders them, and each rule has at
least one test named after it.

### 3. Events

```ts
SchedEvent =
  | { kind: 'sched.arrive' | 'sched.ioStart' | 'sched.ioDone' | 'sched.dispatch'
          | 'sched.preempt' | 'sched.quantumExpired' | 'sched.demote' | 'sched.boost'
          | 'sched.age' | 'sched.contextSwitch' | 'sched.run' | 'sched.idle'
          | 'sched.finish' | 'sched.limit'; pid?: string; ... } & EventBase & { state: SchedSnapshot }
SchedSnapshot = { tick; running: pid | null; queues: pid[][]; io: { pid, until }[];
                  remaining: Record<pid, number>; levels?: Record<pid, number>;
                  segments: { pid | 'idle' | 'cs', start, end, level? }[] }
```

Every `dispatch` and `preempt` label says why ("P3 runs: shortest next burst (2)").
A phase starts at each dispatch ("P2 runs, t = 4–7"), so Shift+→ jumps segment to segment.

### 4. Metrics (`metrics.ts`)

Per process: completion, **turnaround = completion − arrival**, **waiting = turnaround −
total CPU − total I/O** (time in ready queues, including time lost to context switches),
**response = first run − arrival**. Aggregate: averages, CPU utilisation = busy ticks /
total ticks, throughput = processes / total ticks, context-switch count. The definitions
are shown next to the table.

### 5. Presets (`presets.ts`)

Textbook examples (each also a fixture), plus: *convoy effect* (FCFS, one long job
first), *SJF starvation* (a stream of short jobs), *RR quantum too small* (with CS cost 1),
*RR quantum too big* (= FCFS), *priority starvation* (run with and without aging),
*MLFQ interactive vs batch* (I/O-bound job keeps high priority), *MLFQ gaming* (old rule 4,
then new), *MLFQ boost*.

### 6. Tests

Worked examples — record each in `tests/fixtures/README.md` with book, edition, section
and the expected numbers. Check section numbers against the edition when writing them:

| Source | Example | Expected |
|---|---|---|
| OSC10 §5.3.1 | FCFS P1=24, P2=3, P3=3 (all t=0) | avg waiting 17; order P2,P3,P1 → 3 |
| OSC10 §5.3.2 | SJF P1=6, P2=8, P3=7, P4=3 | avg waiting 7 |
| OSC10 §5.3.2 | SRTF arrivals 0,1,2,3 bursts 8,4,9,5 | avg waiting 6.5 |
| OSC10 §5.3.3 | RR q=4, P1=24, P2=3, P3=3 | avg waiting 17/3 ≈ 5.67 |
| OSC10 §5.3.4 | Priority, bursts 10,1,2,1,5, priorities 3,1,4,5,2 | avg waiting 8.2 |
| OSTEP §7.3–7.5 | A=100, B=10, C=10: FCFS / SJF | avg turnaround 110 / 50 |
| OSTEP §7.5 | STCF: A=100 at 0, B,C=10 at 10 | avg turnaround 50 |
| OSTEP §7.7 | A,B,C=5, RR slice 1 vs SJF | avg response 1 vs 5 |
| OSTEP ch. 8 | MLFQ figures (single long job; with short job; with I/O; boost; gaming) | segment layouts match the figures |

Property tests (fast-check, random valid workloads, every policy):

- At most one process runs per tick; a process never runs before it arrives or while in I/O.
- Every process finishes (within the limit), and its run ticks equal its CPU bursts.
- **Total ticks = Σ CPU bursts + idle ticks + context-switch ticks.**
- With `contextSwitch = 0` and no I/O: FCFS, SJF and non-preemptive priority never
  preempt; SRTF's average waiting ≤ every other policy's on the same workload (SRTF is
  optimal for average waiting time with all bursts known).
- RR with quantum ≥ longest burst produces the same segments as FCFS.
- MLFQ with one level behaves as RR with that quantum.
- `waiting ≥ 0`, `response ≤ waiting` for single-burst processes, `turnaround ≥ Σ bursts`.

---

## Acceptance criteria

- [ ] Every textbook example in the table passes and is listed in `tests/fixtures/README.md`
- [ ] Every rule in `rules.ts` has a named test
- [ ] Property tests pass on 500 seeded workloads per policy
- [ ] Every preset is in the scenario catalogue (determinism + citation tests cover it)
- [ ] `/scheduling`: edit a workload (form, keyboard only), pick a policy, step through;
      Gantt, queues, inspector and metrics stay in sync; "Show as table" works
- [ ] The URL reproduces the workload, policy and step; the workload can be saved locally
- [ ] axe clean; `npm run verify` passes

---

## Prompts to execute

### Prompt 4.core-a — kernel and the five simple policies (wave W2)

```
Read docs/implementation/00-overview.md and docs/implementation/04-module-1-cpu-scheduling.md.

In src/core/sched only: implement the Zod workload/policy schema with its limits, the
shared tick loop in kernel.ts with the conventions in step 2 exactly as written, rules.ts,
metrics.ts, and the FCFS, SJF, SRTF, Priority (preemptive, non-preemptive, aging) and RR
policies. Replace the placeholder events.ts with SchedEvent/SchedSnapshot (step 3); every
dispatch/preempt label says why. Add citations (OSTEP ch. 7, OSC10 ch. 5), the presets
that don't need MLFQ, scenarios.ts and the share-state branch in state.ts.

Write the OSC10 and OSTEP ch. 7 worked-example tests from step 6 (record each in
tests/fixtures/README.md), one named test per rule, and the property tests in
tests/oracle/sched.test.ts. Don't touch shared files except the append-only ones.

Done when `npm run verify` passes. Commit on feat/sched-core.
```

### Prompt 4.core-b — MLFQ (wave W3)

```
Read docs/implementation/04-module-1-cpu-scheduling.md, then src/core/sched.

Add the MLFQ policy (src/core/sched/policies/mlfq.ts) using the existing kernel: 2-4
levels with quantum and allotment per level, OSTEP rules 1-5, the rule4 'allotment' vs
'original' toggle, and priority boost. Emit demote and boost events and MLFQ levels in the
snapshot. Add the MLFQ presets (interactive vs batch, gaming with old then new rule 4,
boost), OSTEP ch. 8 citations and fixtures reproducing the chapter's figures, and the
"one level = RR" property.

If the kernel needs a change to support MLFQ, keep existing tests green and explain the
change in the commit. Done when `npm run verify` passes. Commit.
```

### Prompt 4.ui — the scheduling module (wave W3, after 3.2)

```
Read docs/implementation/04-module-1-cpu-scheduling.md and 03-ui-shell-and-visual-blocks.md.

Build src/modules/scheduling and the /scheduling route using only shared components:
WorkloadEditor (add/remove processes, arrival, bursts incl. optional I/O, priority, CS cost;
fully keyboard operable; validation messages from the Zod schema), PolicyPicker (with
quantum, aging and MLFQ level controls), preset menu, GanttChart (MLFQ lanes when
relevant), QueueView, StepInspector, RulesPanel and MetricsTable with the metric
definitions. Wire useShareState and "Save workload" via useProgress. Export the renderers
Compare will reuse from src/modules/scheduling/index.ts.

Flip the registry entry to 'ready'. Add an e2e test that loads the OSC10 SJF preset, steps
to the end with the keyboard and checks the average waiting time reads 7, plus axe.
Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```
