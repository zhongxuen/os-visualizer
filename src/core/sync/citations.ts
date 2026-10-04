import type { Citation } from '../citations/types';

const INTRO = 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf';
const LOCKS = 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf';
const SEMA = 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf';

function ostep(
  chapter: number,
  section: string | undefined,
  title: string,
  url: string,
): Citation {
  return {
    id: section ? `ostep.${section}` : `ostep.${chapter}`,
    source: 'OSTEP',
    chapter,
    ...(section ? { section } : {}),
    title,
    url,
  };
}

/**
 * Citations for the synchronisation module: OSTEP v1.10 ch. 26 (Concurrency: An
 * Introduction), 28 (Locks) and 31 (Semaphores). Deadlock reuses `ostep.32.3`, which the
 * deadlock module registers.
 */
export const syncCitations: Citation[] = [
  ostep(26, undefined, 'Concurrency: An Introduction', INTRO),
  ostep(26, '26.3', 'Why It Gets Worse: Shared Data', INTRO),
  ostep(26, '26.4', 'The Heart Of The Problem: Uncontrolled Scheduling', INTRO),
  ostep(26, '26.5', 'The Wish For Atomicity', INTRO),
  ostep(28, undefined, 'Locks', LOCKS),
  ostep(28, '28.1', 'Locks: The Basic Idea', LOCKS),
  ostep(28, '28.7', 'Building Working Spin Locks with Test-And-Set', LOCKS),
  ostep(31, undefined, 'Semaphores', SEMA),
  ostep(31, '31.1', 'Semaphores: A Definition', SEMA),
  ostep(31, '31.4', 'The Producer/Consumer (Bounded Buffer) Problem', SEMA),
];
