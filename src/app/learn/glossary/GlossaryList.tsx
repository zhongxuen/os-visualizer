'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useId, useMemo, useState } from 'react';

import { focusRing } from '@/components/timeline/ui/styles';
import { cn } from '@/lib/cn';

export interface GlossaryItem {
  id: string;
  term: string;
  short: string;
  long: string;
  modules: readonly { title: string; route: string }[];
}

/** Lower case, accents and punctuation folded, so "Belady's" matches "beladys". */
function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, '');
}

function matches(item: GlossaryItem, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(
    `${item.term} ${item.id.replace(/-/g, ' ')} ${item.short} ${item.long}`,
  );
  return words.every((word) => haystack.includes(word));
}

function letterOf(term: string): string {
  const first = fold(term).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

/**
 * The searchable list. With no query it is the whole glossary, grouped A to Z with a
 * letter index; a query keeps the terms whose name or definition holds every word,
 * names first. The count is announced politely.
 */
export function GlossaryList({ items }: { items: readonly GlossaryItem[] }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const shown = useMemo(() => {
    const hits = items.filter((item) => matches(item, deferred));
    if (!deferred.trim()) return hits;
    const q = fold(deferred);
    // Terms whose name matches come before terms that only mention the words.
    return [
      ...hits.filter((item) => fold(item.term).includes(q)),
      ...hits.filter((item) => !fold(item.term).includes(q)),
    ];
  }, [items, deferred]);

  const searching = deferred.trim() !== '';
  const groups = useMemo(() => {
    if (searching) return [{ letter: '', items: shown }];
    const byLetter = new Map<string, GlossaryItem[]>();
    for (const item of shown) {
      const letter = letterOf(item.term);
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), item]);
    }
    return [...byLetter].map(([letter, list]) => ({ letter, items: list }));
  }, [shown, searching]);

  return (
    <>
      <div role="search" className="mt-8 flex flex-col gap-2">
        <label htmlFor={inputId} className="text-small text-fg font-medium">
          Search the glossary
        </label>
        <div className="relative max-w-md">
          <Search
            aria-hidden="true"
            className="text-fg-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. quantum, TLB, safe"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              'border-border-strong bg-surface text-fg placeholder:text-fg-muted min-h-target w-full rounded-md border py-2 pr-3 pl-9',
              focusRing,
            )}
          />
        </div>
        <p role="status" className="text-caption text-fg-muted num">
          {searching
            ? `${shown.length} of ${items.length} terms match “${deferred.trim()}”.`
            : `${items.length} terms.`}
        </p>
      </div>

      {!searching ? (
        <nav aria-label="Letters" className="mt-4">
          <ul className="flex flex-wrap gap-1">
            {groups.map(({ letter }) => (
              <li key={letter}>
                <a
                  href={`#letter-${letter}`}
                  className={cn(
                    'border-border text-small hover:border-accent flex size-9 items-center justify-center rounded-md border font-medium',
                    focusRing,
                  )}
                >
                  {letter}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {shown.length === 0 ? (
        <p className="text-fg-secondary mt-8">
          No term matches. Try a shorter word, or clear the search to see every term.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-10">
        {groups.map(({ letter, items: list }) =>
          list.length === 0 ? null : (
            <section
              key={letter || 'results'}
              aria-labelledby={letter ? `letter-${letter}` : undefined}
              aria-label={letter ? undefined : 'Matching terms'}
            >
              {letter ? (
                <h2
                  id={`letter-${letter}`}
                  className="text-title border-rule text-fg-muted scroll-mt-24 border-b pb-1 font-semibold"
                >
                  {letter}
                </h2>
              ) : null}
              <dl className="mt-4 flex flex-col gap-6">
                {list.map((item) => (
                  <div
                    key={item.id}
                    id={item.id}
                    className="scroll-mt-24"
                    data-term={item.id}
                  >
                    <dt className="text-lead text-fg font-semibold">
                      <dfn className="not-italic">{item.term}</dfn>
                    </dt>
                    <dd className="text-fg mt-1">{item.short}</dd>
                    <dd className="text-small text-fg-secondary measure mt-1">
                      {item.long}
                    </dd>
                    {item.modules.length > 0 ? (
                      <dd className="text-small text-fg-muted mt-2">
                        Appears in{' '}
                        {item.modules.map((m, i) => (
                          <span key={m.route}>
                            {i > 0
                              ? i === item.modules.length - 1
                                ? ' and '
                                : ', '
                              : ''}
                            <Link
                              href={m.route}
                              className="text-fg-secondary hover:text-fg underline underline-offset-2"
                            >
                              {m.title}
                            </Link>
                          </span>
                        ))}
                        .
                      </dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </section>
          ),
        )}
      </div>
    </>
  );
}
