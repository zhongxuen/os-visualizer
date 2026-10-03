import type { Citation, CitationId } from './types';

export interface CitationRegistry {
  /** Every citation, in the order the lists were given. */
  readonly all: readonly Citation[];
  has(id: CitationId): boolean;
  /** The citation for `id`, or `undefined` if it is not registered. */
  get(id: CitationId): Citation | undefined;
}

/**
 * Build a registry from the per-module citation lists.
 *
 * Throws on a duplicate id or an OSTEP citation without a URL, so a broken list fails at
 * import time in every test rather than as a dead link in the UI.
 */
export function createRegistry(
  lists: readonly (readonly Citation[])[],
): CitationRegistry {
  const byId = new Map<CitationId, Citation>();
  const all: Citation[] = [];

  for (const list of lists) {
    for (const citation of list) {
      if (byId.has(citation.id)) {
        throw new Error(`Duplicate citation id: ${citation.id}`);
      }
      if (citation.source === 'OSTEP' && !citation.url) {
        throw new Error(`OSTEP citation ${citation.id} must have a url`);
      }
      byId.set(citation.id, citation);
      all.push(citation);
    }
  }

  return {
    all,
    has: (id) => byId.has(id),
    get: (id) => byId.get(id),
  };
}
