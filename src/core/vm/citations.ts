import type { Citation } from '../citations/types';

const OSTEP_PAGING = 'https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf';
const OSTEP_TLBS = 'https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf';
const OSTEP_SMALLTABLES = 'https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf';

function paging(section: string | undefined, title: string): Citation {
  return {
    id: section ? `ostep.${section}` : 'ostep.18',
    source: 'OSTEP',
    chapter: 18,
    ...(section ? { section } : {}),
    title,
    url: OSTEP_PAGING,
  };
}

function tlbs(section: string | undefined, title: string): Citation {
  return {
    id: section ? `ostep.${section}` : 'ostep.19',
    source: 'OSTEP',
    chapter: 19,
    ...(section ? { section } : {}),
    title,
    url: OSTEP_TLBS,
  };
}

function smallTables(section: string | undefined, title: string): Citation {
  return {
    id: section ? `ostep.${section}` : 'ostep.20',
    source: 'OSTEP',
    chapter: 20,
    ...(section ? { section } : {}),
    title,
    url: OSTEP_SMALLTABLES,
  };
}

/**
 * Citations for the address translation module: OSTEP v1.10 ch. 18 (Paging:
 * Introduction), ch. 19 (Paging: Faster Translations (TLBs)) and ch. 20 (Paging: Smaller
 * Tables).
 */
export const vmCitations: Citation[] = [
  paging(undefined, 'Paging: Introduction'),
  paging('18.1', 'A Simple Example And Overview'),
  paging('18.2', 'Where Are Page Tables Stored?'),
  paging('18.3', 'What’s Actually In The Page Table?'),
  paging('18.4', 'Paging: Also Too Slow'),
  paging('18.5', 'A Memory Trace'),
  tlbs(undefined, 'Paging: Faster Translations (TLBs)'),
  tlbs('19.1', 'TLB Basic Algorithm'),
  tlbs('19.2', 'Example: Accessing An Array'),
  tlbs('19.3', 'Who Handles The TLB Miss?'),
  tlbs('19.4', 'TLB Contents: What’s In There?'),
  tlbs('19.5', 'TLB Issue: Context Switches'),
  tlbs('19.6', 'Issue: Replacement Policy'),
  smallTables(undefined, 'Paging: Smaller Tables'),
  smallTables('20.3', 'Multi-level Page Tables'),
];
