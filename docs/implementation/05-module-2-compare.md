# 05 — Module 2: Compare schedulers

Wave: **W4** · Estimate: 1.5 days · Original plan: phase 1 (Compare)

## Goal

Run one workload under 2–4 scheduling policies at once and see the difference: one Gantt
chart per policy on a shared time axis, one shared cursor, and a side-by-side metrics
table. This is where the trade-offs (turnaround vs response, fairness vs throughput)
become visible.

## Prerequisites

04 (core and UI), 03.

---

## Deliverables

```
src/core/sched/compare.ts        compare(workload, policies[]) => CompareResult
src/modules/compare/             CompareView, PolicyColumns, index.ts
src/app/(modules)/compare/page.tsx
tests/compare.test.ts
```

---

## Steps

### 1. Core (`compare.ts`)

`compare(workload, policies)` runs `schedule` once per policy (2–4) and returns
`{ runs: SimResult<SchedEvent>[], durationTicks: max over runs, metrics: table }`. No new
scheduling logic lives here. The comparison timeline is a **tick run of length
`durationTicks`**, one phase per tick, so the shared playback drives every chart; a run
that has already finished shows as complete.

### 2. UI

- Workload editor is the one from the scheduling module (imported through
  `src/modules/scheduling/index.ts`, the only allowed cross-module import). Policy
  columns: add/remove (2–4), each with its own parameters, including two of the same
  policy with different settings (RR q=1 vs q=4).
- One `GanttChart` per policy, stacked, same x-scale, following the shared cursor.
- `MetricsTable`: rows = average waiting, turnaround, response, utilisation, throughput,
  context switches; columns = policies; best per row marked with an icon and text.
- A "Why?" line under the table, generated from the metrics, not hand-written per preset
  ("SRTF has the lowest average waiting time; RR q=2 has the lowest average response time").
- Presets: *FCFS vs SJF vs SRTF* on the convoy workload, *RR quantum sweep* (1, 2, 4, 8
  with CS cost 1), *response vs turnaround* (SJF vs RR), *MLFQ vs RR* with an I/O-bound job.
- `?s=` holds the workload and the list of policies.

### 3. Tests

- `compare` results equal running `schedule` separately for each policy (deep-equal).
- The "Why?" sentence names the policy that is actually best per row (property test over
  seeded workloads).
- e2e: load the RR quantum sweep, step to the end, check the context-switch row decreases
  as the quantum grows; axe.

---

## Acceptance criteria

- [ ] 2–4 policies, same workload, one shared cursor, charts aligned on one axis
- [ ] Metrics table matches the scheduling module's numbers for each policy
- [ ] Every chart and the table have text alternatives; keyboard only works
- [ ] Presets are in the scenario catalogue; URL round-trips
- [ ] `npm run verify` and `npm run test:e2e` pass

---

## Prompts to execute

### Prompt 5.1 — Compare core and UI

```
Read docs/implementation/00-overview.md, 04-module-1-cpu-scheduling.md and
05-module-2-compare.md. Then read src/core/sched and src/modules/scheduling/index.ts.

Add src/core/sched/compare.ts (no new scheduling logic; one timeline of length
max-duration driving every run) with its tests. Build src/modules/compare and the
/compare route: 2-4 policy columns, stacked Gantt charts sharing one cursor and x-scale,
the MetricsTable with best-per-row markers, the generated "Why?" line, the four presets
and ?s= state. Import from the scheduling module only through its index.ts.

Flip the registry entry to 'ready'. Add the e2e test from step 3 with axe.
Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```
