# Accuracy

Every source this product draws on, every modelling convention it chose where the
textbooks disagree or leave a choice open, and every known simplification.

An animation is persuasive whether or not it is right. A student watching a Gantt chart
form has no way to tell a faithful schedule from a plausible one, so the burden is on the
product to be checkable, and checkable means naming the section a reader can open in
order to disagree.

## How a claim reaches the screen

Every algorithm is pure TypeScript in `src/core/<module>/` and emits one event per
decision. Every event carries a `citation` id, and the inspector shows that citation next
to the event's one-line reason ("P2 preempts P1: 4 ticks left < 7", OSC 10e §5.3.2). The
citation is attached to the sentence it justifies, not compiled afterwards.

`tests/citations.test.ts` runs every preset in the scenario catalogue and fails if any
event cites an id the registry does not know. `tests/accuracy.test.ts` fails if any
registered citation, any rule id, or any source quoted in a lesson's "Real systems" box is
missing from this file, so the tables below cannot fall behind the product. Some
citations are registered but cited by no step today (marked *listed*): they back a preset,
a rule or a lesson rather than a single event.

## The sources

| Short name | Book |
| --- | --- |
| OSTEP | Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau, *Operating Systems: Three Easy Pieces*, version 1.10. Free chapter PDFs at <https://pages.cs.wisc.edu/~remzi/OSTEP/>. |
| OSC10 | Abraham Silberschatz, Peter B. Galvin and Greg Gagne, *Operating System Concepts*, 10th edition (Wiley, 2018). |

Fixtures cite **edition and section, never page numbers**. OSTEP is published as separate
chapter PDFs whose page numbers change between versions, so OSTEP is cited by chapter and
section of v1.10, and OSC10 by section and figure.

## How "correct" is checked

Each algorithm is checked three ways, and the tests run before every commit (`npm run
verify`).

1. **Worked examples.** The textbooks' own numbers, reproduced as tests in
   `tests/fixtures/<module>/`. `tests/fixtures/README.md` lists every one with its book,
   edition and section.
2. **Properties.** Invariants checked with fast-check over generated inputs, with a fixed
   seed (`tests/setup-core.ts`; `FC_SEED=<n>` overrides it). For example: total run time
   is CPU bursts plus idle ticks plus context-switch ticks; LRU and OPT never fault more
   with more frames.
3. **Brute-force oracles** (`tests/oracle/`), where exhaustive search is feasible: the
   minimum faults over every eviction choice on short strings must equal OPT; every
   ordering of threads is tried to confirm Banker's verdict and detection's; address
   translation is redone with plain arithmetic.

On top of these, **every preset runs twice** and through JSON and must give deep-equal
runs (`tests/determinism.test.ts`), and **every rule** in each module's `rules.ts` has a
test named after its id.

Lesson checkpoints are computed from the same core runs, never typed into the lesson, and
`src/content/lessons/lessons.test.tsx` pins each answer to the textbook's.

---

## CPU scheduling and Compare

Implemented in `src/core/sched/`. Compare (`src/core/sched/compare.ts`) runs the same
scheduler once per policy, so it has no conventions of its own.

### Citations

