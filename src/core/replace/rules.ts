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
  /** The rule in plain words, for someone meeting it for the first time. */
  plain?: string;
  /** What would change if a textbook used the other convention. */
  whyItMatters?: string;
  citation: CitationId;
}

export const REPL_RULES: readonly ReplRule[] = [
  {
    id: 'repl.fill.order',
    text: 'Frames start empty and fill in order, frame 0 first. A fault while a frame is empty fills it and evicts nothing.',
    plain:
      'Memory starts empty. The first pages go into frames 0, 1, 2… in turn, and nothing is thrown out until every frame is full.',
    whyItMatters:
      'Which frame a page lands in never changes the fault count, but it does change the picture: if your book fills from the bottom or the right, the rows of your frame table are in a different order from ours.',
    citation: 'osc10.10.4.1',
  },
  {
    id: 'repl.miss.kinds',
    text: 'A fault on a page’s first reference is a cold (compulsory) miss; every other fault is a capacity miss.',
    detail:
      'OSTEP’s “three Cs” also has conflict misses, which only set-associative caches have. Memory is fully associative: any page can go in any frame.',
    plain:
      'The first time a page is ever used it has to fault: that is a cold fault. A fault on a page that was in memory before and got thrown out is a capacity fault: more frames could have kept it.',
    whyItMatters:
      'Exam questions often ask how many faults were unavoidable. Cold faults are the floor no policy can beat; only capacity faults differ between FIFO, LRU, OPT and Clock.',
    citation: 'ostep.22.2',
  },
  {
    id: 'repl.fifo',
    text: 'FIFO evicts the page loaded earliest. A hit does not change its place in the queue.',
    plain:
      'FIFO throws out whichever page has been in memory longest, even if it was used a moment ago.',
    whyItMatters:
      'Some books describe a FIFO that moves a page to the back of the queue on a hit. That is a different algorithm (closer to LRU) and gives different answers; here a hit changes nothing.',
    citation: 'ostep.22.3',
  },
  {
    id: 'repl.lru',
    text: 'LRU evicts the page used least recently. Every hit and every load counts as a use.',
    plain:
      'LRU throws out the page that has gone longest without being used. Loading a page counts as using it.',
    whyItMatters:
      'If a load didn’t count as a use, a page that was just loaded and never touched again could be thrown out first, and some answers would differ by a fault.',
    citation: 'ostep.22.5',
  },
  {
    id: 'repl.opt',
    text: 'OPT evicts the page whose next use is furthest away; a page never used again counts as infinitely far. Ties go to the page in the lowest-numbered frame.',
    detail:
      'Ties can only happen between pages that are never used again. OSTEP and OSC10 leave this tie open; any choice gives the same number of faults.',
    plain:
      'OPT looks ahead in the string and throws out the page needed furthest in the future. If several pages are never needed again, it takes the one in the lowest-numbered frame.',
    whyItMatters:
      'The tie-break never changes how many faults OPT has, only which frame empties, so your frame table may differ from your book’s while the total stays the same.',
    citation: 'ostep.22.2',
  },
  {
    id: 'repl.clock',
    text: 'Clock keeps one use bit per frame and a hand that starts at frame 0. A hit sets the bit to 1; a loaded page starts with its bit at 1 and the hand moves to the next frame. On a fault with every frame full, the hand sweeps: bit 1 → clear it and move on; bit 0 → evict that frame.',
    detail:
      'Some textbooks load the new page with its use bit at 0. This model follows OSC10’s second-chance algorithm and sets it to 1. The hand does not move on a hit.',
    plain:
      'Clock walks a hand round the frames. A page with its use bit set gets a second chance: the bit is cleared and the hand moves on. The first page found with bit 0 is thrown out.',
    whyItMatters:
      'Books that load a new page with its use bit at 0 make Clock throw out newly loaded pages sooner, so fault counts can differ. Check which convention your course uses.',
    citation: 'osc10.10.4.5.2',
  },
  {
    id: 'repl.events',
    text: 'Every reference is its own phase. A hit is one step; a fault is fault → (Clock: one step per use bit cleared) → choose victim, with the reason → evict → load. A fault into an empty frame is fault → load.',
    plain:
      'Each reference is one stop on the timeline. A hit takes one step; a fault takes several: notice the fault, (Clock) sweep, pick the victim, throw it out, load the new page.',
    whyItMatters:
      'Only the step count depends on this. Faults, hits and the final frames are the same however finely the steps are cut.',
    citation: 'ostep.22.1',
  },
  {
    id: 'repl.curve',
    text: 'The faults-vs-frames curve runs each policy with 1 to 8 frames. A point where more frames give more faults is marked as Belady’s anomaly.',
    detail:
      'LRU and OPT are stack algorithms: the pages held with n frames are always among those held with n + 1, so their curves never rise. FIFO and Clock are not.',
    plain:
      'The chart reruns every policy with 1 to 8 frames. Wherever adding a frame makes the faults go up, that is Belady’s anomaly, and it is marked.',
    whyItMatters:
      'LRU and OPT can never show the anomaly, so if you see a rising LRU curve, something is wrong. FIFO and Clock can, on the right string.',
    citation: 'osc10.10.4.2',
  },
  {
    id: 'repl.dirty',
    text: 'Pages are never dirty: evicting a page costs nothing extra, and every fault costs the same.',
    detail:
      'Real systems prefer to evict clean pages, which need no write-back (OSTEP §22.9). This model leaves dirty bits out.',
    plain:
      'Every page is treated as clean, so throwing one out never costs a disk write.',
    whyItMatters:
      'Real kernels prefer clean victims and count write-backs. A book that tracks dirty bits may pick a different victim than this model does.',
    citation: 'ostep.22.9',
  },
];
