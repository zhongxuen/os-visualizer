import { describe, expect, it } from 'vitest';

import {
  coffman,
  deriveMatrices,
  detect,
  DL_RULES,
  graphPresetById,
  OSC10_BANKERS,
  processName,
  ragCycle,
  resourceName,
  runGraph,
  runRequest,
  safety,
  validateGraph,
  waitForGraph,
  type Graph,
} from '@/core/deadlock';

import { final, kinds } from './helpers';

/**
 * One test per rule in `src/core/deadlock/rules.ts`, named after the rule id. The last
 * test checks the list and the tests stay in step.
 */

const TESTED = new Set<string>();
function rule(id: string, body: () => void) {
  TESTED.add(id);
  it(id, body);
}

const twoLocks = () => graphPresetById('two-locks')!.graph;

describe('deadlock rules', () => {
  rule('dl.names', () => {
    expect(processName(0)).toBe('T0');
    expect(resourceName(4)).toBe('R4');
    expect(graphPresetById('cycle-no-deadlock')!.summary).toMatch(/T1–T4 .* are T0–T3/);
  });

  rule('dl.matrices', () => {
    const m = deriveMatrices(twoLocks());
    expect(m).toEqual({
      total: [1, 1],
      allocation: [
        [1, 0],
        [0, 1],
      ],
      request: [
        [0, 1],
        [1, 0],
      ],
      available: [0, 0],
    });
    const over: Graph = {
      processes: 2,
      instances: [1],
      assignments: [
        { t: 0, r: 0, n: 1 },
        { t: 1, r: 0, n: 1 },
      ],
      requests: [],
    };
    const bad = validateGraph(over);
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(bad.issues[0]!.message).toBe('R0 has 1 instance but 2 are assigned');
    const holdsAndWants = validateGraph({
      processes: 1,
      instances: [2],
      assignments: [{ t: 0, r: 0, n: 1 }],
      requests: [{ t: 0, r: 0, n: 2 }],
    });
    expect(holdsAndWants.ok).toBe(false);
    if (!holdsAndWants.ok) {
      expect(holdsAndWants.issues[0]!.message).toBe(
        'T0 holds 1 of R0 and requests 2 more, but it has only 2',
      );
    }
  });

  rule('dl.scan.order', () => {
    // T0 and T1 both fit at the start; T0 is taken. After it, the scan restarts at T0.
    const state = {
      max: [
        [1, 0],
        [1, 0],
        [0, 2],
      ],
      allocation: [
        [0, 0],
        [0, 0],
        [0, 1],
      ],
      available: [1, 1],
    };
    expect(safety(state).order).toEqual([0, 1, 2]);
    expect(safety(OSC10_BANKERS).order).toEqual([1, 3, 0, 2, 4]);
    const run = runRequest(OSC10_BANKERS, { t: 1, request: [1, 0, 2] });
    // Round 2 rechecks T0 before reaching T3.
    const round2 = run.events
      .filter((e) => e.id.startsWith('dl.safety-round-2.'))
      .map((e) => `${e.kind}:${e.process}`);
    expect(round2).toEqual(['dl.check:0', 'dl.check:2', 'dl.check:3', 'dl.finish:3']);
    expect(final(run).result).toEqual({ kind: 'granted' });
    const safe = run.events.find((e) => e.state.result?.kind === 'safe')!;
    expect(safe.detail).toMatch(/one safe sequence, not the only one/);
  });

  rule('dl.detect.finish', () => {
    // T1 holds nothing and waits for R0, which T0 holds: it starts finished.
    const graph: Graph = {
      processes: 2,
      instances: [1],
      assignments: [{ t: 0, r: 0, n: 1 }],
      requests: [{ t: 1, r: 0, n: 1 }],
    };
    const run = runGraph(graph, 'detect');
    expect(run.events[0]!.state.finish).toEqual([false, true]);
    expect(run.events[0]!.label).toMatch(/Finish is true for T1, which holds nothing/);
    expect(final(run).result).toEqual({ kind: 'not-deadlocked', order: [0] });
    // The safety algorithm starts with every Finish false.
    const bankers = runRequest(OSC10_BANKERS, { t: 1, request: [1, 0, 2] });
    expect(bankers.events.find((e) => e.kind === 'dl.init')!.state.finish).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  rule('dl.dfs.order', () => {
    // Two cycles: T1 ⇄ T2 and T0 → T3 → T0. The DFS starts at T0 and finds T0's first.
    const graph: Graph = {
      processes: 4,
      instances: [1, 1, 1, 1],
      assignments: [
        { t: 0, r: 0, n: 1 },
        { t: 1, r: 1, n: 1 },
        { t: 2, r: 2, n: 1 },
        { t: 3, r: 3, n: 1 },
      ],
      requests: [
        { t: 0, r: 3, n: 1 },
        { t: 1, r: 2, n: 1 },
        { t: 2, r: 1, n: 1 },
        { t: 3, r: 0, n: 1 },
      ],
    };
    const run = runGraph(graph, 'cycle');
    expect(final(run).cycle).toEqual(['T0', 'R3', 'T3', 'R0', 'T0']);
    expect(run.events.filter((e) => e.kind === 'dl.visit').map((e) => e.process)).toEqual(
      [0, 3],
    );
    // Ascending neighbours: T1 waits for T2 and T3; T2 is tried first.
    const fork: Graph = {
      processes: 4,
      instances: [1, 1, 1],
      assignments: [
        { t: 0, r: 0, n: 1 },
        { t: 2, r: 1, n: 1 },
        { t: 3, r: 2, n: 1 },
      ],
      requests: [
        { t: 1, r: 1, n: 1 },
        { t: 1, r: 2, n: 1 },
      ],
    };
    const visits = runGraph(fork, 'cycle')
      .events.filter((e) => e.kind === 'dl.visit')
      .map((e) => e.process);
    expect(visits).toEqual([0, 1, 2, 3]);
    // In the full graph, threads come before resource types.
    expect(ragCycle(deriveMatrices(twoLocks()))).toEqual(['T0', 'R1', 'T1', 'R0', 'T0']);
  });

  rule('dl.wfg', () => {
    // T0 waits for R0 and R1, both held by T1: one edge, through R0.
    const graph: Graph = {
      processes: 2,
      instances: [1, 1],
      assignments: [
        { t: 1, r: 0, n: 1 },
        { t: 1, r: 1, n: 1 },
      ],
      requests: [
        { t: 0, r: 0, n: 1 },
        { t: 0, r: 1, n: 1 },
      ],
    };
    expect(waitForGraph(deriveMatrices(graph))).toEqual([
      { from: 0, to: 1, resource: 0 },
    ]);
    expect(waitForGraph(deriveMatrices(twoLocks()))).toEqual([
      { from: 0, to: 1, resource: 1 },
      { from: 1, to: 0, resource: 0 },
    ]);
  });

  rule('dl.cycle.multi', () => {
    const single = runGraph(twoLocks(), 'cycle');
    expect(single.events[0]!.kind).toBe('dl.wfg');
    expect(kinds(single)).not.toContain('dl.init');
    const multi = runGraph(graphPresetById('cycle-no-deadlock')!.graph, 'cycle');
    expect(multi.events[0]!.kind).toBe('dl.multi');
    expect(multi.events[0]!.label).toBe(
      'R0 has 2 instances: a cycle is necessary but not sufficient here. Hand over to the detection algorithm.',
    );
    expect(multi.events[1]!.kind).toBe('dl.init');
    expect(kinds(multi)).not.toContain('dl.visit');
  });

  rule('dl.request.steps', () => {
    const granted = runRequest(OSC10_BANKERS, { t: 1, request: [1, 0, 2] });
    expect(kinds(granted).slice(0, 4)).toEqual([
      'dl.req.need',
      'dl.req.available',
      'dl.req.pretend',
      'dl.init',
    ]);
    expect(kinds(granted).at(-1)).toBe('dl.req.grant');
    const error = runRequest(OSC10_BANKERS, { t: 3, request: [1, 0, 0] });
    expect(kinds(error)).toEqual(['dl.req.need', 'dl.result']);
    expect(error.events[1]!.label).toBe('Error: T3 has exceeded its maximum claim.');
    const wait = runRequest(OSC10_BANKERS, { t: 0, request: [4, 0, 0] });
    expect(kinds(wait)).toEqual(['dl.req.need', 'dl.req.available', 'dl.result']);
    expect(final(wait).result).toEqual({ kind: 'wait' });
    const pretend = granted.events[2]!;
    expect(pretend.state.changed).toEqual([
      [1, 0],
      [1, 2],
    ]);
  });

  rule('dl.recover.terminate', () => {
    const run = runGraph(twoLocks(), 'cycle', [{ kind: 'terminate', t: 1 }]);
    const recover = run.events.find((e) => e.kind === 'dl.recover')!;
    expect(recover.state.allocation).toEqual([
      [1, 0],
      [0, 0],
    ]);
    expect(recover.state.request).toEqual([
      [0, 1],
      [0, 0],
    ]);
    expect(recover.state.available).toEqual([0, 1]);
    expect(recover.state.terminated).toEqual([1]);
    // Detection runs again by itself.
    expect(final(run).result).toEqual({ kind: 'acyclic' });
    expect(run.phases.map((p) => p.id)).toContain('r1.wfg');
  });

  rule('dl.recover.preempt', () => {
    const run = runGraph(twoLocks(), 'cycle', [{ kind: 'preempt', t: 0, r: 0 }]);
    const recover = run.events.find((e) => e.kind === 'dl.recover')!;
    expect(recover.state.allocation[0]).toEqual([0, 0]);
    expect(recover.state.request![0]).toEqual([1, 1]);
    expect(recover.state.available).toEqual([1, 0]);
    expect(recover.state.preempted).toEqual([{ t: 0, r: 0 }]);
    expect(final(run).result).toEqual({ kind: 'acyclic' });
    // Detection agrees: T1 gets R0, finishes, and T0 follows.
    expect(detect(recover.state as never)).toMatchObject({ deadlocked: false });
  });

  rule('dl.coffman', () => {
    const m = deriveMatrices(twoLocks());
    const conditions = coffman(m);
    expect(conditions.map((c) => [c.id, c.status])).toEqual([
      ['mutual-exclusion', 'assumed'],
      ['hold-and-wait', 'holds'],
      ['no-preemption', 'assumed'],
      ['circular-wait', 'holds'],
    ]);
    expect(conditions[0]!.text).toMatch(/^Assumed by the model/);
    expect(conditions[3]!.text).toMatch(/T0 → R1 → T1 → R0 → T0/);
    expect(coffman(m, true)[2]).toMatchObject({ status: 'violated' });
    expect(coffman(m, true)[2]!.text).toMatch(/^Violated by you/);
    const free = deriveMatrices(graphPresetById('dining-right-first')!.graph);
    expect(coffman(free).map((c) => c.status)).toEqual([
      'assumed',
      'holds',
      'assumed',
      'absent',
    ]);
  });

  it('every rule has a test', () => {
    expect([...TESTED].sort()).toEqual(DL_RULES.map((r) => r.id).sort());
  });
});