| Id | Source | Where | Title | Cited by a step |
| --- | --- | --- | --- | --- |
| `ostep.7` | OSTEP v1.10 | ch. 7 | [Scheduling: Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | listed |
| `ostep.7.2` | OSTEP v1.10 | §7.2 | [Scheduling Metrics](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | yes |
| `ostep.7.3` | OSTEP v1.10 | §7.3 | [First In, First Out (FIFO)](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | listed |
| `ostep.7.4` | OSTEP v1.10 | §7.4 | [Shortest Job First (SJF)](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | listed |
| `ostep.7.5` | OSTEP v1.10 | §7.5 | [Shortest Time-to-Completion First (STCF)](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | listed |
| `ostep.7.6` | OSTEP v1.10 | §7.6 | [A New Metric: Response Time](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | listed |
| `ostep.7.7` | OSTEP v1.10 | §7.7 | [Round Robin](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | listed |
| `ostep.7.8` | OSTEP v1.10 | §7.8 | [Incorporating I/O](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) | yes |
| `ostep.8` | OSTEP v1.10 | ch. 8 | [Scheduling: The Multi-Level Feedback Queue](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf) | listed |
| `ostep.8.1` | OSTEP v1.10 | §8.1 | [MLFQ: Basic Rules](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf) | yes |
| `ostep.8.2` | OSTEP v1.10 | §8.2 | [Attempt #1: How To Change Priority](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf) | yes |
| `ostep.8.3` | OSTEP v1.10 | §8.3 | [Attempt #2: The Priority Boost](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf) | yes |
| `ostep.8.4` | OSTEP v1.10 | §8.4 | [Attempt #3: Better Accounting](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf) | yes |
| `osc10.5` | OSC 10th ed. | ch. 5 | CPU Scheduling | listed |
| `osc10.5.1.4` | OSC 10th ed. | §5.1.4 | Dispatcher | yes |
| `osc10.5.2` | OSC 10th ed. | §5.2 | Scheduling Criteria | listed |
| `osc10.5.3.1` | OSC 10th ed. | §5.3.1 | First-Come, First-Served Scheduling | yes |
| `osc10.5.3.2` | OSC 10th ed. | §5.3.2 | Shortest-Job-First Scheduling | yes |
| `osc10.5.3.3` | OSC 10th ed. | §5.3.3 | Round-Robin Scheduling | yes |
| `osc10.5.3.4` | OSC 10th ed. | §5.3.4 | Priority Scheduling | yes |
| `osc10.5.3.6` | OSC 10th ed. | §5.3.6 | Multilevel Feedback Queue Scheduling | listed |

Shared by every module: `ostep.4`,
[The Abstraction: The Process](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf)
(OSTEP ch. 4).

### Conventions (`src/core/sched/rules.ts`)

| Rule | What the model does |
| --- | --- |
| `sched.order.arrivals` | Processes arriving on the same tick join the ready queue lowest PID first. |
| `sched.order.io` | Processes returning from I/O join after that tick’s arrivals, lowest PID first. |
| `sched.order.quantum` | A process whose quantum expires goes to the tail of its queue, behind processes that arrived or returned from I/O on the same tick. The Silberschatz and OSTEP convention. Some courses put it ahead instead. |
| `sched.order.finish` | A process that finishes its CPU burst on the last tick of its quantum leaves for I/O or finishes; that is not a quantum expiry. |
| `sched.tie.pid` | When the policy’s key ties (same burst, same remaining time, same priority), the lower PID runs first. |
| `sched.preempt.equal` | Equal keys never preempt: SRTF with equal remaining time, or priority with equal priority, keeps the running process. |
| `sched.preempt.tail` | A preempted process goes to the tail of its ready queue. |
| `sched.cs.cost` | A context switch costs the set number of ticks whenever the CPU starts a process other than the one that ran last. The very first dispatch is free. Context-switch ticks are neither busy nor idle. |
| `sched.cs.atomic` | A context switch, once started, completes, and the process switched to runs at least one tick before it can be preempted. |
| `sched.priority.lower` | Lower priority number = higher priority (0 is the highest). Silberschatz’s convention. |
| `sched.priority.aging` | Aging lowers a ready process’s priority number by the step for every interval it waits, floored at 0, and resets to its base priority when it runs. |
| `sched.sjf.next` | SJF and SRTF use the length of the next CPU burst, known in advance, as the textbooks assume. |
| `sched.io.fixed` | I/O is a fixed wait with no device queue: a process starting a d-tick I/O burst at t is ready again at t + d. |
| `sched.mlfq.enter` | MLFQ: a new job enters the top queue, Q0 (rule 3), and a job in a higher queue always runs first and preempts a lower one (rule 1). Jobs in one queue run round robin (rule 2). |
| `sched.mlfq.allotment` | MLFQ, rule 4 (allotment): time used at a level is counted across I/O; when it reaches the level’s allotment, the job moves down one queue. |
| `sched.mlfq.original` | MLFQ, old rules 4a/4b: a job that uses a whole quantum moves down; a job that gives up the CPU before its quantum ends keeps its level, so it can game the scheduler. Finishing a burst on the last tick of the quantum counts as using the whole quantum. |
| `sched.mlfq.boost` | MLFQ, rule 5: every boost interval, every job moves to Q0 and its allotment resets. Ready jobs keep their order, higher queues first; a running job keeps the CPU and the part of its quantum already used. |
| `sched.limit` | A run stops at 300 ticks with a “limit reached” event rather than running forever. |

### Metrics

Turnaround = completion − arrival; response = first run − arrival (OSTEP §7.2, §7.6);
waiting = turnaround − total CPU − total I/O, the time spent in a ready queue including
time lost to context switches (OSC10 §5.2). Utilisation = busy ticks / total ticks, and
context-switch ticks are neither busy nor idle (`sched.cs.cost`). Throughput = finished
processes / total ticks. Averages are over finished processes.

---

## Address translation

Implemented in `src/core/vm/`.

### Citations

| Id | Source | Where | Title | Cited by a step |
| --- | --- | --- | --- | --- |
| `ostep.18` | OSTEP v1.10 | ch. 18 | [Paging: Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf) | listed |
| `ostep.18.1` | OSTEP v1.10 | §18.1 | [A Simple Example And Overview](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf) | yes |
| `ostep.18.2` | OSTEP v1.10 | §18.2 | [Where Are Page Tables Stored?](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf) | listed |
| `ostep.18.3` | OSTEP v1.10 | §18.3 | [What’s Actually In The Page Table?](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf) | yes |
| `ostep.18.4` | OSTEP v1.10 | §18.4 | [Paging: Also Too Slow](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf) | yes |
| `ostep.18.5` | OSTEP v1.10 | §18.5 | [A Memory Trace](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf) | yes |
| `ostep.19` | OSTEP v1.10 | ch. 19 | [Paging: Faster Translations (TLBs)](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) | listed |
| `ostep.19.1` | OSTEP v1.10 | §19.1 | [TLB Basic Algorithm](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) | yes |
| `ostep.19.2` | OSTEP v1.10 | §19.2 | [Example: Accessing An Array](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) | listed |
| `ostep.19.3` | OSTEP v1.10 | §19.3 | [Who Handles The TLB Miss?](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) | listed |
| `ostep.19.4` | OSTEP v1.10 | §19.4 | [TLB Contents: What’s In There?](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) | yes |
| `ostep.19.5` | OSTEP v1.10 | §19.5 | [TLB Issue: Context Switches](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) | listed |
| `ostep.19.6` | OSTEP v1.10 | §19.6 | [Issue: Replacement Policy](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) | yes |
| `ostep.20` | OSTEP v1.10 | ch. 20 | [Paging: Smaller Tables](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf) | listed |
| `ostep.20.3` | OSTEP v1.10 | §20.3 | [Multi-level Page Tables](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf) | yes |

### Conventions (`src/core/vm/rules.ts`)

| Rule | What the model does |
| --- | --- |
| `vm.order.tlbFirst` | The TLB is checked before the page table. A hit skips the page-table walk. |
| `vm.tlb.model` | The TLB is fully associative and holds VPN → PFN plus the protection bits. There are no ASIDs: the TLB belongs to one process. Real TLBs tag entries with an address-space ID so a context switch need not flush them (OSTEP §19.5). |
| `vm.tlb.fill` | A miss fills the lowest empty TLB slot. When the TLB is full, LRU evicts the entry used least recently and FIFO the entry loaded first; a tie goes to the lowest slot. |
| `vm.tlb.none` | A TLB of size 0 means no TLB: every access counts as a miss and walks the page table. |
| `vm.walk.hardware` | The hardware walks the page table on a miss (a hardware-managed TLB, x86-style). MIPS and other RISC machines trap to the OS instead (OSTEP §19.3); the memory references are the same. |
| `vm.pte.size` | Page-table and page-directory entries are 4 bytes. Pages that are not listed in the page table are invalid. |
| `vm.pte.address` | One level: PTE address = PTBR + VPN × 4. Two levels: PDE address = PDBR + directory index × 4, and PTE address = PDE.PFN × page size + table index × 4. |
| `vm.split.twoLevel` | Two levels split the VPN: the low log2(page size / 4) bits index one page-table page, and the remaining high bits index the page directory. |
| `vm.fault.stop` | An invalid PDE or PTE is an invalid-page fault, and a write to a read-only page is a protection fault. Either fault stops the access, and a fault never fills the TLB. What the OS does next (swap the page in, or kill the process) is the page replacement module’s subject. |
| `vm.prot.hit` | Protection is checked on a TLB hit too, against the protection bits cached in the entry. |
| `vm.bits.hardware` | The hardware, not the OS, sets the accessed bit on every access that passes the checks, and the dirty bit on every such write, hits included. Setting them is not counted as a memory reference. A real x86 TLB also caches the dirty bit and walks the table again on the first write to a clean page; the model leaves that walk out. |
| `vm.refs.count` | Every memory reference is counted, page-table reads included: 1 on a TLB hit, levels + 1 on a miss, and on a fault only the reads made before it. |

---

## Page replacement

Implemented in `src/core/replace/`.

### Citations

| Id | Source | Where | Title | Cited by a step |
| --- | --- | --- | --- | --- |
| `ostep.22` | OSTEP v1.10 | ch. 22 | [Beyond Physical Memory: Policies](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | listed |
| `ostep.22.1` | OSTEP v1.10 | §22.1 | [Cache Management](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | yes |
| `ostep.22.2` | OSTEP v1.10 | §22.2 | [The Optimal Replacement Policy](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | yes |
| `ostep.22.3` | OSTEP v1.10 | §22.3 | [A Simple Policy: FIFO](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | yes |
| `ostep.22.5` | OSTEP v1.10 | §22.5 | [Using History: LRU](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | yes |
| `ostep.22.6` | OSTEP v1.10 | §22.6 | [Workload Examples](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | listed |
| `ostep.22.8` | OSTEP v1.10 | §22.8 | [Approximating LRU](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | yes |
| `ostep.22.9` | OSTEP v1.10 | §22.9 | [Considering Dirty Pages](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf) | listed |
| `osc10.10` | OSC 10th ed. | ch. 10 | Virtual Memory | listed |
| `osc10.10.4` | OSC 10th ed. | §10.4 | Page Replacement | listed |
| `osc10.10.4.1` | OSC 10th ed. | §10.4.1 | Basic Page Replacement | yes |
| `osc10.10.4.2` | OSC 10th ed. | §10.4.2 | FIFO Page Replacement | listed |
| `osc10.10.4.3` | OSC 10th ed. | §10.4.3 | Optimal Page Replacement | listed |
| `osc10.10.4.4` | OSC 10th ed. | §10.4.4 | LRU Page Replacement | listed |
| `osc10.10.4.5` | OSC 10th ed. | §10.4.5 | LRU-Approximation Page Replacement | listed |
| `osc10.10.4.5.2` | OSC 10th ed. | §10.4.5.2 | Second-Chance Algorithm | yes |

### Conventions (`src/core/replace/rules.ts`)

| Rule | What the model does |
| --- | --- |
| `repl.fill.order` | Frames start empty and fill in order, frame 0 first. A fault while a frame is empty fills it and evicts nothing. |
| `repl.miss.kinds` | A fault on a page’s first reference is a cold (compulsory) miss; every other fault is a capacity miss. OSTEP’s “three Cs” also has conflict misses, which only set-associative caches have. Memory is fully associative: any page can go in any frame. |
| `repl.fifo` | FIFO evicts the page loaded earliest. A hit does not change its place in the queue. |
| `repl.lru` | LRU evicts the page used least recently. Every hit and every load counts as a use. |
| `repl.opt` | OPT evicts the page whose next use is furthest away; a page never used again counts as infinitely far. Ties go to the page in the lowest-numbered frame. Ties can only happen between pages that are never used again. OSTEP and OSC10 leave this tie open; any choice gives the same number of faults. |
| `repl.clock` | Clock keeps one use bit per frame and a hand that starts at frame 0. A hit sets the bit to 1; a loaded page starts with its bit at 1 and the hand moves to the next frame. On a fault with every frame full, the hand sweeps: bit 1 → clear it and move on; bit 0 → evict that frame. Some textbooks load the new page with its use bit at 0. This model follows OSC10’s second-chance algorithm and sets it to 1. The hand does not move on a hit. |
| `repl.events` | Every reference is its own phase. A hit is one step; a fault is fault → (Clock: one step per use bit cleared) → choose victim, with the reason → evict → load. A fault into an empty frame is fault → load. |
| `repl.curve` | The faults-vs-frames curve runs each policy with 1 to 8 frames. A point where more frames give more faults is marked as Belady’s anomaly. LRU and OPT are stack algorithms: the pages held with n frames are always among those held with n + 1, so their curves never rise. FIFO and Clock are not. |
| `repl.dirty` | Pages are never dirty: evicting a page costs nothing extra, and every fault costs the same. Real systems prefer to evict clean pages, which need no write-back (OSTEP §22.9). This model leaves dirty bits out. |

---

## Deadlock

Implemented in `src/core/deadlock/`.

### Citations

| Id | Source | Where | Title | Cited by a step |
| --- | --- | --- | --- | --- |
| `osc10.8` | OSC 10th ed. | ch. 8 | Deadlocks | listed |
| `osc10.8.1` | OSC 10th ed. | §8.1 | System Model | listed |
| `osc10.8.3` | OSC 10th ed. | §8.3 | Deadlock Characterization | listed |
| `osc10.8.3.1` | OSC 10th ed. | §8.3.1 | Necessary Conditions | listed |
| `osc10.8.3.2` | OSC 10th ed. | §8.3.2 | Resource-Allocation Graph | yes |
| `osc10.8.6` | OSC 10th ed. | §8.6 | Deadlock Avoidance | listed |
| `osc10.8.6.1` | OSC 10th ed. | §8.6.1 | Safe State | listed |
| `osc10.8.6.3` | OSC 10th ed. | §8.6.3 | Banker’s Algorithm | listed |
| `osc10.8.6.3.1` | OSC 10th ed. | §8.6.3.1 | Safety Algorithm | yes |
| `osc10.8.6.3.2` | OSC 10th ed. | §8.6.3.2 | Resource-Request Algorithm | yes |
| `osc10.8.6.3.3` | OSC 10th ed. | §8.6.3.3 | An Illustrative Example | listed |
| `osc10.8.7` | OSC 10th ed. | §8.7 | Deadlock Detection | listed |
| `osc10.8.7.1` | OSC 10th ed. | §8.7.1 | Single Instance of Each Resource Type | yes |
| `osc10.8.7.2` | OSC 10th ed. | §8.7.2 | Several Instances of a Resource Type | yes |
| `osc10.8.8` | OSC 10th ed. | §8.8 | Recovery from Deadlock | listed |
| `osc10.8.8.1` | OSC 10th ed. | §8.8.1 | Process and Thread Termination | yes |
| `osc10.8.8.2` | OSC 10th ed. | §8.8.2 | Resource Preemption | yes |
| `osc10.7.1.3` | OSC 10th ed. | §7.1.3 | The Dining-Philosophers Problem | listed |
| `ostep.32` | OSTEP v1.10 | ch. 32 | [Common Concurrency Problems](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf) | listed |
| `ostep.32.3` | OSTEP v1.10 | §32.3 | [Deadlock Bugs](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf) | yes |

### Conventions (`src/core/deadlock/rules.ts`)

| Rule | What the model does |
| --- | --- |
| `dl.names` | Threads are T0, T1, … and resource types R0, R1, …, both numbered from 0. OSC10 calls them threads (T). Its graph figures number from T1 and R1 and its matrix examples name resources A, B, C; the presets renumber them from 0 and say so. |
| `dl.matrices` | Allocation, Request and Available are read off the graph’s edges, so the graph and the matrices always agree. A resource type never has more instances assigned than it has, and a thread never holds plus requests more than exist. |
| `dl.scan.order` | Detection and the safety algorithm look for “some i with Finish[i] = false and Request_i (or Need_i) ≤ Work”. This model restarts the scan from T0 after every finish and takes the lowest-numbered thread that fits. The textbook leaves the choice open, so the order shown is one valid order, not the only one. OSC10 §8.6.3.3 gives ⟨T1, T3, T4, T2, T0⟩ for its example; this rule gives ⟨T1, T3, T0, T2, T4⟩. Both are safe. |
| `dl.detect.finish` | Detection starts with Finish[i] = true for every thread that holds nothing; the safety algorithm starts with every Finish[i] false. A thread holding nothing cannot be part of a deadlock, even if it is waiting (OSC10 §8.7.2). |
| `dl.dfs.order` | Cycle detection runs a depth-first search from the lowest-numbered unvisited thread, takes neighbours in ascending order, and reports the first cycle found. In the full resource-allocation graph (used for circular wait and the summary) threads come before resource types. |
| `dl.wfg` | The wait-for graph has Ti → Tj when Ti requests a resource type Tj holds. If there are several, the edge names the lowest-numbered one. |
| `dl.cycle.multi` | Cycle detection decides deadlock only when every resource type has one instance. With any multi-instance type, a cycle is necessary but not sufficient, and the run hands over to the detection algorithm. |
| `dl.request.steps` | A Banker’s request is checked in order: Request ≤ Need (else an error: the maximum claim is exceeded), Request ≤ Available (else wait), pretend to allocate, run the safety algorithm, then grant or roll back. Each check is its own step and a failed check ends the run. |
| `dl.recover.terminate` | Terminating a thread releases everything it holds and drops its requests. Detection then runs again on what is left. |
| `dl.recover.preempt` | Preempting takes one instance of a resource from a thread. The thread is rolled back and must request that instance again, so its Request goes up by one. Detection then runs again. OSC10 §8.8.2 leaves how far to roll back open; this model rolls back just past the one acquisition. |
| `dl.coffman` | Of the four Coffman conditions, hold and wait and circular wait are evaluated on the graph. Mutual exclusion and no preemption are assumed by the model; no preemption shows as violated after a preempt recovery. All four are necessary for deadlock, not sufficient. |

---

## Synchronisation

Implemented in `src/core/sync/`. A program is a few threads, each a list of micro-ops
(`load`, `add`, `store`, `lock`, `unlock`, `wait`, `signal`, `yield`) over shared
variables, test-and-set mutexes and semaphores. `interleave()` runs it one op per tick
under a manual, round-robin or seeded-random schedule; `explore()` runs every
interleaving and groups them by how they end.

`explore()` counts with a memoised search over machine states, and
`tests/oracle/sync.test.ts` checks every count against a naive enumeration of every
schedule, on every preset and on generated programs. Property tests check that at most
one thread is ever inside a mutex-guarded critical section, that a semaphore's value is
always its initial value + signals − completed waits, and that sleeping threads never run.

### Citations

| Id | Source | Where | Title | Cited by a step |
| --- | --- | --- | --- | --- |
| `ostep.26` | OSTEP v1.10 | ch. 26 | [Concurrency: An Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf) | yes |
| `ostep.26.3` | OSTEP v1.10 | §26.3 | [Why It Gets Worse: Shared Data](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf) | listed |
| `ostep.26.4` | OSTEP v1.10 | §26.4 | [The Heart Of The Problem: Uncontrolled Scheduling](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf) | yes |
| `ostep.26.5` | OSTEP v1.10 | §26.5 | [The Wish For Atomicity](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf) | yes |
| `ostep.28` | OSTEP v1.10 | ch. 28 | [Locks](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf) | listed |
| `ostep.28.1` | OSTEP v1.10 | §28.1 | [Locks: The Basic Idea](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf) | listed |
| `ostep.28.7` | OSTEP v1.10 | §28.7 | [Building Working Spin Locks with Test-And-Set](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf) | yes |
| `ostep.31` | OSTEP v1.10 | ch. 31 | [Semaphores](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf) | listed |
| `ostep.31.1` | OSTEP v1.10 | §31.1 | [Semaphores: A Definition](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf) | yes |
| `ostep.31.4` | OSTEP v1.10 | §31.4 | [The Producer/Consumer (Bounded Buffer) Problem](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf) | listed |

The lock-ordering preset also cites `ostep.32.3`, listed under Deadlock.

### Conventions (`src/core/sync/rules.ts`)

| Rule | What the model does |
| --- | --- |
| `sync.tick` | One CPU: on each tick exactly one thread runs exactly one micro-op. A thread can be interrupted between any two ops, never in the middle of one. |
| `sync.registers` | Each thread has its own registers, starting at 0. load and store are the only ops that touch shared memory; add changes only the register. So counter++ is three ops, as in OSTEP Figure 26.7, and a thread can be interrupted between them. |
| `sync.tas` | A mutex is a test-and-set spin lock. lock on a free mutex takes it in one tick. lock on a held mutex spins: the tick is spent, nothing changes, and the same lock runs again next time. |
| `sync.unlock.owner` | Only the thread holding a mutex may unlock it. Any other unlock is an error, and the run stops. |
| `sync.sem.value` | A semaphore’s value never goes below 0. wait on a positive value decrements it; wait on 0 puts the thread to sleep at the back of the semaphore’s FIFO queue. OSTEP’s implementation lets the value go negative to count the sleepers. Here the value stops at 0 and the queue length is that count. |
| `sync.sem.signal` | signal wakes the first sleeper, which completes its wait without the value changing. With nobody asleep, signal adds 1 to the value. Either way, value = initial value + signals − completed waits. |
| `sync.manual` | A manual schedule may pick only a thread that can make progress: not finished, not asleep, and not about to spin. The first pick that can’t run ends the run. |
| `sync.rr` | Round robin gives T0, T1, … the CPU in turn for up to a quantum of ticks each. A thread gives it up early when it finishes, sleeps or yields. A spinner keeps its turn and spends it spinning; finished and sleeping threads are skipped. |
| `sync.random` | Seeded random picks uniformly, each tick, among the threads that are ready or spinning, using the seed shown. The same seed gives the same run. |
| `sync.stuck` | A run ends as stuck when no thread can make progress: each unfinished thread is asleep, or spinning on a lock whose holder can’t release it. It is called a deadlock when two or more threads wait and none of them waits for a lock kept by a thread that has finished. A finished thread that kept its lock (a forgotten unlock) leaves the waiter stuck with no cycle, so that case is reported as stuck, not deadlocked. |
| `sync.limit` | Round robin and random runs stop after 300 ticks. |
| `sync.explore` | Exploration counts every sequence of picks among threads that can make progress, to the end. Spins are left out: a spin changes nothing, so it cannot change how a run ends. |
| `sync.lost` | A store is marked as a lost update when another thread stored to the same variable after this thread loaded it. |

---

## Real systems, in the lessons

Each lesson ends with a "Real systems" box that describes what real kernels do. Nothing in
these boxes is simulated. Their sources:

| Lesson | Claim | Source |
| --- | --- | --- |
| Scheduling | Linux's default scheduler has been EEVDF since kernel 6.6, replacing CFS | [Linux kernel documentation: EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html); [LWN: An EEVDF CPU scheduler for Linux (2023)](https://lwn.net/Articles/925371/) |
| Scheduling | Windows schedules threads preemptively by 32 priority levels, with temporary boosts | [Microsoft Learn: Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities) |
| Translation | x86-64 uses four levels of page table for 48-bit addresses, and five for 57-bit addresses | [Linux kernel documentation: Page Tables](https://docs.kernel.org/mm/page_tables.html); [Linux kernel documentation: 5-level paging (x86-64)](https://docs.kernel.org/arch/x86/x86_64/5level-paging.html) |
| Replacement | Linux approximates LRU with active and inactive lists, and since 6.1 can use the multi-generational LRU | [Mel Gorman, Understanding the Linux Virtual Memory Manager, ch. 10](https://www.kernel.org/doc/gorman/html/understand/understand013.html); [Linux kernel documentation: Multi-Gen LRU](https://docs.kernel.org/admin-guide/mm/multigen_lru.html) |
| Synchronisation | Linux user-space locks are built on futexes: no system call when the lock is free, and the kernel puts a waiter to sleep | [futex(7), Linux manual page](https://man7.org/linux/man-pages/man7/futex.7.html) |
| Synchronisation | Kernel mutexes spin briefly while the holder runs on another CPU (optimistic spinning), and sleep otherwise | [Linux kernel documentation: Generic Mutex Subsystem](https://docs.kernel.org/locking/mutex-design.html) |
| Deadlock | General-purpose kernels prevent deadlock by lock ordering, which Linux checks with lockdep, rather than run Banker's algorithm | [Linux kernel documentation: lockdep](https://docs.kernel.org/locking/lockdep-design.html); [OSTEP ch. 32: Common Concurrency Problems](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf) |

## Deliberate simplifications

These are stated on the About page and, where they matter, in the module's Rules panel.
A gap that is only in this file is a gap that is hidden.

- **Textbook algorithms, not a real kernel.** There are no interrupts, no multicore and no
  real hardware timings. I/O is a fixed wait with no device queue (`sched.io.fixed`), and
  a context switch costs a fixed, configurable number of ticks (`sched.cs.cost`).
- **Tie-breaks are chosen, and shown.** Where textbooks disagree on a small rule (whether
  a preempted process re-queues ahead of a same-tick arrival, the Clock hand after a load,
  the scan order of the safety algorithm), one rule is chosen and shown in the Rules
  panel. Another book's worked example may differ by that rule.
- **MLFQ** follows OSTEP's rules as stated. Real schedulers (Linux EEVDF, Windows) are
  described in lessons, not simulated.
- **SJF and SRTF know burst lengths in advance** (`sched.sjf.next`). A real scheduler can
  only predict them, for example by exponential averaging (OSC10 §5.3.2).
- **The TLB is fully associative with no ASIDs** and belongs to one process
  (`vm.tlb.model`). Page faults stop the translation (`vm.fault.stop`); loading the page
  is the page replacement module's subject. The model leaves out the extra walk a real
  x86 makes on the first write to a clean page (`vm.bits.hardware`).
- **Pages are never dirty** in the replacement model (`repl.dirty`), so every fault costs
  the same.
- **Banker's algorithm shows one safe sequence** (`dl.scan.order`); there may be others.
- **Recovery rolls a preempted thread back by exactly one acquisition**
  (`dl.recover.preempt`); OSC10 leaves how far to roll back open.
- **Mutual exclusion and no preemption are assumed, not checked** (`dl.coffman`): a graph
  cannot show them.
- **Synchronisation runs on one CPU** (`sync.tick`): a thread is interrupted only between
  micro-ops, never inside one, and there are no memory-ordering effects or caches.
- **The mutex only spins and the semaphore only sleeps** (`sync.tas`, `sync.sem.value`).
  Real locks spin briefly, then sleep. A semaphore's value stops at 0 instead of going
  negative to count sleepers, as OSTEP's implementation does; the queue length is that
  count.
- **Exploration leaves spins out** (`sync.explore`): a spin changes no state, so it cannot
  change how a run ends, and counting it would make the number of interleavings
  infinite.
