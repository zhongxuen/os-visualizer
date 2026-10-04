import { describe, expect, it } from 'vitest';

import {
  DEADLOCK_SHARE_STATE,
  DEFAULT_INPUT,
  EMPTY_GRAPH,
  GRAPH_PRESETS,
  BANKERS_PRESETS,
  graphFromMatrices,
  deriveMatrices,
  OSC10_BANKERS,
  recoveryIssues,
  resizeBankers,
  validateBankers,
  validateGraph,
  withEdge,
  withInstances,
  withoutEdge,
  withoutProcess,
  withoutResource,
  withProcess,
  withResource,
  type Graph,
} from '@/core/deadlock';
import { decodeShareState, encodeShareState } from '@/core/state/shareState';

function ok<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('expected ok');
  return result.value;
}

function messages(result: { ok: boolean; issues?: { message: string }[] }): string[] {
  return result.ok ? [] : (result.issues ?? []).map((i) => i.message);
}

describe('graph model', () => {
  it('every preset is a valid graph that round-trips through its matrices', () => {
    for (const preset of GRAPH_PRESETS) {
      expect(validateGraph(preset.graph).ok, preset.id).toBe(true);
      const m = deriveMatrices(preset.graph);
      expect(graphFromMatrices(m.total, m.allocation, m.request), preset.id).toEqual(
        preset.graph,
      );
    }
  });

  it('builds the two-lock deadlock edit by edit, merging repeated edges', () => {
    let g: Graph = EMPTY_GRAPH;
    g = ok(withEdge(g, 'assignments', 0, 0, 1));
    g = ok(withEdge(g, 'assignments', 1, 1, 1));
    g = ok(withEdge(g, 'requests', 1, 0, 1));
    g = ok(withEdge(g, 'requests', 0, 1, 1));
    expect(g).toEqual(GRAPH_PRESETS[0]!.graph);
    // A second instance of R0 for T0 is too many.
    expect(messages(withEdge(g, 'assignments', 0, 0, 1))).toEqual([
      'R0 has 1 instance but 2 are assigned',
    ]);
    g = ok(withInstances(g, 0, 3));
    expect(ok(withEdge(g, 'assignments', 0, 0, 1)).assignments[0]).toEqual({
      t: 0,
      r: 0,
      n: 2,
    });
    expect(withoutEdge(g, 'requests', 0, 1).requests).toEqual([{ t: 1, r: 0, n: 1 }]);
  });

  it('adds and removes threads and resource types, renumbering edges', () => {
    const g = GRAPH_PRESETS[0]!.graph;
    expect(ok(withProcess(g)).processes).toBe(3);
    const less = ok(withoutProcess(g, 0));
    expect(less).toEqual({
      processes: 1,
      instances: [1, 1],
      assignments: [{ t: 0, r: 1, n: 1 }],
      requests: [{ t: 0, r: 0, n: 1 }],
    });
    expect(ok(withResource(g, 4)).instances).toEqual([1, 1, 4]);
    expect(ok(withoutResource(g, 0))).toEqual({
      processes: 2,
      instances: [1],
      assignments: [{ t: 1, r: 0, n: 1 }],
      requests: [{ t: 0, r: 0, n: 1 }],
    });
    expect(
      messages(withoutProcess({ ...g, processes: 1, assignments: [], requests: [] }, 0)),
    ).toEqual(['Threads must be at least 1']);
  });

  it('rejects edges to missing nodes and duplicate edges', () => {
    expect(
      messages(
        validateGraph({
          ...EMPTY_GRAPH,
          assignments: [
            { t: 5, r: 0, n: 1 },
            { t: 0, r: 0, n: 1 },
            { t: 0, r: 0, n: 1 },
          ],
        }),
      ),
    ).toEqual(['T5 does not exist', 'T0 and R0 already have an assignment edge']);
  });

  it('checks recovery against the graph, in order', () => {
    const g = GRAPH_PRESETS[0]!.graph;
    expect(recoveryIssues(g, [{ kind: 'terminate', t: 1 }])).toEqual([]);
    expect(
      recoveryIssues(g, [
        { kind: 'terminate', t: 1 },
        { kind: 'terminate', t: 1 },
      ]),
    ).toEqual([{ path: ['recovery', 1], message: 'T1 was already terminated' }]);
    expect(recoveryIssues(g, [{ kind: 'preempt', t: 0, r: 1 }])[0]!.message).toBe(
      'T0 holds no instance of R1',
    );
  });
});

describe('Banker’s model', () => {
  it('every preset state is valid', () => {
    for (const preset of BANKERS_PRESETS) {
      expect(validateBankers(preset.state).ok, preset.id).toBe(true);
    }
  });

  it('rejects Allocation above Max and ragged rows', () => {
    const bad = {
      ...OSC10_BANKERS,
      allocation: [[8, 1, 0], ...OSC10_BANKERS.allocation.slice(1)],
    };
    expect(messages(validateBankers(bad))).toEqual([
      'T0 holds 8 of R0 but its maximum is 7',
    ]);
    expect(messages(validateBankers({ ...OSC10_BANKERS, available: [3, 3] }))[0]).toBe(
      'T0 needs 2 values',
    );
  });

  it('resizes, keeping what fits', () => {
    const small = resizeBankers(OSC10_BANKERS, 2, 2);
    expect(small).toEqual({
      max: [
        [7, 5],
        [3, 2],
      ],
      allocation: [
        [0, 1],
        [2, 0],
      ],
      available: [3, 3],
    });
    expect(resizeBankers(small, 3, 3).max[2]).toEqual([0, 0, 0]);
  });
});

describe('share state', () => {
  it('round-trips a graph with recovery and a Banker’s request through a link', () => {
    const state = {
      ...DEADLOCK_SHARE_STATE.defaults,
      step: 7,
      input: {
        ...DEFAULT_INPUT,
        view: 'bankers' as const,
        recovery: [{ kind: 'terminate' as const, t: 1 }],
        query: { run: 'request' as const, t: 1, request: [1, 0, 2] },
      },
    };
    const encoded = encodeShareState(DEADLOCK_SHARE_STATE, state);
    expect(encoded).not.toBeNull();
    expect(decodeShareState(DEADLOCK_SHARE_STATE, encoded)).toEqual(state);
  });

  it('falls back on a recovery the graph cannot do', () => {
    const bad = {
      ...DEADLOCK_SHARE_STATE.defaults,
      input: { ...DEFAULT_INPUT, recovery: [{ kind: 'preempt', t: 0, r: 1 }] },
    };
    const encoded = Buffer.from(JSON.stringify(bad)).toString('base64url');
    expect(decodeShareState(DEADLOCK_SHARE_STATE, encoded)).toEqual(
      DEADLOCK_SHARE_STATE.defaults,
    );
  });
});
