'use client';

import { ExternalLink } from 'lucide-react';

import type { Citation, CitationId } from '@/core/citations/types';
import { cn } from '@/lib/cn';

import { useCitations } from './CitationsContext';

/**
 * Where a step comes from: the textbook chapter or section, looked up in the page's
 * registry (`CitationsProvider`).
 *
 * OSTEP chapters are free PDFs, so they are links (new tab, said in words). OSC10 has no
 * free URL, so it is plain text. An unknown id renders as "Source: id", never a broken
 * link; the citation registry tests make that case impossible in a module run.
 */

const SOURCE_NAMES: Record<Citation['source'], string> = {
  OSTEP: 'OSTEP',
  OSC10: 'OSC 10e',
};

/** "OSTEP ch. 4" or "OSC 10e §8.6.3". */
export function citationPlace(citation: Citation): string {
  const source = SOURCE_NAMES[citation.source];
  return citation.section
    ? `${source} §${citation.section}`
    : `${source} ch. ${citation.chapter}`;
}

const BOX =
  'border-border bg-surface-overlay inline-flex max-w-full items-baseline gap-1.5 rounded-md border px-2 py-1 text-caption leading-snug';

export function CitationLink({ id, className }: { id: CitationId; className?: string }) {
  const citation = useCitations().get(id);
  if (!citation) {
    return (
      <span className={cn('text-fg-muted text-small', className)}>Source: {id}</span>
    );
  }

  const body = (
    <>
      <span className="text-accent shrink-0 font-mono font-medium">
        {citationPlace(citation)}
      </span>
      <span className="sr-only">:</span>{' '}
      <span className="text-fg-secondary min-w-0">{citation.title}</span>
    </>
  );

  if (!citation.url) {
    return <cite className={cn(BOX, 'not-italic', className)}>{body}</cite>;
  }

  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      className={cn(BOX, 'hover:border-border-strong', className)}
    >
      {body}{' '}
      <ExternalLink
        aria-hidden="true"
        className="text-fg-muted size-3 shrink-0 self-center"
      />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
