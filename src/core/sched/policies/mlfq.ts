import type { MlfqLevel } from '../workload';
import type { SchedPolicy } from './types';

/**
 * Multi-level feedback queue, OSTEP ch. 8 rules 1-5:
 *
 * 1. If Priority(A) > Priority(B), A runs (B doesn't): a job in a higher queue preempts.
 * 2. If Priority(A) = Priority(B), A and B run round robin with the level's quantum.
 * 3. A new job enters the top queue.
 * 4. Demotion. `rule4: 'allotment'`: once a job has used its level's allotment (counted
 *    across I/O), it moves down a queue. `'original'` (rules 4a/4b): a job that uses a
 *    whole quantum moves down; one that gives up the CPU first keeps its level.
 * 5. Every `boostEvery` ticks, every job moves to the top queue.
 *
 * The policy only picks and preempts; demotion (rule 4) and boost (rule 5) are
 * bookkeeping the kernel does, because they change queues at fixed points of the tick.
 *
 * Levels are numbered from 0 = top (OSTEP draws Q2 at the top; the UI says "Q0 (top)").
 */
export function mlfqPolicy(levels: readonly MlfqLevel[]): SchedPolicy {
  return {
    levels: levels.length,
    citation: 'ostep.8.1',
    name: 'MLFQ',
    queueFor: (proc) => proc.level,
    quantum: (proc) => levels[proc.level]!.quantum,
    pick: (view) => {
      for (let level = 0; level < view.queues.length; level += 1) {
        const pid = view.queues[level]![0];
        if (pid === undefined) continue;
        const higher = level === 0 ? 'the top queue' : 'the highest non-empty queue';
        return {
          pid,
          queue: level,
          reason: `${pid} runs: head of Q${level}, ${higher} (quantum ${levels[level]!.quantum})`,
        };
      }
      return null;
    },
    preempt: (view, running) => {
      for (let level = 0; level < running.level; level += 1) {
        const pid = view.queues[level]![0];
        if (pid === undefined) continue;
        return {
          pid,
          reason: `${pid} in Q${level} preempts ${running.pid} in Q${running.level}: a higher queue always runs first (rule 1)`,
        };
      }
      return null;
    },
  };
}
