'use client';

import { BookOpen, ExternalLink } from 'lucide-react';

import type { Citation, CitationId } from '@/core/citations/types';
import { Popover } from '@/components/ui';
import { cn } from '@/lib/cn';

import { useCitations } from './CitationsContext';

/**
 * Where a step comes from: the textbook chapter or section, looked up in the page's
 * registry (`CitationsProvider`).
 *
 * OSTEP chapters are free PDFs, so they are links (new tab, said in words). OSC10 has no
 * free URL, so it is plain text. An unknown id renders as "Source: id", never a broken
 * link; the citation registry tests make that case impossible in a module run.
 *
 * The short form is for people who know the books. A book icon beside it opens the full
 * reference (docs/UIUX.md §2.2 G3): authors, title, edition, and the section's title,
 * which is what a reader with another edition can search for.
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

interface Book {
  authors: string;
  title: string;
  edition: string;
  /** Said under an OSC reference: section numbers move between editions. */
  editionNote?: string;
}

const BOOKS: Record<Citation['source'], Book> = {
  OSTEP: {
    authors: 'Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau',
    title: 'Operating Systems: Three Easy Pieces',
    edition: 'version 1.10',
  },
  OSC10: {
    authors: 'Abraham Silberschatz, Peter B. Galvin and Greg Gagne',
    title: 'Operating System Concepts',
    edition: '10th edition',
    editionNote:
      'Other editions number their sections differently. Look for the section title.',
  },
};

/** The parts of the full reference, for the popover and its tests. */
export function fullReference(citation: Citation): Book & { place: string } {
  const place = citation.section ? `§${citation.section}` : `chapter ${citation.chapter}`;
  return { ...BOOKS[citation.source], place };
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

  const short = citationPlace(citation);
  const inline = citation.url ? (
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
  ) : (
    <cite className={cn(BOX, 'not-italic', className)}>{body}</cite>
  );

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      {inline}
      <Popover
        side="top"
        label={`Full reference: ${short}`}
        triggerVariant="unstyled"
        triggerClassName="text-fg-muted hover:text-fg hover:bg-surface-overlay inline-flex size-6 shrink-0 items-center justify-center rounded-md"
        triggerProps={{ 'aria-label': `Full reference for ${short}` }}
        trigger={<BookOpen aria-hidden="true" className="size-3.5" />}
      >
        <FullReference citation={citation} />
      </Popover>
    </span>
  );
}

function FullReference({ citation }: { citation: Citation }) {
  const ref = fullReference(citation);
  return (
    <>
      <span className="block">
        {ref.authors}, <cite>{ref.title}</cite>, {ref.edition}, {ref.place}:{' '}
        <span className="text-fg">“{citation.title}”</span>.
      </span>
      {ref.editionNote ? (
        <span className="text-fg-muted mt-2 block">{ref.editionNote}</span>
      ) : null}
      {citation.url ? (
        <a
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="text-accent mt-2 inline-flex items-center gap-1 underline underline-offset-2"
        >
          Read the chapter (free PDF){' '}
          <ExternalLink aria-hidden="true" className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}
    </>
  );
}
