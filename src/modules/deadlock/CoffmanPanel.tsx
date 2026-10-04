'use client';

import { CitationLink } from '@/components/inspector/CitationLink';
import {
  COFFMAN_FOOTNOTE,
  type CoffmanCondition,
  type CoffmanStatus,
} from '@/core/deadlock/coffman';
import { cn } from '@/lib/cn';

/**
 * The four Coffman conditions for the graph at this step. Assumed conditions say so;
 * only hold and wait and circular wait are evaluated on the graph.
 */

const STATUS: Record<CoffmanStatus, { text: string; className: string }> = {
  assumed: { text: 'Assumed', className: 'border-border text-fg-secondary' },
  holds: { text: 'Holds', className: 'border-state-error text-state-error' },
  absent: { text: 'Does not hold', className: 'border-state-ok text-state-ok' },
  violated: { text: 'Violated by you', className: 'border-state-warn text-fg' },
};

export function CoffmanPanel({
  conditions,
}: {
  conditions: readonly CoffmanCondition[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {conditions.map((c) => (
          <li
            key={c.id}
            data-condition={c.id}
            data-status={c.status}
            className="border-border bg-surface-raised flex flex-col gap-1 rounded-md border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-small font-semibold">{c.name}</span>
              <span
                className={cn(
                  'text-caption rounded border px-1.5 py-0.5 font-semibold',
                  STATUS[c.status].className,
                )}
              >
                {STATUS[c.status].text}
              </span>
            </div>
            <p className="text-small text-fg-secondary">{c.text}</p>
            <p className="text-caption">
              <CitationLink id={c.citation} />
            </p>
          </li>
        ))}
      </ul>
      <p className="text-caption text-fg-muted">{COFFMAN_FOOTNOTE}</p>
    </div>
  );
}
