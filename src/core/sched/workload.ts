/**
 * The CPU scheduling input: a workload (the processes and the context-switch cost) and a
 * policy, each with a Zod schema and hard limits.
 *
 * The limits keep every run small enough that each event can carry a full snapshot
 * (00-overview §6.14): at most 10 processes and 300 simulated ticks. A process alternates
 * CPU and I/O bursts, starting and ending with CPU, so `bursts` has odd length; a single
 * CPU burst is the default.
 *
 * `zod/mini` for the same reason as the share-state codec: the editor validates in the
 * browser, and the full Zod API would cost the route its JS budget.
 */

import * as z from 'zod/mini';

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

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
}

export const PID_PATTERN = /^P([1-9]|10)$/;

/** `'P3'` → 3. */
export function pidNumber(pid: string): number {
  return Number(pid.slice(1));
}

/** Numeric PID order, so P2 comes before P10. */
export function comparePid(a: string, b: string): number {
  return pidNumber(a) - pidNumber(b);
}

export const PROCESS_SCHEMA = z.object({
  pid: z.string().check(z.regex(PID_PATTERN, 'PID must be P1 to P10')),
  arrival: int(0, LIMITS.maxArrival, 'Arrival'),
  bursts: z.array(int(LIMITS.minBurst, LIMITS.maxBurst, 'Each burst')).check(
    z.minLength(1, 'A process needs at least one CPU burst'),
    z.maxLength(LIMITS.maxBursts, `At most ${LIMITS.maxBursts} bursts`),
    z.refine(
      (bursts) => bursts.length % 2 === 1,
      'Bursts alternate CPU and I/O and must start and end with CPU',
    ),
  ),
  priority: int(0, LIMITS.maxPriority, 'Priority'),
});

export const WORKLOAD_SCHEMA = z.object({
  processes: z.array(PROCESS_SCHEMA).check(
    z.minLength(LIMITS.minProcesses, 'Add at least one process'),
    z.maxLength(LIMITS.maxProcesses, `At most ${LIMITS.maxProcesses} processes`),
    z.refine(
      (processes) => new Set(processes.map((p) => p.pid)).size === processes.length,
      'Each process needs a different PID',
    ),
  ),
  contextSwitch: int(0, LIMITS.maxContextSwitch, 'Context-switch cost'),
});

const QUANTUM = int(LIMITS.minQuantum, LIMITS.maxQuantum, 'Quantum');

export const POLICY_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fcfs') }),
  z.object({ kind: z.literal('sjf') }),
  z.object({ kind: z.literal('srtf') }),
  z.object({
    kind: z.literal('priority'),
    preemptive: z.boolean(),
    aging: z.optional(
      z.object({
        every: int(1, LIMITS.maxAgingEvery, 'Aging interval'),
        by: int(1, LIMITS.maxAgingBy, 'Aging step'),
      }),
    ),
  }),
  z.object({ kind: z.literal('rr'), quantum: QUANTUM }),
  z.object({
    kind: z.literal('mlfq'),
    levels: z
      .array(
        z.object({
          quantum: QUANTUM,
          allotment: int(1, LIMITS.maxAllotment, 'Allotment'),
        }),
      )
      .check(
        z.minLength(LIMITS.minLevels, `MLFQ needs at least ${LIMITS.minLevels} queues`),
        z.maxLength(LIMITS.maxLevels, `MLFQ has at most ${LIMITS.maxLevels} queues`),
      ),
    boostEvery: z.optional(int(1, LIMITS.maxBoostEvery, 'Boost interval')),
    rule4: z.enum(['allotment', 'original']),
  }),
]);

export interface ValidationIssue {
  /** Where the problem is, e.g. `['processes', 2, 'bursts', 0]`. */
  path: (string | number)[];
  message: string;
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

function validate<T>(schema: z.ZodMiniType<T>, input: unknown): Validation<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
      message: issue.message,
    })),
  };
}

export function validateWorkload(input: unknown): Validation<Workload> {
  return validate(WORKLOAD_SCHEMA as unknown as z.ZodMiniType<Workload>, input);
}

export function validatePolicy(input: unknown): Validation<Policy> {
  return validate(POLICY_SCHEMA as unknown as z.ZodMiniType<Policy>, input);
}

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
