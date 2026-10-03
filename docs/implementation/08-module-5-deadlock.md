# 08 — Module 5: Deadlock

Wave: **W2** (8.core), **W3** (8.ui) · Estimate: 1 week · Original plan: phase 3

## Goal

Build a resource-allocation graph and watch the system decide whether it is deadlocked:
cycle detection for single-instance resources, the detection algorithm for multi-instance
ones, then recovery. Separately, run Banker's algorithm on a Max/Allocation/Need/Available
state and watch it grant or refuse a request. The four Coffman conditions are shown live,
honestly.

## Prerequisites

02 for the core prompt. 03 for the UI prompt.

---

## Deliverables

```
src/core/deadlock/
  model.ts           Zod schema: processes (≤ 8), resource types (≤ 5, 1..10 instances each),
                     assignment and request edges; matrices derived from the graph
  graph.ts           wait-for graph, cycle detection (deterministic DFS)
  detect.ts          detection algorithm (Available, Allocation, Request)       OSC10 §8.7
  bankers.ts         safety algorithm and resource-request algorithm (Max, Need)  OSC10 §8.6.3
  recover.ts         terminate a process / preempt a resource, then re-detect      OSC10 §8.8
  coffman.ts         the four conditions: evaluated or "assumed by the model"
  presets.ts  events.ts  citations.ts  scenarios.ts  state.ts  rules.ts  index.ts
tests/fixtures/deadlock/*.test.ts
tests/oracle/deadlock.test.ts
src/modules/deadlock/            GraphEditorForm, GraphCanvas (React Flow, lazy), DetectView,
                                 BankersView, CoffmanPanel, RecoveryPanel
src/app/(modules)/deadlock/page.tsx
```

---

## Steps

### 1. Model and rules (`model.ts`, `rules.ts`)

- A **resource-allocation graph**: processes `T0..T7` (OSC10 names them threads `T`),
  resource types `R0..R4` with an instance count, **assignment edges** `R → T` (count)
  and **request edges** `T → R` (count). Validation: a resource never has more assigned
  than it has instances.
- Allocation and Request matrices and the Available vector are derived from the graph, so
  the graph view and the matrix view can't disagree.
- Banker's uses its own state: Max, Allocation, Available (Need = Max − Allocation is
  computed and shown, never edited).
- **Scan order rule:** the safety and detection algorithms find "some `i` with
  `Finish[i] = false` and `Need_i ≤ Work`". The textbook leaves the choice open. This
  project **restarts the scan from T0 each time and picks the lowest index**. The safe
  sequence shown is therefore one valid sequence, not the only one, and the UI says so.
- Cycle detection runs DFS from the lowest-numbered node, neighbours in ascending order,
  and reports the first cycle found.

### 2. Algorithms, each as a step run

- **Cycle detection** (single-instance only): build the wait-for graph (OSC10 §8.7.1),
  step the DFS, highlight the cycle. On a graph with any multi-instance resource it
  explains "a cycle is necessary but not sufficient here" and hands over to detection.
- **Detection** (OSC10 §8.7.2): Work = Available, Finish[i] = (Allocation_i = 0); each step
  compares `Request_i ≤ Work`, then releases. Result: "not deadlocked" with an order, or
  the deadlocked set.
- **Banker's safety** (OSC10 §8.6.3.1): same shape with Need.
- **Banker's request** (OSC10 §8.6.3.2): check Request ≤ Need (else error: exceeded
  claim), Request ≤ Available (else wait), pretend to allocate, run safety, then grant or
  roll back. Each check is its own step.
- **Recovery** (OSC10 §8.8): choose "terminate T*i*" or "preempt 1 of R*j* from T*i*",
  then detection re-runs automatically.

### 3. Coffman conditions (`coffman.ts`)

| Condition | Shown as |
|---|---|
| Mutual exclusion | "Assumed by the model: every resource instance is non-sharable" |
| Hold and wait | Evaluated: true if some process holds ≥ 1 instance and requests another |
| No preemption | "Assumed by the model" — becomes "violated by you" after a preempt recovery |
| Circular wait | Evaluated: true if the wait-for graph (single-instance) or RAG has a cycle |

A footnote says all four are necessary, not sufficient, for deadlock.

### 4. Graph editing (UI, but specified here)

- **The form is the primary editor**, so the module is fully keyboard operable:
  "Add process", "Add resource (instances)", "T2 holds 1 of R1", "T2 requests 1 of R1",
  remove any edge. Every change is validated by the Zod schema.
- **The React Flow canvas is an extra view** of the same state: drag to connect, drag to
  move. Layout is deterministic (processes in a top row, resources below, instances as
  dots) so a shared URL looks the same for everyone. `@xyflow/react` is loaded with
  `next/dynamic` only on `/deadlock` (enforced by the lint rule from phase 01).
