# Textbook fixtures

Worked examples from the textbooks, each reproduced as a test. Cite edition and section,
not page numbers: OSTEP v1.10 chapter + section; Silberschatz *Operating System
Concepts* 10th edition section + figure/example number.

Module agents append their own rows only.

| Example | Book | Edition | Chapter / section | Test |
|---|---|---|---|---|
| FCFS, P1 = 24, P2 = 3, P3 = 3 at t = 0: avg waiting 17; short jobs first (renamed so they arrive first): avg waiting 3 | Silberschatz, *Operating System Concepts* | 10th | §5.3.1 | `sched/osc10.test.ts` |
| SJF, P1 = 6, P2 = 8, P3 = 7, P4 = 3: avg waiting 7 | Silberschatz, *Operating System Concepts* | 10th | §5.3.2 | `sched/osc10.test.ts` |
| SRTF, arrivals 0, 1, 2, 3, bursts 8, 4, 9, 5: avg waiting 6.5 | Silberschatz, *Operating System Concepts* | 10th | §5.3.2 | `sched/osc10.test.ts` |
| RR q = 4, P1 = 24, P2 = 3, P3 = 3: avg waiting 17/3 ≈ 5.67 | Silberschatz, *Operating System Concepts* | 10th | §5.3.3 | `sched/osc10.test.ts` |
| Priority, bursts 10, 1, 2, 1, 5, priorities 3, 1, 4, 5, 2: avg waiting 8.2 | Silberschatz, *Operating System Concepts* | 10th | §5.3.4 | `sched/osc10.test.ts` |
| FIFO / SJF, A = 100, B = C = 10: avg turnaround 110 / 50 | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 7, §7.3–7.4 | `sched/ostep7.test.ts` |
| STCF, A = 100 at 0, B = C = 10 at 10: avg turnaround 50 | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 7, §7.5 | `sched/ostep7.test.ts` |
| RR slice 1 vs SJF, A = B = C = 5: avg response 1 vs 5 | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 7, §7.6–7.7 | `sched/ostep7.test.ts` |
| MLFQ, single long-running job (Figure 8.2): segment layout | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 8, §8.2 | `sched/ostep8-mlfq.test.ts` |
| MLFQ, along came a short job (Figure 8.3): segment layout | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 8, §8.2 | `sched/ostep8-mlfq.test.ts` |
| MLFQ, I/O-bound job keeps the top queue (Figure 8.4) | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 8, §8.2 | `sched/ostep8-mlfq.test.ts` |
| MLFQ, without and with priority boost (Figure 8.5) | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 8, §8.3 | `sched/ostep8-mlfq.test.ts` |
| MLFQ, gaming without and with allotment accounting (Figure 8.6) | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 8, §8.4 | `sched/ostep8-mlfq.test.ts` |
