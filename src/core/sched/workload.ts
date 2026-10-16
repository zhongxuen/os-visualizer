/**
 * The CPU scheduling input: a workload (the processes and the context-switch cost) and a
 * policy, with hard limits. Their Zod schemas and validators are in `workload.schema.ts`.
 *
 * The limits keep every run small enough that each event can carry a full snapshot
 * (00-overview §6.14): at most 10 processes and 300 simulated ticks. A process alternates
 * CPU and I/O bursts, starting and ending with CPU, so `bursts` has odd length; a single
 * CPU burst is the default.
 *
 * This file has no Zod, so a page that only shows a run never loads it (docs/UIUX.md
 * §10.5).
 */

export const LIMITS = {
  minProcesses: 1,
  maxProcesses: 10,
  maxArrival: 100,
  minBurst: 1,
  maxBurst: 100,
  /** CPU, I/O, CPU, ... at most five CPU bursts. */
  maxBursts: 9,
  maxPriority: 9,
  maxContextSwitch: 3,
  minQuantum: 1,
  maxQuantum: 10,
  minLevels: 2,
  maxLevels: 4,
  maxAllotment: 50,
  maxBoostEvery: 300,
  maxAgingEvery: 50,
  maxAgingBy: 9,
  /** The kernel stops with a `sched.limit` event rather than run longer than this. */
  maxTicks: 300,
} as const;

export interface Process {
  /** `'P1'` .. `'P10'`. */
  pid: string;
  arrival: number;
  /** CPU, I/O, CPU, ...: odd length, each burst at least 1 tick. */
  bursts: number[];
  /** 0..9, lower number = higher priority. */
  priority: number;
}

export interface Workload {
  processes: Process[];
  /** Ticks per context switch, 0..3. */
  contextSwitch: number;
}

export interface MlfqLevel {
  quantum: number;
  allotment: number;
}

export type Policy =
  | { kind: 'fcfs' }
  | { kind: 'sjf' }
  | { kind: 'srtf' }
  | { kind: 'priority'; preemptive: boolean; aging?: { every: number; by: number } }
  | { kind: 'rr'; quantum: number }
  | {
      kind: 'mlfq';
      levels: MlfqLevel[];
      boostEvery?: number;
      rule4: 'allotment' | 'original';
    };

export type PolicyKind = Policy['kind'];

export const PID_PATTERN = /^P([1-9]|10)$/;

/** `'P3'` → 3. */
export function pidNumber(pid: string): number {
  return Number(pid.slice(1));
}

/** Numeric PID order, so P2 comes before P10. */
export function comparePid(a: string, b: string): number {
  return pidNumber(a) - pidNumber(b);
}

export interface ValidationIssue {
  /** Where the problem is, e.g. `['processes', 2, 'bursts', 0]`. */
  path: (string | number)[];
  message: string;
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

/** Short display name: "FCFS", "RR q=4", "Priority (preemptive, aging)". */
export function policyName(policy: Policy): string {
  switch (policy.kind) {
    case 'fcfs':
      return 'FCFS';
    case 'sjf':
      return 'SJF';
    case 'srtf':
      return 'SRTF';
    case 'priority': {
      const parts = [policy.preemptive ? 'preemptive' : 'non-preemptive'];
      if (policy.aging) parts.push('aging');
      return `Priority (${parts.join(', ')})`;
    }
    case 'rr':
      return `RR q=${policy.quantum}`;
    case 'mlfq':
      return `MLFQ ${policy.levels.length} queues${policy.boostEvery ? `, boost ${policy.boostEvery}` : ''}${policy.rule4 === 'original' ? ', old rule 4' : ''}`;
  }
}

/** Sum of a process's CPU bursts (the even indexes). */
export function totalCpu(process: Process): number {
  return process.bursts.reduce((sum, b, i) => (i % 2 === 0 ? sum + b : sum), 0);
}

/** Sum of a process's I/O bursts (the odd indexes). */
export function totalIo(process: Process): number {
  return process.bursts.reduce((sum, b, i) => (i % 2 === 1 ? sum + b : sum), 0);
}
