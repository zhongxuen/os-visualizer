/**
 * The CPU scheduling input's Zod schemas and validators (see `workload.ts` for the
 * types, limits and helpers).
 *
 * Kept apart from `workload.ts` so a page can show a run without loading Zod: only the
 * editors, a `?s=` link and saved inputs need validation, and they load this on demand
 * (docs/UIUX.md §10.5). `zod/mini` for the same reason as the share-state codec.
 */

import * as z from 'zod/mini';

import { LIMITS, PID_PATTERN, type Policy, type Validation, type Workload } from './workload';

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
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
