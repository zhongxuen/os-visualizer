# Oracle tests

Brute-force checks that play the role a reference implementation would. Seeded through
fast-check's global seed (`tests/setup-core.ts`).

| Oracle | Checks | File |
|---|---|---|
| Exhaustive minimum faults on short reference strings (memoised on index + resident set); OPT ≤ the rest; LRU/OPT stack property; fault bounds; Clock evicts only bit-0 frames | OPT and page replacement | `replace.test.ts` |
| All orderings for a safe sequence | Banker's safety | `deadlock.test.ts` (phase 08) |
| All orderings / reduction | Deadlock detection | `deadlock.test.ts` (phase 08) |
| Plain arithmetic for the PA and fault of every access; two levels = one level on the same mapping; per-access memory references, TLB occupancy and miss counts; sizing vs enumeration | Address translation | `vm.test.ts` |
| Invariants on 500 random workloads per policy; SRTF optimality; RR = FCFS and 1-level MLFQ = RR | CPU scheduling | `sched.test.ts` |

Each module agent owns `tests/oracle/<name>.test.ts`.
