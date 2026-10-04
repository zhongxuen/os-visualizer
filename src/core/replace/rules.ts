/**
 * The modelling conventions the replacement core follows, as data. The RulesPanel renders
 * them; `tests/fixtures/replace/rules.test.ts` has one test named after each id. Where
 * textbooks differ, the rule says which convention was chosen.
 */

import type { CitationId } from '../citations/types';

export interface ReplRule {
  id: string;
  text: string;
  detail?: string;
  citation: CitationId;
}

export const REPL_RULES: readonly ReplRule[] = [
  {
    id: 'repl.fill.order',
    text: 'Frames start empty and fill in order, frame 0 first. A fault while a frame is empty fills it and evicts nothing.',
    citation: 'osc10.10.4.1',
  },
  {
    id: 'repl.miss.kinds',
    text: 'A fault on a page’s first reference is a cold (compulsory) miss; every other fault is a capacity miss.',
    detail:
      'OSTEP’s “three Cs” also has conflict misses, which only set-associative caches have. Memory is fully associative: any page can go in any frame.',
    citation: 'ostep.22.2',
  },
  {
    id: 'repl.fifo',
    text: 'FIFO evicts the page loaded earliest. A hit does not change its place in the queue.',
    citation: 'ostep.22.3',
  },
  {
    id: 'repl.lru',
    text: 'LRU evicts the page used least recently. Every hit and every load counts as a use.',
    citation: 'ostep.22.5',
  },
  {
    id: 'repl.opt',
    text: 'OPT evicts the page whose next use is furthest away; a page never used again counts as infinitely far. Ties go to the page in the lowest-numbered frame.',
    detail:
      'Ties can only happen between pages that are never used again. OSTEP and OSC10 leave this tie open; any choice gives the same number of faults.',
    citation: 'ostep.22.2',
  },
  {
    id: 'repl.clock',
    text: 'Clock keeps one use bit per frame and a hand that starts at frame 0. A hit sets the bit to 1; a loaded page starts with its bit at 1 and the hand moves to the next frame. On a fault with every frame full, the hand sweeps: bit 1 → clear it and move on; bit 0 → evict that frame.',
    detail:
      'Some textbooks load the new page with its use bit at 0. This model follows OSC10’s second-chance algorithm and sets it to 1. The hand does not move on a hit.',
    citation: 'osc10.10.4.5.2',
  },
  {
    id: 'repl.events',
    text: 'Every reference is its own phase. A hit is one step; a fault is fault → (Clock: one step per use bit cleared) → choose victim, with the reason → evict → load. A fault into an empty frame is fault → load.',
    citation: 'ostep.22.1',
  },
  {
    id: 'repl.curve',
    text: 'The faults-vs-frames curve runs each policy with 1 to 8 frames. A point where more frames give more faults is marked as Belady’s anomaly.',
    detail:
      'LRU and OPT are stack algorithms: the pages held with n frames are always among those held with n + 1, so their curves never rise. FIFO and Clock are not.',
    citation: 'osc10.10.4.2',
  },
  {
    id: 'repl.dirty',
    text: 'Pages are never dirty: evicting a page costs nothing extra, and every fault costs the same.',
    detail:
      'Real systems prefer to evict clean pages, which need no write-back (OSTEP §22.9). This model leaves dirty bits out.',
    citation: 'ostep.22.9',
  },
];
