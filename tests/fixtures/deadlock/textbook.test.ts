import { describe, expect, it } from 'vitest';

import {
  bankersPresetById,
  deriveMatrices,
  detect,
  graphPresetById,
  needOf,
  OSC10_BANKERS,
  OSC10_BANKERS_AFTER_T1,
  OSC10_DETECT_ALLOCATION,
  OSC10_DETECT_REQUEST,
  OSC10_DETECT_REQUEST_AFTER,
  ragCycle,
  requestResources,
  runGraph,
  runRequest,
  runSafety,
  safety,
} from '@/core/deadlock';

import { final, isSafeSequence, isValidOrder, kinds } from './helpers';

/**
 * OSC10 ch. 8 worked examples. Recorded in tests/fixtures/README.md. Safe sequences and
 * detection orders are validated against the state, not only compared with the book's.
 */

describe('OSC10 §8.6.3.3: Banker’s algorithm, T0–T4 over (10, 5, 7)', () => {
  it('Need = Max − Allocation matches the book', () => {
    expect(needOf(OSC10_BANKERS)).toEqual([
      [7, 4, 3],
      [1, 2, 2],
      [6, 0, 0],
      [0, 1, 1],
      [4, 3, 1],
    ]);
  });

  it('is safe; the book’s ⟨T1, T3, T4, T2, T0⟩ and our ⟨T1, T3, T0, T2, T4⟩ are both valid', () => {
    const result = safety(OSC10_BANKERS);
    expect(result.safe).toBe(true);
    expect(result.order).toEqual([1, 3, 0, 2, 4]);
    expect(isSafeSequence(OSC10_BANKERS, result.order)).toBe(true);
    expect(isSafeSequence(OSC10_BANKERS, [1, 3, 4, 2, 0])).toBe(true);
    // And the checker rejects a sequence that does not work.
    expect(isSafeSequence(OSC10_BANKERS, [0, 1, 2, 3, 4])).toBe(false);
  });

  it('the safety run ends on the same safe sequence', () => {
    const state = final(runSafety(OSC10_BANKERS));
    expect(state.result).toEqual({ kind: 'safe', order: [1, 3, 0, 2, 4] });
    expect(state.finish).toEqual([true, true, true, true, true]);
    expect(state.work).toEqual([10, 5, 7]);
  });

  it('T1 requests (1, 0, 2): granted, and the new state is safe', () => {
    const { outcome, state } = requestResources(OSC10_BANKERS, {
      t: 1,
      request: [1, 0, 2],
    });
    expect(outcome).toBe('granted');
    expect(state.available).toEqual([2, 3, 0]);
    expect(state.allocation[1]).toEqual([3, 0, 2]);
    expect(needOf(state)[1]).toEqual([0, 2, 0]);
    const after = safety(state);
    expect(after.safe).toBe(true);
    expect(isSafeSequence(state, after.order)).toBe(true);
    // The book's sequence for the new state.
    expect(isSafeSequence(state, [1, 3, 4, 0, 2])).toBe(true);
    const run = runRequest(OSC10_BANKERS, { t: 1, request: [1, 0, 2] });
    expect(final(run).result).toEqual({ kind: 'granted' });
    expect(final(run).available).toEqual([2, 3, 0]);
  });

  it('then T4 requests (3, 3, 0): it waits, not enough is available', () => {
    expect(OSC10_BANKERS_AFTER_T1.available).toEqual([2, 3, 0]);
    expect(
      requestResources(OSC10_BANKERS_AFTER_T1, { t: 4, request: [3, 3, 0] }).outcome,
    ).toBe('wait');
    const run = runRequest(OSC10_BANKERS_AFTER_T1, { t: 4, request: [3, 3, 0] });
    expect(kinds(run)).toEqual(['dl.req.need', 'dl.req.available', 'dl.result']);
    expect(final(run).result).toEqual({ kind: 'wait' });
  });

  it('then T0 requests (0, 2, 0): refused, the resulting state is unsafe', () => {
    expect(
      requestResources(OSC10_BANKERS_AFTER_T1, { t: 0, request: [0, 2, 0] }).outcome,
    ).toBe('refused');
    const run = runRequest(OSC10_BANKERS_AFTER_T1, { t: 0, request: [0, 2, 0] });
    expect(final(run).result).toEqual({ kind: 'refused' });
    expect(run.events.find((e) => e.kind === 'dl.result')!.state.result).toEqual({
      kind: 'unsafe',
      stuck: [0, 1, 2, 3, 4],
    });
    // Rolled back to the state before the request.
    expect(final(run).allocation).toEqual(OSC10_BANKERS_AFTER_T1.allocation);
    expect(final(run).available).toEqual([2, 3, 0]);
  });

  it('the presets load these states and queries', () => {
    expect(bankersPresetById('osc10-safe')!.state).toEqual(OSC10_BANKERS);
    expect(bankersPresetById('osc10-t0')!.query).toEqual({
      run: 'request',
      t: 0,
      request: [0, 2, 0],
    });
    expect(final(runRequest(OSC10_BANKERS, { t: 3, request: [1, 0, 0] })).result).toEqual(
      { kind: 'error' },
    );
  });
});

