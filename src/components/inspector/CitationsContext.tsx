'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { createRegistry, type CitationRegistry } from '@/core/citations/registry';

/**
 * The citations a page can show, provided by its module rather than imported whole by
 * `CitationLink`: the full registry is every module's titles and URLs, and a module route
 * needs only its own few (the per-route JS budget). Same pattern as Crypto Visualizer.
 *
 * Outside a provider the registry is empty, and every `CitationLink` renders its id as
 * plain text.
 */
const CitationsContext = createContext<CitationRegistry>(createRegistry([]));

export function CitationsProvider({
  citations,
  children,
}: {
  citations: CitationRegistry;
  children: ReactNode;
}) {
  return (
    <CitationsContext.Provider value={citations}>{children}</CitationsContext.Provider>
  );
}

export function useCitations(): CitationRegistry {
  return useContext(CitationsContext);
}
