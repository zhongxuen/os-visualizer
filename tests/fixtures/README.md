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
| Paging, 64-byte space, 16-byte pages (Figure 18.2): VA 21 = VPN 1, offset 5 → PFN 7 → PA 117 | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 18, §18.1 | `vm/ostep.test.ts` |
| Linear page table, 32-bit space, 4 KB pages, 4-byte PTEs: 4 MB | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 18, §18.2 | `vm/ostep.test.ts` |
| TLB, ten ints from VA 100, 16-byte pages: miss, hit, hit, miss, hit, hit, hit, miss, hit, hit = 70%; second pass all hits | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 19, §19.2 | `vm/ostep.test.ts` |
| Two-level, 16 KB space, 64-byte pages: VA 0x3F80 → PD index 15, PT index 14 → PFN 55 → PA 0x0DC0; 3 table pages instead of 16 | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 20, §20.3 | `vm/ostep.test.ts` |
| Page replacement, 7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1 with 3 frames: FIFO 15 faults (Figure 10.12) | Silberschatz, *Operating System Concepts* | 10th | §10.4.2 | `replace/textbook.test.ts` |
| Same string: OPT 9 faults (Figure 10.14) | Silberschatz, *Operating System Concepts* | 10th | §10.4.3 | `replace/textbook.test.ts` |
| Same string: LRU 12 faults (Figure 10.15) | Silberschatz, *Operating System Concepts* | 10th | §10.4.4 | `replace/textbook.test.ts` |
| Belady's anomaly, 1,2,3,4,1,2,5,1,2,3,4,5 under FIFO: 9 faults with 3 frames, 10 with 4 (Figure 10.13) | Silberschatz, *Operating System Concepts* | 10th | §10.4.2 | `replace/textbook.test.ts` |
| 0,1,2,0,1,3,0,3,1,2,1, cache of 3: OPT 6 hits = 54.5% (Figure 22.1) | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 22, §22.2 | `replace/textbook.test.ts` |
| Same string: FIFO 4 hits = 36.4% (Figure 22.2) | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 22, §22.3 | `replace/textbook.test.ts` |
| Same string: LRU 6 hits = 54.5% (Figure 22.5) | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 22, §22.5 | `replace/textbook.test.ts` |
| Looping-sequential workload: LRU and FIFO miss on every reference with fewer frames than pages | Arpaci-Dusseau, *OSTEP* | v1.10 | ch. 22, §22.6 | `replace/textbook.test.ts` |
| Banker's, T0–T4 over (10, 5, 7), Allocation 010,200,302,211,002, Max 753,322,902,222,433, Available 332: safe. Book ⟨T1,T3,T4,T2,T0⟩, scan rule ⟨T1,T3,T0,T2,T4⟩, both validated | Silberschatz, *Operating System Concepts* | 10th | §8.6.3.3 | `deadlock/textbook.test.ts` |
| Same state: T1 requests (1,0,2) → granted, new state safe | Silberschatz, *Operating System Concepts* | 10th | §8.6.3.3 | `deadlock/textbook.test.ts` |
| Then T4 requests (3,3,0) → waits (not enough available) | Silberschatz, *Operating System Concepts* | 10th | §8.6.3.3 | `deadlock/textbook.test.ts` |
| Then T0 requests (0,2,0) → refused (resulting state unsafe) | Silberschatz, *Operating System Concepts* | 10th | §8.6.3.3 | `deadlock/textbook.test.ts` |
| Detection, T0–T4 over (7, 2, 6), Allocation 010,200,303,211,002, Request 000,202,000,100,002, Available 000: not deadlocked (order validated) | Silberschatz, *Operating System Concepts* | 10th | §8.7.2 | `deadlock/textbook.test.ts` |
| Then T2 requests one more C: deadlocked set {T1, T2, T3, T4} | Silberschatz, *Operating System Concepts* | 10th | §8.7.2 | `deadlock/textbook.test.ts` |
| Resource-allocation graph with a cycle but no deadlock (Figure 8.6), and with a multi-instance deadlock (Figure 8.5); threads renumbered from T0 | Silberschatz, *Operating System Concepts* | 10th | §8.3.2 | `deadlock/textbook.test.ts` |
