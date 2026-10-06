/**
 * Validation messages in plain words (docs/UIUX.md G11). The core's Zod schema says what
 * is wrong in developer terms ("Each burst must be at most 100"); this maps each issue,
 * by the field it is about, to one sentence a student can act on. The schema stays the
 * single judge of what is valid; only the wording changes.
 */

import { LIMITS, type ValidationIssue } from '@/core/sched/workload';

export const HUMAN = {
  arrival: `Arrival is a whole number of ticks, from 0 to ${LIMITS.maxArrival}.`,
  priority: `Priority is 0–${LIMITS.maxPriority}; 0 is the highest.`,
  burst: `Each burst is a whole number of ticks, from ${LIMITS.minBurst} to ${LIMITS.maxBurst}.`,
  endsWithCpu:
    'Bursts go CPU, I/O, CPU…, so the last one must be a CPU burst: add a CPU burst or remove the last I/O.',
  noBursts: 'Give the process at least one CPU burst.',
  tooManyBursts: `At most ${LIMITS.maxBursts} bursts: ${(LIMITS.maxBursts + 1) / 2} CPU and ${(LIMITS.maxBursts - 1) / 2} I/O.`,
  contextSwitch: `Context-switch cost is 0–${LIMITS.maxContextSwitch} ticks.`,
  noProcesses: 'Add at least one process.',
  tooManyProcesses: `At most ${LIMITS.maxProcesses} processes.`,
  samePid: 'Each process needs a different name.',
  quantum: `The quantum is ${LIMITS.minQuantum}–${LIMITS.maxQuantum} ticks.`,
} as const;

/** The plain-words message for one schema issue. */
export function humanMessage(issue: ValidationIssue): string {
  const [root, , field, part] = issue.path;
  const text = issue.message;
  if (root === 'contextSwitch') return HUMAN.contextSwitch;
  if (root !== 'processes') return text;
  if (issue.path.length === 1) {
    if (/at least/i.test(text)) return HUMAN.noProcesses;
    if (/at most/i.test(text)) return HUMAN.tooManyProcesses;
    if (/different/i.test(text)) return HUMAN.samePid;
    return text;
  }
  if (field === 'arrival') return HUMAN.arrival;
  if (field === 'priority') return HUMAN.priority;
  if (field === 'bursts') {
    if (part !== undefined) return HUMAN.burst;
    if (/start and end with CPU/.test(text)) return HUMAN.endsWithCpu;
    if (/at least one/i.test(text)) return HUMAN.noBursts;
    if (/at most/i.test(text)) return HUMAN.tooManyBursts;
  }
  return text;
}
