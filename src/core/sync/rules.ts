/**
 * The modelling conventions the synchronisation core follows, as data. The RulesPanel
 * renders them; `tests/fixtures/sync/rules.test.ts` has one test named after each id.
 * Where the textbook leaves a choice open, the rule says which one was made.
 */

import type { CitationId } from '../citations/types';

export interface SyncRule {
  id: string;
  text: string;
  detail?: string;
  citation: CitationId;
}

export const SYNC_RULES: readonly SyncRule[] = [
  {
    id: 'sync.tick',
    text: 'One CPU: on each tick exactly one thread runs exactly one micro-op. A thread can be interrupted between any two ops, never in the middle of one.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.registers',
    text: 'Each thread has its own registers, starting at 0. load and store are the only ops that touch shared memory; add changes only the register.',
    detail:
      'So counter++ is three ops, as in OSTEP Figure 26.7, and a thread can be interrupted between them.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.tas',
    text: 'A mutex is a test-and-set spin lock. lock on a free mutex takes it in one tick. lock on a held mutex spins: the tick is spent, nothing changes, and the same lock runs again next time.',
    citation: 'ostep.28.7',
  },
  {
    id: 'sync.unlock.owner',
    text: 'Only the thread holding a mutex may unlock it. Any other unlock is an error, and the run stops.',
    citation: 'ostep.28.1',
  },
  {
    id: 'sync.sem.value',
    text: 'A semaphore’s value never goes below 0. wait on a positive value decrements it; wait on 0 puts the thread to sleep at the back of the semaphore’s FIFO queue.',
    detail:
      'OSTEP’s implementation lets the value go negative to count the sleepers. Here the value stops at 0 and the queue length is that count.',
    citation: 'ostep.31.1',
  },
  {
    id: 'sync.sem.signal',
    text: 'signal wakes the first sleeper, which completes its wait without the value changing. With nobody asleep, signal adds 1 to the value.',
    detail: 'Either way, value = initial value + signals − completed waits.',
    citation: 'ostep.31.1',
  },
  {
    id: 'sync.manual',
    text: 'A manual schedule may pick only a thread that can make progress: not finished, not asleep, and not about to spin. The first pick that can’t run ends the run.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.rr',
    text: 'Round robin gives T0, T1, … the CPU in turn for up to a quantum of ticks each. A thread gives it up early when it finishes, sleeps or yields. A spinner keeps its turn and spends it spinning; finished and sleeping threads are skipped.',
    citation: 'ostep.28.7',
  },
  {
    id: 'sync.random',
    text: 'Seeded random picks uniformly, each tick, among the threads that are ready or spinning, using the seed shown. The same seed gives the same run.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.stuck',
    text: 'A run ends as stuck when no thread can make progress: each unfinished thread is asleep, or spinning on a lock whose holder can’t release it. It is called a deadlock when two or more threads wait and none of them waits for a lock kept by a thread that has finished.',
    detail:
      'A finished thread that kept its lock (a forgotten unlock) leaves the waiter stuck with no cycle, so that case is reported as stuck, not deadlocked.',
    citation: 'ostep.32.3',
  },
  {
    id: 'sync.limit',
    text: 'Round robin and random runs stop after 300 ticks.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.explore',
    text: 'Exploration counts every sequence of picks among threads that can make progress, to the end. Spins are left out: a spin changes nothing, so it cannot change how a run ends.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.lost',
    text: 'A store is marked as a lost update when another thread stored to the same variable after this thread loaded it.',
    citation: 'ostep.26.4',
  },
];
