# Oracle tests

Brute-force checks that play the role a reference implementation would. Seeded through
fast-check's global seed (`tests/setup-core.ts`).

| Oracle | Checks | File |
|---|---|---|
| Exhaustive minimum faults on short reference strings | OPT | `replace.test.ts` (phase 07) |
| All orderings for a safe sequence | Banker's safety | `deadlock.test.ts` (phase 08) |
| All orderings / reduction | Deadlock detection | `deadlock.test.ts` (phase 08) |
| Plain arithmetic | Address translation | `vm.test.ts` (phase 06) |
| Invariants on 500 random workloads per policy; SRTF optimality; RR = FCFS and 1-level MLFQ = RR | CPU scheduling | `sched.test.ts` |

Each module agent owns `tests/oracle/<name>.test.ts`.
