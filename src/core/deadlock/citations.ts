import type { Citation } from '../citations/types';

const OSTEP_BUGS = 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf';

function osc(section: string | undefined, title: string): Citation {
  return {
    id: section ? `osc10.${section}` : 'osc10.8',
    source: 'OSC10',
    chapter: 8,
    ...(section ? { section } : {}),
    title,
  };
}

/**
 * Citations for the deadlock module: Silberschatz *Operating System Concepts* 10th ed.
 * ch. 8 (Deadlocks) and OSTEP v1.10 ch. 32 (Common Concurrency Problems).
 */
export const deadlockCitations: Citation[] = [
  osc(undefined, 'Deadlocks'),
  osc('8.1', 'System Model'),
  osc('8.3', 'Deadlock Characterization'),
  osc('8.3.1', 'Necessary Conditions'),
  osc('8.3.2', 'Resource-Allocation Graph'),
  osc('8.6', 'Deadlock Avoidance'),
  osc('8.6.1', 'Safe State'),
  osc('8.6.3', 'Banker’s Algorithm'),
  osc('8.6.3.1', 'Safety Algorithm'),
  osc('8.6.3.2', 'Resource-Request Algorithm'),
  osc('8.6.3.3', 'An Illustrative Example'),
  osc('8.7', 'Deadlock Detection'),
  osc('8.7.1', 'Single Instance of Each Resource Type'),
  osc('8.7.2', 'Several Instances of a Resource Type'),
  osc('8.8', 'Recovery from Deadlock'),
  osc('8.8.1', 'Process and Thread Termination'),
  osc('8.8.2', 'Resource Preemption'),
  {
    id: 'osc10.7.1.3',
    source: 'OSC10',
    chapter: 7,
    section: '7.1.3',
    title: 'The Dining-Philosophers Problem',
  },
  {
    id: 'ostep.32',
    source: 'OSTEP',
    chapter: 32,
    title: 'Common Concurrency Problems',
    url: OSTEP_BUGS,
  },
  {
    id: 'ostep.32.3',
    source: 'OSTEP',
    chapter: 32,
    section: '32.3',
    title: 'Deadlock Bugs',
    url: OSTEP_BUGS,
  },
];
