/** A citation id, e.g. `'ostep.8.3'` or `'osc10.8.6.3'`. Must resolve in the registry. */
export type CitationId = string;

export type CitationSource =
  /** Arpaci-Dusseau, *Operating Systems: Three Easy Pieces*, v1.10. */
  | 'OSTEP'
  /** Silberschatz, Galvin, Gagne, *Operating System Concepts*, 10th edition. */
  | 'OSC10';

export interface Citation {
  id: CitationId;
  source: CitationSource;
  chapter: number;
  section?: string;
  title: string;
  /**
   * Required for OSTEP (the chapter PDF on pages.cs.wisc.edu/~remzi/OSTEP/). OSC10 has no
   * free URL, so it is optional there.
   */
  url?: string;
}
