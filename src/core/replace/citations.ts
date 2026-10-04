import type { Citation } from '../citations/types';

const OSTEP_POLICY = 'https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf';

function ostep(section: string | undefined, title: string): Citation {
  return {
    id: section ? `ostep.${section}` : 'ostep.22',
    source: 'OSTEP',
    chapter: 22,
    ...(section ? { section } : {}),
    title,
    url: OSTEP_POLICY,
  };
}

function osc(section: string | undefined, title: string): Citation {
  return {
    id: section ? `osc10.${section}` : 'osc10.10',
    source: 'OSC10',
    chapter: 10,
    ...(section ? { section } : {}),
    title,
  };
}

/**
 * Citations for the page replacement module: OSTEP v1.10 ch. 22 (Beyond Physical
 * Memory: Policies) and Silberschatz *Operating System Concepts* 10th ed. ch. 10
 * (Virtual Memory).
 */
export const replaceCitations: Citation[] = [
  ostep(undefined, 'Beyond Physical Memory: Policies'),
  ostep('22.1', 'Cache Management'),
  ostep('22.2', 'The Optimal Replacement Policy'),
  ostep('22.3', 'A Simple Policy: FIFO'),
  ostep('22.5', 'Using History: LRU'),
  ostep('22.6', 'Workload Examples'),
  ostep('22.8', 'Approximating LRU'),
  ostep('22.9', 'Considering Dirty Pages'),
  osc(undefined, 'Virtual Memory'),
  osc('10.4', 'Page Replacement'),
  osc('10.4.1', 'Basic Page Replacement'),
  osc('10.4.2', 'FIFO Page Replacement'),
  osc('10.4.3', 'Optimal Page Replacement'),
  osc('10.4.4', 'LRU Page Replacement'),
  osc('10.4.5', 'LRU-Approximation Page Replacement'),
  osc('10.4.5.2', 'Second-Chance Algorithm'),
];
