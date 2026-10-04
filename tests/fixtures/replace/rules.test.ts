import { describe, expect, it } from 'vitest';

import { BELADY_STRING, beladyPoints, faultsByFrames, REPL_RULES } from '@/core/replace';

import { eventsOf, kindsOf, run } from './helpers';

/**
 * One test per rule in `src/core/replace/rules.ts`, named after the rule id. The last
 * test checks the list and the tests stay in step.
 */

const TESTED = new Set<string>();
function rule(id: string, body: () => void) {
  TESTED.add(id);
  it(id, body);
}

describe('page replacement rules', () => {
  rule('repl.fill.order', () => {
    const { result } = run([5, 6, 7], 3, 'lru');
    const loads = result.events.filter((e) => e.kind === 'repl.load');
    expect(loads.map((e) => e.frame)).toEqual([0, 1, 2]);
    expect(result.events.some((e) => e.kind === 'repl.evict')).toBe(false);
    expect(eventsOf(result, 0)[0]!.state.frames).toEqual([null, null, null]);
  });

  rule('repl.miss.kinds', () => {
    // 1, 2 cold; 3 cold and evicts 1; 1 again is a capacity miss.
    const { result, state } = run([1, 2, 3, 1], 2, 'fifo');
    expect(state).toMatchObject({ faults: 4, cold: 3, hits: 0 });
    const faults = result.events.filter((e) => e.kind === 'repl.fault');
    expect(faults.map((e) => e.cold)).toEqual([true, true, true, false]);
    expect(faults[2]!.label).toMatch(/cold \(compulsory\)/);
    expect(faults[3]!.label).toMatch(/capacity/);
  });

  rule('repl.fifo', () => {
    // 1 is hit after loading but is still evicted first.
    const { result, state } = run([1, 2, 1, 3], 2, 'fifo');
    expect(state.frames).toEqual([3, 2]);
    const victim = eventsOf(result, 3).find((e) => e.kind === 'repl.victim')!;
    expect(victim.label).toBe('Evict 1: loaded first (FIFO).');
    expect(eventsOf(result, 2)[0]!.state.queue).toEqual([1, 2]);
  });

  rule('repl.lru', () => {
    // The hit on 1 makes 2 the least recently used.
    const { result, state } = run([1, 2, 1, 3], 2, 'lru');
    expect(state.frames).toEqual([1, 3]);
    const victim = eventsOf(result, 3).find((e) => e.kind === 'repl.victim')!;
    expect(victim.label).toBe('Evict 2: not used for the longest time (LRU).');
    expect(eventsOf(result, 2)[0]!.state.lastUse).toEqual([2, 1]);
  });

  rule('repl.opt', () => {
    // At 4: 1 next at index 4, 2 and 3 never again → tie, lowest frame (2 in frame 1).
    const { result } = run([1, 2, 3, 4, 1], 3, 'opt');
    const victim = eventsOf(result, 3).find((e) => e.kind === 'repl.victim')!;
    expect(victim).toMatchObject({ page: 2, frame: 1 });
    expect(victim.label).toBe('Evict 2: not needed again (OPT).');
    expect(victim.detail).toMatch(/lowest-numbered frame/);
    expect(victim.state.nextUse).toEqual([4, null, null]);
    // Furthest next use wins when every page is used again.
    const far = run([1, 2, 3, 1, 2], 2, 'opt').result;
    const v = eventsOf(far, 2).find((e) => e.kind === 'repl.victim')!;
    expect(v.page).toBe(2);
    expect(v.label).toBe('Evict 2: next needed at reference 5, the furthest away (OPT).');
  });

  rule('repl.clock', () => {
    // Fill 1, 2, 3 (bits 1, hand back at 0). 4: sweep clears all three, evicts frame 0.
    const { result } = run([1, 2, 3, 4], 3, 'clock');
    expect(kindsOf(result, 2).at(-1)).toBe('repl.load');
    expect(eventsOf(result, 2).at(-1)!.state).toMatchObject({
      useBits: [1, 1, 1],
      hand: 0,
    });
    const at4 = eventsOf(result, 3);
    expect(at4.map((e) => e.kind)).toEqual([
      'repl.fault',
      'repl.scan',
      'repl.scan',
      'repl.scan',
      'repl.victim',
      'repl.evict',
      'repl.load',
    ]);
    expect(at4[1]!.label).toBe(
      'Clear use bit of frame 0 (page 1), move hand to frame 1.',
    );
    expect(at4[4]!.state.useBits).toEqual([0, 0, 0]);
    expect(at4.at(-1)!.state).toMatchObject({
      frames: [4, 2, 3],
      useBits: [1, 0, 0],
      hand: 1,
    });
    // A hit sets the bit and leaves the hand alone; the next fault takes the first 0.
    const second = run([1, 2, 3, 4, 2, 5], 3, 'clock').result;
    expect(eventsOf(second, 4)[0]!.state).toMatchObject({ useBits: [1, 1, 0], hand: 1 });
    const v = eventsOf(second, 5).find((e) => e.kind === 'repl.victim')!;
    expect(v).toMatchObject({ page: 3, frame: 2 });
  });

  rule('repl.events', () => {
    const { result } = run([1, 2, 1, 3], 2, 'fifo');
    expect(result.phases.map((p) => p.id)).toEqual(['ref-0', 'ref-1', 'ref-2', 'ref-3']);
    expect(kindsOf(result, 0)).toEqual(['repl.fault', 'repl.load']);
    expect(kindsOf(result, 2)).toEqual(['repl.hit']);
    expect(kindsOf(result, 3)).toEqual([
      'repl.fault',
      'repl.victim',
      'repl.evict',
      'repl.load',
    ]);
    // Each event is its own step.
    const ats = result.events.map((e) => e.at);
    expect(new Set(ats).size).toBe(ats.length);
  });

  rule('repl.curve', () => {
    const fifo = faultsByFrames(BELADY_STRING, 'fifo');
    expect(fifo).toHaveLength(8);
    expect(fifo).toEqual([12, 12, 9, 10, 5, 5, 5, 5]);
    expect(beladyPoints(fifo).map((p) => p.frames)).toEqual([4]);
    expect(beladyPoints([5, 4, 4, 6, 3, 7])).toEqual([
      { frames: 4, faults: 6, previous: 4 },
      { frames: 6, faults: 7, previous: 3 },
    ]);
  });

  rule('repl.dirty', () => {
    const { result } = run([1, 2, 3], 2, 'lru');
    const evict = result.events.find((e) => e.kind === 'repl.evict')!;
    expect(evict.detail).toMatch(/does not track dirty/);
    expect(Object.keys(evict.state)).not.toContain('dirty');
  });

  it('every rule has a test', () => {
    expect([...TESTED].sort()).toEqual(REPL_RULES.map((r) => r.id).sort());
  });
});
