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
  /** The rule in plain words, for someone meeting it for the first time. */
  plain?: string;
  /** What would change if a textbook used the other convention. */
  whyItMatters?: string;
  citation: CitationId;
}

export const SYNC_RULES: readonly SyncRule[] = [
  {
    id: 'sync.tick',
    text: 'One CPU: on each tick exactly one thread runs exactly one micro-op. A thread can be interrupted between any two ops, never in the middle of one.',
    plain:
      'Only one thread runs at a time, and it does one small instruction per tick. The switch to another thread can happen between any two instructions.',
    whyItMatters:
      'Real CPUs can be interrupted at any instruction too; on a multi-core machine two threads really run at once. One CPU and one op per tick keeps every interleaving countable.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.registers',
    text: 'Each thread has its own registers, starting at 0. load and store are the only ops that touch shared memory; add changes only the register.',
    detail:
      'So counter++ is three ops, as in OSTEP Figure 26.7, and a thread can be interrupted between them.',
    plain:
      'Each thread works on its own private copy in a register. Only load (read) and store (write) touch the shared variable.',
    whyItMatters:
      'If counter++ were a single op, no interleaving could lose an update and the race would vanish. Splitting it into load, add and store is what makes the race possible.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.tas',
    text: 'A mutex is a test-and-set spin lock. lock on a free mutex takes it in one tick. lock on a held mutex spins: the tick is spent, nothing changes, and the same lock runs again next time.',
    plain:
      'A lock is taken in one step if it is free. If it is held, the thread keeps retrying (spinning) and wastes its turn.',
    whyItMatters:
      'Many books describe a lock that puts the waiter to sleep instead of spinning. The outcomes are the same; only the wasted ticks differ.',
    citation: 'ostep.28.7',
  },
  {
    id: 'sync.unlock.owner',
    text: 'Only the thread holding a mutex may unlock it. Any other unlock is an error, and the run stops.',
    plain:
      'Only the thread that took a lock may release it. Releasing someone else’s lock is a bug, and the run stops there.',
    whyItMatters:
      'Some lock implementations allow it silently. Stopping makes the mistake visible instead of letting it corrupt the run.',
    citation: 'ostep.28.1',
  },
  {
    id: 'sync.sem.value',
    text: 'A semaphore’s value never goes below 0. wait on a positive value decrements it; wait on 0 puts the thread to sleep at the back of the semaphore’s FIFO queue.',
    detail:
      'OSTEP’s implementation lets the value go negative to count the sleepers. Here the value stops at 0 and the queue length is that count.',
    plain:
      'A semaphore counts free slots. wait takes one if there is one, otherwise the thread sleeps in a first-come, first-served queue.',
    whyItMatters:
      'In OSTEP the value goes negative to count sleepers. Here it stops at 0 and you read the sleepers from the queue; the order threads wake in is the same.',
    citation: 'ostep.31.1',
  },
  {
    id: 'sync.sem.signal',
    text: 'signal wakes the first sleeper, which completes its wait without the value changing. With nobody asleep, signal adds 1 to the value.',
    detail: 'Either way, value = initial value + signals − completed waits.',
    plain:
      'signal wakes the thread that has slept longest. If nobody is asleep, it adds one to the count instead.',
    whyItMatters:
      'If your book wakes a random sleeper instead of the first, a different thread may run next, but the totals still balance.',
    citation: 'ostep.31.1',
  },
  {
    id: 'sync.manual',
    text: 'A manual schedule may pick only a thread that can make progress: not finished, not asleep, and not about to spin. The first pick that can’t run ends the run.',
    plain:
      'When you pick by hand, you can only pick a thread that can actually do something right now.',
    whyItMatters:
      'Without this, a pick could waste a tick on a sleeping or finished thread, and two schedules that look the same would give different tick counts.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.rr',
    text: 'Round robin gives T0, T1, … the CPU in turn for up to a quantum of ticks each. A thread gives it up early when it finishes, sleeps or yields. A spinner keeps its turn and spends it spinning; finished and sleeping threads are skipped.',
    plain:
      'Round robin takes turns: each thread runs up to the quantum, then the next one goes. Threads that are done or asleep are skipped.',
    whyItMatters:
      'A spinning thread keeps its turn and burns it, as a real spin lock does. With a sleeping lock it would give the CPU up at once.',
    citation: 'ostep.28.7',
  },
  {
    id: 'sync.random',
    text: 'Seeded random picks uniformly, each tick, among the threads that are ready or spinning, using the seed shown. The same seed gives the same run.',
    plain:
      'Random picks a thread that can run, by dice roll. The seed fixes the dice, so the same seed always gives the same run.',
    whyItMatters:
      'A real scheduler is not random but is just as unpredictable. Fixing the seed is what makes a run shareable as a link.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.stuck',
    text: 'A run ends as stuck when no thread can make progress: each unfinished thread is asleep, or spinning on a lock whose holder can’t release it. It is called a deadlock when two or more threads wait and none of them waits for a lock kept by a thread that has finished.',
    detail:
      'A finished thread that kept its lock (a forgotten unlock) leaves the waiter stuck with no cycle, so that case is reported as stuck, not deadlocked.',
    plain:
      'A run is stuck when no thread can move. It is a deadlock when threads wait on each other in a loop.',
    whyItMatters:
      'Some books call any permanent wait a deadlock. Here a lock left held by a finished thread is called stuck, because there is no cycle to break.',
    citation: 'ostep.32.3',
  },
  {
    id: 'sync.limit',
    text: 'Round robin and random runs stop after 300 ticks.',
    plain:
      'Round robin and random stop after 300 ticks, so a run that spins forever still ends.',
    whyItMatters:
      'Without a limit, a spin that can never succeed would run forever and the page would hang.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.explore',
    text: 'Exploration counts every sequence of picks among threads that can make progress, to the end. Spins are left out: a spin changes nothing, so it cannot change how a run ends.',
    plain:
      'The outcome count tries every possible order of the threads, skipping ticks that only spin.',
    whyItMatters:
      'Counting spins would turn some finite runs into infinitely many, without adding a single new ending.',
    citation: 'ostep.26.4',
  },
  {
    id: 'sync.lost',
    text: 'A store is marked as a lost update when another thread stored to the same variable after this thread loaded it.',
    plain:
      'An update is lost when a thread writes back a value it read before the other thread wrote. The other thread’s write is wiped out.',
    whyItMatters:
      'This is the classic race on counter++. The struck-through value in Shared memory is the update that was lost.',
    citation: 'ostep.26.4',
  },
];
