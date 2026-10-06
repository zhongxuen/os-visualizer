/**
 * Turning a deadlock run into words and shapes. Pure functions, no React: the module
 * renders the core's decisions, it never makes its own.
 */

import { coffman, type CoffmanCondition } from '@/core/deadlock/coffman';
import type { DlRun } from '@/core/deadlock/emitter';
import type { DlEvent, DlEventKind, DlResult, DlSnapshot } from '@/core/deadlock/events';
import { formatCycle, ragCycle } from '@/core/deadlock/graph';
import {
  applyRecovery,
  deriveMatrices,
  describeRecovery,
  graphFromMatrices,
  listProcesses,
  processName,
  resourceName,
  type Graph,
  type RagMatrices,
  type Recovery,
} from '@/core/deadlock/model';

/** The event on screen at step position `step` (0-based; the end clamps to the last). */
export function eventAt(run: DlRun, step: number): DlEvent | undefined {
  if (run.events.length === 0) return undefined;
  return run.events[Math.max(0, Math.min(step, run.events.length - 1))];
}

export function processLabels(n: number): string[] {
  return Array.from({ length: n }, (_, t) => processName(t));
}

export function resourceLabels(m: number): string[] {
  return Array.from({ length: m }, (_, r) => resourceName(r));
}

function count(n: number, r: number): string {
  return n === 1 ? resourceName(r) : `${n} of ${resourceName(r)}`;
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** The graph as a snapshot shows it (after any recovery so far). */
export function graphAt(state: DlSnapshot): Graph {
  return graphFromMatrices(
    state.total,
    state.allocation,
    state.request ?? state.allocation.map((row) => row.map(() => 0)),
  );
}

/**
 * The always-available text version of the graph: one sentence per thread, then the
 * first cycle. "T1 holds R2, requests R1. Cycle: T1 → R1 → T3 → R2 → T1."
 */
export function graphSummary(
  m: Pick<RagMatrices, 'allocation' | 'request'>,
  terminated: readonly number[] = [],
): string[] {
  const lines = m.allocation.map((row, t) => {
    const name = processName(t);
    if (terminated.includes(t)) return `${name} was terminated.`;
    const holds = row.flatMap((n, r) => (n > 0 ? [count(n, r)] : []));
    const wants = m.request[t]!.flatMap((n, r) => (n > 0 ? [count(n, r)] : []));
    if (holds.length === 0 && wants.length === 0) return `${name} holds nothing.`;
    const parts = [
      holds.length > 0 ? `holds ${joinAnd(holds)}` : 'holds nothing',
      ...(wants.length > 0 ? [`requests ${joinAnd(wants)}`] : []),
    ];
    return `${name} ${parts.join(', ')}.`;
  });
  const cycle = ragCycle(m);
  lines.push(cycle ? `Cycle: ${formatCycle(cycle)}.` : 'No cycle.');
  return lines;
}

/** The result in one sentence. */
export function resultText(result: DlResult): string {
  switch (result.kind) {
    case 'cycle':
      return `Deadlocked: cycle ${formatCycle(result.cycle)}.`;
    case 'acyclic':
      return 'Not deadlocked: the wait-for graph has no cycle.';
    case 'not-deadlocked':
      return result.order.length === 0
        ? 'Not deadlocked.'
        : `Not deadlocked: ⟨${result.order.map(processName).join(', ')}⟩ can finish in turn.`;
    case 'deadlocked':
      return `Deadlocked: ${listProcesses(result.set)}.`;
    case 'safe':
      return `Safe. Safe sequence ⟨${result.order.map(processName).join(', ')}⟩ (one of possibly several).`;
    case 'unsafe':
      return `Unsafe: ${listProcesses(result.stuck)} cannot be sure to finish.`;
    case 'granted':
      return 'Granted: the state after the request is safe.';
    case 'error':
      return 'Error: the request exceeds the thread’s maximum claim.';
    case 'wait':
      return 'Wait: not enough is available.';
    case 'refused':
      return 'Refused: the state after the request would be unsafe, so the thread waits.';
  }
}

/** Whether a result is bad news (deadlock, unsafe, refused), for its colour. */
export function isBad(result: DlResult): boolean {
  return ['cycle', 'deadlocked', 'unsafe', 'error', 'refused', 'wait'].includes(
    result.kind,
  );
}

/** The last result in the run: what the whole run decided. */
export function finalResult(run: DlRun): DlResult | null {
  for (let i = run.events.length - 1; i >= 0; i -= 1) {
    const result = run.events[i]!.state.result;
    if (result) return result;
  }
  return null;
}

/** True when the graph run ends deadlocked. */
export function endsDeadlocked(run: DlRun): boolean {
  const result = finalResult(run);
  return result?.kind === 'cycle' || result?.kind === 'deadlocked';
}

/** The Coffman conditions at a step. */
export function coffmanAt(state: DlSnapshot): CoffmanCondition[] {
  return coffman(
    {
      allocation: state.allocation,
      request: state.request ?? state.allocation.map((row) => row.map(() => 0)),
    },
    state.preempted.length > 0,
  );
}

/** Threads a recovery could act on, and the resources each holds, after `recovery`. */
export function recoveryOptions(
  graph: Graph,
  recovery: readonly Recovery[],
): { terminate: number[]; preempt: { t: number; r: number }[] } {
  let m = deriveMatrices(graph);
  const terminated: number[] = [];
  for (const action of recovery) {
    const next = applyRecovery(m, terminated, action);
    if (!next.ok) break;
    m = next.value;
    if (action.kind === 'terminate') terminated.push(action.t);
  }
  const live = m.allocation.flatMap((row, t) =>
    !terminated.includes(t) &&
    (row.some((n) => n > 0) || m.request[t]!.some((n) => n > 0))
      ? [t]
      : [],
  );
  const preempt = m.allocation.flatMap((row, t) =>
    terminated.includes(t) ? [] : row.flatMap((n, r) => (n > 0 ? [{ t, r }] : [])),
  );
  return { terminate: live, preempt };
}

const KIND_NAMES: Record<DlEvent['kind'], string> = {
  'dl.wfg': 'wait-for graph',
  'dl.multi': 'several instances',
  'dl.visit': 'DFS visit',
  'dl.edge': 'DFS edge',
  'dl.backtrack': 'DFS backtrack',
  'dl.cycle': 'cycle found',
  'dl.acyclic': 'no cycle',
  'dl.init': 'set up',
  'dl.check': 'check a row',
  'dl.finish': 'thread finishes',
  'dl.result': 'result',
  'dl.req.need': 'Request ≤ Need?',
  'dl.req.available': 'Request ≤ Available?',
  'dl.req.pretend': 'pretend to allocate',
  'dl.req.grant': 'grant',
  'dl.req.rollback': 'roll back',
  'dl.recover': 'recovery',
};

/** The inspector heading for an event. */
export function stepHeading(event: DlEvent | undefined, run: DlRun): string {
  if (!event) return 'This step';
  const index = run.events.indexOf(event);
  return `Step ${index + 1} of ${run.events.length}: ${KIND_NAMES[event.kind]}`;
}

/** What the thread that finished on this step gave back (its Allocation row), if one did. */
export function releasedAt(
  state: DlSnapshot,
  kind: DlEventKind | undefined,
): { t: number; values: number[] } | null {
  if (kind !== 'dl.finish' || state.row === null) return null;
  const values = state.allocation[state.row];
  return values ? { t: state.row, values: [...values] } : null;
}

/**
 * The modelling rule (`DL_RULES`) that decided a step, for the inspector's "Rule used"
 * chip (G5), or `null` when the step follows from the textbook alone.
 */
export function ruleIdFor(event: DlEvent | undefined): string | null {
  if (!event) return null;
  switch (event.kind) {
    case 'dl.wfg':
      return 'dl.wfg';
    case 'dl.multi':
      return 'dl.cycle.multi';
    case 'dl.visit':
    case 'dl.edge':
    case 'dl.backtrack':
    case 'dl.cycle':
      return 'dl.dfs.order';
    case 'dl.init':
      return event.state.algorithm === 'detect' ? 'dl.detect.finish' : null;
    case 'dl.check':
    case 'dl.finish':
      return 'dl.scan.order';
    case 'dl.result': {
      const kind = event.state.result?.kind;
      return kind === 'safe' || kind === 'not-deadlocked'
        ? 'dl.scan.order'
        : kind === 'error' || kind === 'wait'
          ? 'dl.request.steps'
          : null;
    }
    case 'dl.req.need':
    case 'dl.req.available':
    case 'dl.req.pretend':
    case 'dl.req.grant':
    case 'dl.req.rollback':
      return 'dl.request.steps';
    case 'dl.recover':
      return event.process !== undefined && event.state.terminated.includes(event.process)
        ? 'dl.recover.terminate'
        : 'dl.recover.preempt';
    case 'dl.acyclic':
      return null;
  }
}

export type CheckStatus = 'pending' | 'current' | 'pass' | 'fail';

export interface RequestCheck {
  id: 'need' | 'available' | 'pretend' | 'safety' | 'decision';
  label: string;
  status: CheckStatus;
  /** The status changed on this step. */
  changed: boolean;
}

function checklistAt(run: DlRun, step: number): Omit<RequestCheck, 'changed'>[] {
  const seen = step < 0 ? [] : run.events.slice(0, step + 1);
  const last = seen.at(-1);
  const find = (kind: DlEventKind) => seen.find((e) => e.kind === kind);
  const need = find('dl.req.need');
  const available = find('dl.req.available');
  const pretend = find('dl.req.pretend');
  const grant = find('dl.req.grant');
  const rollback = find('dl.req.rollback');
  const safetyResult = pretend
    ? seen.slice(seen.indexOf(pretend)).find((e) => e.kind === 'dl.result')
    : undefined;
  const fits = (e: DlEvent) => e.state.compare?.fits ?? false;
  const inSafety = pretend !== undefined && last !== pretend && !safetyResult;

  return [
    {
      id: 'need',
      label: 'Request ≤ Need (within its declared maximum)',
      status: need ? (fits(need) ? 'pass' : 'fail') : 'pending',
    },
    {
      id: 'available',
      label: 'Request ≤ Available (free right now)',
      status: available ? (fits(available) ? 'pass' : 'fail') : 'pending',
    },
    { id: 'pretend', label: 'Pretend to allocate', status: pretend ? 'pass' : 'pending' },
    {
      id: 'safety',
      label: 'Safety algorithm on the pretend state',
      status: safetyResult
        ? safetyResult.state.result?.kind === 'safe'
          ? 'pass'
          : 'fail'
        : inSafety
          ? 'current'
          : 'pending',
    },
    {
      id: 'decision',
      label: rollback ? 'Roll back: the thread waits' : 'Grant the request',
      status: grant ? 'pass' : rollback ? 'fail' : 'pending',
    },
  ];
}

/**
 * A Banker's request as a checklist that ticks (§7.2.5): Request ≤ Need, Request ≤
 * Available, pretend to allocate, the safety algorithm, then grant or roll back. Read
 * off the events up to and including step `step`; `changed` marks the checks whose
 * status this step changed, which are the ones that flash.
 */
export function requestChecklist(run: DlRun, step: number): RequestCheck[] {
  const before = checklistAt(run, step - 1);
  return checklistAt(run, step).map((check, i) => ({
    ...check,
    changed: before[i]!.status !== check.status,
  }));
}

/** Whether step `step` of a request run shows the pretend state (after "pretend", before the decision). */
export function isPretending(run: DlRun, step: number): boolean {
  const seen = run.events.slice(0, Math.max(0, step) + 1);
  return (
    seen.some((e) => e.kind === 'dl.req.pretend') &&
    !seen.some((e) => e.kind === 'dl.req.grant' || e.kind === 'dl.req.rollback')
  );
}

/**
 * The Coffman conditions in a beginner's words (D3): what the core marks "assumed" is
 * "always true here", with the reason in one line.
 */
export const ALWAYS_TRUE: Record<'mutual-exclusion' | 'no-preemption', string> = {
  'mutual-exclusion':
    'Always true here: this simulator never shares a resource instance.',
  'no-preemption':
    'Always true here: this simulator never takes a resource back from a thread, unless you preempt one under Recovery.',
};

/** The end-of-run sentence: the result, and for an order, that it is one of several (D5). */
export function endOfRunText(result: DlResult | null): string {
  if (!result) return 'The whole run is on screen. Step back to revisit any part.';
  const text = resultText(result);
  if (result.kind === 'safe') {
    return `Safe: ⟨${result.order.map(processName).join(', ')}⟩ is one safe order (there may be others).`;
  }
  return text;
}

/** A preset to load from the end-of-run card ("Try this next", G16). */
export interface TryNextPreset {
  view: 'graph' | 'bankers';
  presetId: string;
  why: string;
}

/** For each graph preset, the one that contrasts with it, and why. */
const GRAPH_CONTRAST: Record<string, { id: string; why: string }> = {
  'two-locks': {
    id: 'cycle-no-deadlock',
    why: 'A cycle again, but with two instances of a resource: is it still a deadlock?',
  },
  'cycle-no-deadlock': {
    id: 'multi-deadlock',
    why: 'Two instances again, and this time the cycle is a deadlock. Spot the difference.',
  },
  'multi-deadlock': {
    id: 'cycle-no-deadlock',
    why: 'A similar cycle where one thread can still finish and break it.',
  },
  dining: {
    id: 'dining-right-first',
    why: 'One philosopher picks up the other fork first, and the cycle never forms.',
  },
  'dining-right-first': {
    id: 'dining',
    why: 'Everyone picks up the left fork first: five threads in one cycle.',
  },
  'osc10-detect': {
    id: 'osc10-detect-after',
    why: 'The same state after one extra request, which tips it into deadlock.',
  },
  'osc10-detect-after': {
    id: 'osc10-detect',
    why: 'The state one request earlier, when every thread could still finish.',
  },
};

/** For each Banker's result, a preset that ends differently, and why. */
const BANKERS_CONTRAST: Record<DlResult['kind'], { id: string; why: string }> = {
  safe: {
    id: 'osc10-t0',
    why: 'A request that fits in Available, yet Banker’s algorithm refuses it.',
  },
  granted: {
    id: 'osc10-t0',
    why: 'A request that fits in Available, yet Banker’s algorithm refuses it.',
  },
  refused: {
    id: 'osc10-t1',
    why: 'A request Banker’s algorithm grants, for contrast with this refusal.',
  },
  unsafe: {
    id: 'osc10-safe',
    why: 'A safe state, and the order that proves it.',
  },
  error: {
    id: 'osc10-t1',
    why: 'A request within the thread’s claim, which is checked and granted.',
  },
  wait: {
    id: 'osc10-t0',
    why: 'This time enough is free, but granting it would be unsafe.',
  },
  cycle: { id: 'osc10-safe', why: '' },
  acyclic: { id: 'osc10-safe', why: '' },
  'not-deadlocked': { id: 'osc10-safe', why: '' },
  deadlocked: { id: 'osc10-safe', why: '' },
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * "Try this next" for a finished run: a preset that contrasts with what just happened.
 * A graph that is one of the presets gets its pair; any other graph gets a deadlock if
 * it was not deadlocked, and a cycle that is not one if it was.
 */
export function tryNextFor(input: {
  view: 'graph' | 'bankers';
  graph: Graph;
  result: DlResult | null;
  graphPresets: readonly { id: string; graph: Graph }[];
  bankersPresetId?: string | null;
}): TryNextPreset | null {
  if (input.view === 'graph') {
    const preset = input.graphPresets.find((p) => same(p.graph, input.graph));
    const pair = preset ? GRAPH_CONTRAST[preset.id] : undefined;
    if (pair) return { view: 'graph', presetId: pair.id, why: pair.why };
    const deadlocked =
      input.result?.kind === 'cycle' || input.result?.kind === 'deadlocked';
    return deadlocked
      ? {
          view: 'graph',
          presetId: 'cycle-no-deadlock',
          why: 'A cycle that is not a deadlock: why a cycle alone is not enough.',
        }
      : {
          view: 'graph',
          presetId: 'two-locks',
          why: 'The smallest deadlock there is: two threads, two locks.',
        };
  }
  if (!input.result) return null;
  const pair = BANKERS_CONTRAST[input.result.kind];
  const id = pair.id === input.bankersPresetId ? 'osc10-safe' : pair.id;
  return {
    view: 'bankers',
    presetId: id,
    why: id === pair.id ? pair.why : 'Back to the textbook’s safe state.',
  };
}

export { describeRecovery };
