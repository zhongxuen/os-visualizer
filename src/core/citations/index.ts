/**
 * The citation registry: every module's citations in one place.
 *
 * Append-only. A new module adds one import and one list entry; nothing else here
 * changes.
 */

import { deadlockCitations } from '../deadlock/citations';
import { replaceCitations } from '../replace/citations';
import { schedCitations } from '../sched/citations';
import { syncCitations } from '../sync/citations';
import { vmCitations } from '../vm/citations';
import { generalCitations } from './general';
import { createRegistry } from './registry';

export const citations = createRegistry([
  generalCitations,
  schedCitations,
  vmCitations,
  replaceCitations,
  deadlockCitations,
  syncCitations,
]);

export { createRegistry, type CitationRegistry } from './registry';
export type { Citation, CitationId, CitationSource } from './types';
