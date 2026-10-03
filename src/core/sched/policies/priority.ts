import { minByKey, pickByKey, readyPids, type SchedPolicy } from './types';

/**
 * Priority scheduling. Lower number = higher priority. Preemptive or not; aging (applied
 * by the kernel) lowers a waiting process's effective priority number.
 */
export function priorityPolicy(preemptive: boolean): SchedPolicy {
  return {
    levels: 1,
    citation: 'osc10.5.3.4',
    name: preemptive ? 'Preemptive priority' : 'Priority',
    queueFor: () => 0,
    quantum: () => null,
    pick: (view) =>
      pickByKey(
        view,
        (p) => p.priority,
        (n) => `highest priority (${n}; lower number = higher priority)`,
      ),
    preempt: (view, running) => {
      if (!preemptive) return null;
      const best = minByKey(readyPids(view), (pid) => view.procs[pid]!.priority);
      if (!best) return null;
      const priority = view.procs[best.pid]!.priority;
      if (priority >= running.priority) return null;
      return {
        pid: best.pid,
        reason: `${best.pid} preempts ${running.pid}: priority ${priority} beats ${running.priority}`,
      };
    },
  };
}
