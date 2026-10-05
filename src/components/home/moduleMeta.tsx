import type { ReactNode } from 'react';

/**
 * What the home page says about each module beyond the registry: the textbook chapters
 * it covers, and its place in the learning order (P6).
 *
 * Silberschatz is spelt out rather than "OSC10" (G3); OSTEP is its usual name, expanded
 * on hover.
 */

const OSTEP = <abbr title="Operating Systems: Three Easy Pieces">OSTEP</abbr>;

export const CHAPTERS: Record<string, ReactNode> = {
  scheduling: <>{OSTEP} ch. 7–8 · Silberschatz ch. 5</>,
  compare: <>{OSTEP} ch. 7 · Silberschatz §5.8</>,
  translation: <>{OSTEP} ch. 18–20 · Silberschatz ch. 9</>,
  replacement: <>{OSTEP} ch. 22 · Silberschatz ch. 10</>,
  deadlock: <>Silberschatz ch. 8 · {OSTEP} ch. 32</>,
  sync: <>{OSTEP} ch. 26–31 · Silberschatz ch. 6–7</>,
};

/** The suggested order, and why each step comes where it does. */
export const LEARNING_ORDER: readonly { slug: string; why: string }[] = [
  { slug: 'scheduling', why: 'Start here: which process gets the CPU next, and why.' },
  { slug: 'compare', why: 'Run one workload under several schedulers side by side.' },
  { slug: 'translation', why: 'How an address in a program finds its place in memory.' },
  { slug: 'replacement', why: 'What gets thrown out when memory is full.' },
  { slug: 'deadlock', why: 'When processes wait on each other forever.' },
];
