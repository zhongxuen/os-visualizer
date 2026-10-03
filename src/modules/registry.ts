/**
 * The module manifest. The home page and navigation read it; nothing else decides what
 * modules exist. Not a module itself, so src/components may import it (see the
 * boundary rules in eslint.config.mjs).
 *
 * A module agent flips only its own entry's `status` to 'ready' when its route ships.
 * `planned` modules render as cards that are not links.
 */
export type ModuleStatus = 'planned' | 'ready';

export interface ModuleEntry {
  /** Folder name under src/modules and src/core. */
  readonly slug: string;
  readonly route: `/${string}`;
  readonly title: string;
  readonly blurb: string;
  /** Display order and the number in 00-overview §3. */
  readonly number: number;
  readonly status: ModuleStatus;
  /** 1 = v1, 2 = phase 2. */
  readonly phase: 1 | 2;
}

export const MODULES: readonly ModuleEntry[] = [
  {
    slug: 'scheduling',
    route: '/scheduling',
    title: 'CPU Scheduling',
    blurb:
      'FCFS, SJF, SRTF, Priority, Round Robin and MLFQ. Watch the Gantt chart form tick by tick, with the reason for every decision.',
    number: 1,
    status: 'planned',
    phase: 1,
  },
  {
    slug: 'compare',
    route: '/compare',
    title: 'Compare',
    blurb:
      'The same workload under two to four schedulers at once, on a shared time axis, with the best metric in each row marked.',
    number: 2,
    status: 'planned',
    phase: 1,
  },
  {
    slug: 'translation',
    route: '/translation',
    title: 'Address Translation',
    blurb:
      'Split a virtual address, look it up in the TLB, walk the page table and land on a physical frame.',
    number: 3,
    status: 'planned',
    phase: 1,
  },
  {
    slug: 'replacement',
    route: '/replacement',
    title: 'Page Replacement',
    blurb:
      "FIFO, LRU, OPT and Clock over a reference string. Plot faults against frames and see Belady's anomaly.",
    number: 4,
    status: 'planned',
    phase: 1,
  },
  {
    slug: 'deadlock',
    route: '/deadlock',
    title: 'Deadlock',
    blurb:
      "Build a resource-allocation graph, run detection and Banker's algorithm, then recover by terminating or preempting.",
    number: 5,
    status: 'planned',
    phase: 1,
  },
  {
    slug: 'sync',
    route: '/sync',
    title: 'Synchronisation',
    blurb:
      'Two threads race on a shared counter, then a mutex fixes it. Producer and consumer with semaphores.',
    number: 6,
    status: 'planned',
    phase: 2,
  },
];
