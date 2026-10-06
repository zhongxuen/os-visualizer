'use client';

import { Term } from '@/components/glossary/Term';
import { CitationLink } from '@/components/inspector/CitationLink';
import { Flash } from '@/components/motion/Flash';
import {
  COFFMAN_FOOTNOTE,
  type CoffmanCondition,
  type CoffmanStatus,
} from '@/core/deadlock/coffman';
import { cn } from '@/lib/cn';

import { ALWAYS_TRUE } from './adapters';

/**
 * The four Coffman conditions for the graph at this step. Only hold and wait and
 * circular wait are evaluated on the graph; the other two are properties of this
 * simulator, which the core calls "assumed" and the panel calls "always true here", with
 * the reason (D3). A condition whose state changes on a forward step flashes once (the
 * badge's words carry the state, so nothing depends on the flash).
 */

/** The condition's name as a glossary term (literal ids, so the glossary scan sees them). */
function conditionName(c: CoffmanCondition) {
  switch (c.id) {
    case 'mutual-exclusion':
      return <Term id="mutual-exclusion">{c.name}</Term>;
    case 'hold-and-wait':
      return <Term id="hold-and-wait">{c.name}</Term>;
    case 'no-preemption':
      return <Term id="no-preemption">{c.name}</Term>;
    case 'circular-wait':
      return <Term id="circular-wait">{c.name}</Term>;
  }
}

const STATUS: Record<CoffmanStatus, { text: string; className: string }> = {
  assumed: { text: 'Always true here', className: 'border-border text-fg-secondary' },
  holds: { text: 'Holds', className: 'border-state-error text-state-error' },
  absent: { text: 'Does not hold', className: 'border-state-ok text-state-ok' },
  violated: { text: 'Violated by you', className: 'border-state-warn text-fg' },
};

export function CoffmanPanel({
  conditions,
  changed,
}: {
  conditions: readonly CoffmanCondition[];
  /** Conditions whose status differs from the previous step's: only these flash. */
  changed?: ReadonlySet<CoffmanCondition['id']>;
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
              <span className="text-small font-semibold">{conditionName(c)}</span>
              <Flash
                trigger={c.status}
                active={changed?.has(c.id) ?? false}
                tone={c.status === 'violated' ? 'warn' : 'accent'}
              >
                <span
                  className={cn(
                    'text-caption block rounded border px-1.5 py-0.5 font-semibold',
                    STATUS[c.status].className,
                  )}
                >
                  {STATUS[c.status].text}
                </span>
              </Flash>
            </div>
            <p className="text-small text-fg-secondary">
              {c.status === 'assumed' &&
              (c.id === 'mutual-exclusion' || c.id === 'no-preemption')
                ? ALWAYS_TRUE[c.id]
                : c.text}
            </p>
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