- An always-available text summary: "T1 holds R2, requests R1. Cycle: T1 → R1 → T3 → R2 → T1."

### 5. Presets

- *Two processes, two locks* (classic single-instance cycle → deadlock).
- *Dining philosophers, 5 forks* (deadlock), and the same with one philosopher picking up
  the right fork first (no cycle).
- *Cycle but no deadlock* (OSC10 §8.3.2, multi-instance figure).
- *OSC10 Banker's example* (§8.6.3.3) with the requests below.
- *OSC10 detection example* (§8.7.2), before and after T2's extra request.

### 6. Tests

Worked examples (record in `tests/fixtures/README.md`; check against the edition):

| Source | Example | Expected |
|---|---|---|
| OSC10 §8.6.3.3 | T0–T4, total (10,5,7), Allocation `010,200,302,211,002`, Max `753,322,902,222,433`, Available `332` | Safe. Book gives ⟨T1,T3,T4,T2,T0⟩; our scan rule gives ⟨T1,T3,T0,T2,T4⟩; both verified valid |
| OSC10 §8.6.3.3 | T1 requests (1,0,2) | Granted; new state safe |
| OSC10 §8.6.3.3 | then T4 requests (3,3,0) | Waits: not enough available |
| OSC10 §8.6.3.3 | then T0 requests (0,2,0) | Refused: resulting state unsafe |
| OSC10 §8.7.2 | T0–T4, total (7,2,6), Allocation `010,200,303,211,002`, Request `000,202,000,100,002`, Available `000` | Not deadlocked |
| OSC10 §8.7.2 | then T2 requests one more C | Deadlocked set {T1, T2, T3, T4} |

Oracle (`tests/oracle/deadlock.test.ts`, n ≤ 6 processes so 720 orderings at most):

- Banker's says safe ⇔ some permutation of processes can finish in order (brute force).
- Every sequence Banker's reports is a valid finishing order.
- Detection's deadlocked set = the processes that can't finish in any order.
- On single-instance graphs, cycle detection ⇔ detection algorithm finds a deadlock.
- The request algorithm never grants a request whose resulting state is unsafe, and never
  refuses one whose resulting state is safe and fits in Available and Need.
- After terminating every process in the deadlocked set, detection reports no deadlock.

---

## Acceptance criteria

- [ ] All OSC10 examples pass; safe sequences are validated, not just compared
- [ ] Oracle tests pass on 500 seeded states
- [ ] `/deadlock` is fully usable keyboard only via the form; the canvas is an extra
- [ ] React Flow is not in any other route's bundle (check the build output)
- [ ] Coffman panel marks assumed conditions as assumed
- [ ] URL round-trips the graph and Banker's state; axe clean; `npm run verify` passes

---

## Prompts to execute

### Prompt 8.core — deadlock core (wave W2)

```
Read docs/implementation/00-overview.md and docs/implementation/08-module-5-deadlock.md.

In src/core/deadlock only: implement the graph model with derived matrices, deterministic
cycle detection on the wait-for graph, the detection algorithm, Banker's safety and
request algorithms, recovery, and coffman.ts, all as step runs, following the scan-order
and DFS rules in step 1. Replace the placeholder events.ts with DlEvent (snapshot:
matrices, Work, Finish, highlighted row/edge, result). Add OSC10 ch. 8 and OSTEP ch. 32
citations, presets, scenarios.ts and the state.ts branch.

Write the OSC10 worked-example tests (record them in tests/fixtures/README.md; validate
safe sequences rather than only comparing to the book's) and the brute-force oracle tests
from step 6. Only touch the append-only shared files. Done when `npm run verify` passes.
Commit on feat/deadlock-core.
```

### Prompt 8.ui — deadlock module (wave W3, after 3.2)

```
Read docs/implementation/08-module-5-deadlock.md and 03-ui-shell-and-visual-blocks.md.

Build src/modules/deadlock and the /deadlock route with two tabs, Graph and Banker's.
Graph tab: GraphEditorForm (primary, keyboard operable), GraphCanvas with @xyflow/react
loaded via next/dynamic and a deterministic layout, the text summary, DetectView,
CoffmanPanel and RecoveryPanel. Banker's tab: editable Max/Allocation/Available with
MatrixTable, Need computed, safety run and request form. Use StepInspector and RulesPanel
(including the note that the shown safe sequence is one of possibly several).

Flip the registry entry to 'ready'. e2e: build the two-lock deadlock with the form only,
run detection, check the cycle is announced, recover by terminating T1; run the OSC10
Banker's preset and the T0 (0,2,0) request and check it is refused; axe. Confirm from the
build output that @xyflow/react is only in the /deadlock chunk.
Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```
