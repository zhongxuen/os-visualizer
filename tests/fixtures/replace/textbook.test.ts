import { describe, expect, it } from 'vitest';

import {
  BELADY_STRING,
  beladyPoints,
  faultsByFrames,
  OSC10_STRING,
  OSTEP_STRING,
  presetById,
  refResults,
  runReplace,
} from '@/core/replace';

import { run } from './helpers';

/**
 * OSC10 ch. 10 and OSTEP v1.10 ch. 22 worked examples. Recorded in
 * tests/fixtures/README.md.
 */

describe('OSC10 §10.4.2–10.4.4: the 20-reference string with 3 frames', () => {
  it('FIFO faults 15 times (Figure 10.12)', () => {
    expect(run(OSC10_STRING, 3, 'fifo').state.faults).toBe(15);
  });

  it('OPT faults 9 times (Figure 10.14)', () => {
    expect(run(OSC10_STRING, 3, 'opt').state.faults).toBe(9);
  });

  it('LRU faults 12 times (Figure 10.15)', () => {
    expect(run(OSC10_STRING, 3, 'lru').state.faults).toBe(12);
  });

  it('FIFO frames after each fault match Figure 10.12', () => {
    const faults = refResults(run(OSC10_STRING, 3, 'fifo').result).filter((r) => !r.hit);
    // Frame contents after each fault, as columns in the figure.
    expect(faults.map((r) => r.frames.join(''))).toEqual([
      '7',
      '70',
      '701',
      '201',
      '231',
      '230',
      '430',
      '420',
      '423',
      '023',
      '013',
      '012',
      '712',
      '702',
      '701',
    ]);
  });
});

describe('OSC10 §10.4.2: Belady’s anomaly (Figure 10.13)', () => {
  it('FIFO: 9 faults with 3 frames, 10 with 4', () => {
    expect(run(BELADY_STRING, 3, 'fifo').state.faults).toBe(9);
    expect(run(BELADY_STRING, 4, 'fifo').state.faults).toBe(10);
  });

  it('the FIFO curve rises from 3 to 4 frames; LRU and OPT never rise', () => {
    expect(beladyPoints(faultsByFrames(BELADY_STRING, 'fifo'))).toEqual([
      { frames: 4, faults: 10, previous: 9 },
    ]);
    expect(beladyPoints(faultsByFrames(BELADY_STRING, 'lru'))).toEqual([]);
    expect(beladyPoints(faultsByFrames(BELADY_STRING, 'opt'))).toEqual([]);
  });

  it('the presets load it, and LRU on the same string improves with a frame more', () => {
    expect(runReplace(presetById('belady')!.input).events.at(-1)!.state.faults).toBe(9);
    const lru = presetById('belady-lru')!.input;
    expect(run(lru.refString, 3, 'lru').state.faults).toBe(10);
    expect(run(lru.refString, 4, 'lru').state.faults).toBe(8);
  });
});

describe('OSTEP §22.2, §22.3, §22.5: 0,1,2,0,1,3,0,3,1,2,1 with a 3-page cache', () => {
  const rate = (hits: number) => Math.round((hits / OSTEP_STRING.length) * 1000) / 10;

  it('OPT: 6 hits, 54.5% (Figure 22.1)', () => {
    const { state } = run(OSTEP_STRING, 3, 'opt');
    expect(state.hits).toBe(6);
    expect(rate(state.hits)).toBe(54.5);
    // Evicts 2 at the reference to 3 (2 is needed furthest away), as the figure does.
    const at3 = refResults(run(OSTEP_STRING, 3, 'opt').result)[5]!;
    expect(at3.evicted).toBe(2);
  });

  it('FIFO: 4 hits, 36.4% (Figure 22.2)', () => {
    const { state } = run(OSTEP_STRING, 3, 'fifo');
    expect(state.hits).toBe(4);
    expect(rate(state.hits)).toBe(36.4);
  });

  it('LRU: 6 hits, 54.5% (Figure 22.5)', () => {
    const { state } = run(OSTEP_STRING, 3, 'lru');
    expect(state.hits).toBe(6);
    expect(rate(state.hits)).toBe(54.5);
  });

  it('all three have the same 4 cold misses', () => {
    for (const policy of ['opt', 'fifo', 'lru'] as const) {
      expect(run(OSTEP_STRING, 3, policy).state.cold).toBe(4);
    }
  });
});

describe('OSTEP §22.6: workload shapes', () => {
  it('looping workload: LRU and FIFO fault on every reference with too few frames', () => {
    const { refString } = presetById('loop-lru')!.input;
    for (const policy of ['lru', 'fifo'] as const) {
      expect(faultsByFrames(refString, policy).slice(0, 4)).toEqual([20, 20, 20, 20]);
    }
    expect(faultsByFrames(refString, 'opt')[3]).toBeLessThan(20);
  });

  it('80/20 workload: LRU beats FIFO at the preset’s frame count', () => {
    const { refString, frames } = presetById('hotcold')!.input;
    expect(run(refString, frames, 'lru').state.faults).toBe(21);
    expect(run(refString, frames, 'fifo').state.faults).toBe(25);
  });
});