describe('OSC10 §8.7.2: detection, T0–T4 over (7, 2, 6)', () => {
  const before = graphPresetById('osc10-detect')!.graph;
  const after = graphPresetById('osc10-detect-after')!.graph;

  it('the graph derives the book’s matrices, with nothing available', () => {
    const m = deriveMatrices(before);
    expect(m.allocation).toEqual(OSC10_DETECT_ALLOCATION);
    expect(m.request).toEqual(OSC10_DETECT_REQUEST);
    expect(m.available).toEqual([0, 0, 0]);
  });

  it('is not deadlocked; the order found is valid (book: ⟨T0, T2, T3, T1, T4⟩)', () => {
    const m = deriveMatrices(before);
    const result = detect(m);
    expect(result).toEqual({ deadlocked: false, set: [], order: [0, 2, 1, 3, 4] });
    expect(isValidOrder(m.request, m.allocation, m.available, result.order)).toBe(true);
    expect(isValidOrder(m.request, m.allocation, m.available, [0, 2, 3, 1, 4])).toBe(
      true,
    );
    expect(final(runGraph(before, 'detect')).result).toEqual({
      kind: 'not-deadlocked',
      order: [0, 2, 1, 3, 4],
    });
  });

  it('after T2 requests one more C: deadlocked set {T1, T2, T3, T4}', () => {
    const m = deriveMatrices(after);
    expect(m.request).toEqual(OSC10_DETECT_REQUEST_AFTER);
    expect(detect(m)).toEqual({ deadlocked: true, set: [1, 2, 3, 4], order: [0] });
    expect(final(runGraph(after, 'detect')).result).toEqual({
      kind: 'deadlocked',
      set: [1, 2, 3, 4],
    });
  });
});

describe('OSC10 §8.3.2: cycles in resource-allocation graphs', () => {
  it('Figure 8.6: a cycle, but no deadlock', () => {
    const graph = graphPresetById('cycle-no-deadlock')!.graph;
    const m = deriveMatrices(graph);
    expect(ragCycle(m)).toEqual(['T0', 'R0', 'T2', 'R1', 'T0']);
    expect(detect(m).deadlocked).toBe(false);
    const run = runGraph(graph, 'cycle');
    expect(run.events[0]!.kind).toBe('dl.multi');
    expect(run.events[0]!.label).toMatch(/necessary but not sufficient/);
    expect(final(run).result?.kind).toBe('not-deadlocked');
  });

  it('Figure 8.5: a cycle and a deadlock with a multi-instance resource', () => {
    const graph = graphPresetById('multi-deadlock')!.graph;
    expect(detect(deriveMatrices(graph))).toMatchObject({
      deadlocked: true,
      set: [0, 1, 2],
    });
  });
});

describe('classic situations', () => {
  it('two locks: the cycle T0 → R1 → T1 → R0 → T0', () => {
    const run = runGraph(graphPresetById('two-locks')!.graph, 'cycle');
    expect(final(run).result).toEqual({
      kind: 'cycle',
      cycle: ['T0', 'R1', 'T1', 'R0', 'T0'],
    });
    expect(final(run).cycle).toEqual(['T0', 'R1', 'T1', 'R0', 'T0']);
  });

  it('dining philosophers: one five-thread cycle; right-first breaks it', () => {
    const dining = final(runGraph(graphPresetById('dining')!.graph, 'cycle'));
    expect(dining.result).toEqual({
      kind: 'cycle',
      cycle: ['T0', 'R1', 'T1', 'R2', 'T2', 'R3', 'T3', 'R4', 'T4', 'R0', 'T0'],
    });
    const right = graphPresetById('dining-right-first')!.graph;
    expect(final(runGraph(right, 'cycle')).result).toEqual({ kind: 'acyclic' });
    expect(detect(deriveMatrices(right)).deadlocked).toBe(false);
  });
});
