import type { ReactNode } from 'react';

import type { EventBase } from '@/core/events/types';
import { cn } from '@/lib/cn';

import { CitationLink } from './CitationLink';

/**
 * The current event explained: its one-line `label` (the decision and why), the longer
 * `detail` when the event has one, module extras (`children`), and its citation.
 *
 * Not a live region: the timeline's `StepCaption` already announces phase changes, and
 * announcing every tick during playback would talk over it.
 */

export interface StepInspectorProps {
  event: Pick<EventBase, 'label' | 'detail' | 'citation'> | undefined;
  /** e.g. "This tick" or "This step". */
  heading?: string;
  children?: ReactNode;
  className?: string;
}

export function StepInspector({
  event,
  heading = 'This step',
  children,
  className,
}: StepInspectorProps) {
  return (
    <section
      aria-label={heading}
      className={cn(
        'border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-4',
        className,
      )}
    >
      <h2 className="text-small text-fg-muted font-semibold">{heading}</h2>
      {event ? (
        <>
          <p className="text-fg">{event.label}</p>
          {event.detail ? (
            <p className="text-fg-secondary text-small leading-relaxed">{event.detail}</p>
          ) : null}
          {children}
          <p className="mt-1">
            <CitationLink id={event.citation} />
          </p>
        </>
      ) : (
        <p className="text-fg-muted text-small">Nothing has happened yet.</p>
      )}
    </section>
  );
}
