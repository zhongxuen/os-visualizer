/**
 * Page replacement presets: the textbook worked examples (each also a fixture test) and
 * the classic situations (Belady's anomaly, LRU's looping worst case, an 80/20 workload).
 * Every preset is in the scenario catalogue, so the determinism and citation tests run it.
 */

import type { CitationId } from '../citations/types';
import { generate, type GenerateOptions } from './generate';
import type { ReplInput } from './input';

export interface ReplPreset {
  id: string;
  title: string;
  /** What to look for. */
  summary: string;
  citation: CitationId;
  input: ReplInput;
  /** Set when the string was generated, so the generator panel can show its settings. */
  generator?: GenerateOptions;
}

/** OSC10 §10.4.2–10.4.4 (Figures 10.12, 10.14, 10.15). */
export const OSC10_STRING = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];

/** OSTEP §22.2–22.5 (Figures 22.1, 22.2, 22.5). */
export const OSTEP_STRING = [0, 1, 2, 0, 1, 3, 0, 3, 1, 2, 1];

/** OSC10 §10.4.2 (Figure 10.13): FIFO faults 9 times with 3 frames and 10 with 4. */
export const BELADY_STRING = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];

export const LOOP_GENERATOR: GenerateOptions = {
  kind: 'loop',
  length: 20,
  pages: 5,
  seed: 0,
};

export const HOTCOLD_GENERATOR: GenerateOptions = {
  kind: 'hotcold',
  length: 40,
  pages: 10,
  seed: 22,
};

export const REPL_PRESETS: readonly ReplPreset[] = [
  {
    id: 'osc10',
    title: 'OSC10 reference string',
    summary:
      'The 20-reference string of OSC10 §10.4 with 3 frames: FIFO faults 15 times, LRU 12 and OPT 9.',
    citation: 'osc10.10.4.2',
    input: { refString: OSC10_STRING, frames: 3, policy: 'fifo' },
  },
  {
    id: 'ostep',
    title: 'OSTEP reference string',
    summary:
      'OSTEP §22.2’s 11 references with a 3-page cache: OPT hits 6 times (54.5%), FIFO 4 (36.4%) and LRU 6.',
    citation: 'ostep.22.2',
    input: { refString: OSTEP_STRING, frames: 3, policy: 'opt' },
  },
  {
    id: 'belady',
    title: 'Belady’s anomaly (FIFO)',
    summary:
      'FIFO on 1,2,3,4,1,2,5,1,2,3,4,5: 9 faults with 3 frames but 10 with 4. More memory, more faults.',
    citation: 'osc10.10.4.2',
    input: { refString: BELADY_STRING, frames: 3, policy: 'fifo' },
  },
  {
    id: 'belady-lru',
    title: 'Same string, LRU',
    summary:
      'LRU on the Belady string: 10 faults with 3 frames, 8 with 4. LRU is a stack algorithm, so more frames never hurt.',
    citation: 'osc10.10.4.4',
    input: { refString: BELADY_STRING, frames: 3, policy: 'lru' },
  },
  {
    id: 'clock',
    title: 'Clock on the OSC10 string',
    summary:
      'Second chance with 3 frames: watch the hand sweep, clearing use bits until it finds a 0. Close to LRU at a fraction of the cost.',
    citation: 'osc10.10.4.5.2',
    input: { refString: OSC10_STRING, frames: 3, policy: 'clock' },
  },
  {
    id: 'loop-lru',
    title: 'Looping workload vs LRU',
    summary:
      'Pages 0–4 in a loop with 4 frames: LRU evicts exactly the page needed next, so every reference faults. OPT does far better.',
    citation: 'ostep.22.6',
    input: { refString: generate(LOOP_GENERATOR), frames: 4, policy: 'lru' },
    generator: LOOP_GENERATOR,
  },
  {
    id: 'hotcold',
    title: '80/20 workload',
    summary:
      '80% of references go to pages 0 and 1 of 10 (seed 22). With 2 frames LRU keeps the hot pages and faults 21 times; FIFO, blind to use, faults 25 times.',
    citation: 'ostep.22.6',
    input: { refString: generate(HOTCOLD_GENERATOR), frames: 2, policy: 'lru' },
    generator: HOTCOLD_GENERATOR,
  },
];

export const DEFAULT_PRESET: ReplPreset = REPL_PRESETS[0]!;

export function presetById(id: string): ReplPreset | undefined {
  return REPL_PRESETS.find((preset) => preset.id === id);
}
