import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The faults split into cold and capacity (R1): one bar, solid for cold and hatched for
 * capacity, with both numbers in words beside it, so the bar is never read by colour or
 * length alone. Cold faults are the floor every policy shares; only the capacity part
 * differs between policies.
 */

export interface FaultSplitProps {
  cold: number;
  capacity: number;
  /** Words before the numbers, e.g. "FIFO". */
  label?: ReactNode;
  /** The words for "cold" and "capacity", e.g. wrapped in `<Term>`. */
  coldWord?: ReactNode;
  capacityWord?: ReactNode;
  className?: string;
}

const HATCH =
  'repeating-linear-gradient(135deg, var(--state-warn) 0 2px, transparent 2px 6px)';

export function FaultSplit({
  cold,
  capacity,
  label,
  coldWord = 'cold',
  capacityWord = 'capacity',
  className,
}: FaultSplitProps) {
  const total = cold + capacity;
  return (
    <div className={cn('flex flex-col gap-1', className)} data-fault-split="">
      <div
        aria-hidden="true"
        className="border-border bg-surface flex h-3 w-full overflow-hidden rounded border"
      >
        {total > 0 ? (
          <>
            <span className="bg-fg-secondary block h-full" style={{ flexGrow: cold }} />
            <span
              className="block h-full"
              style={{ flexGrow: capacity, backgroundImage: HATCH }}
            />
          </>
        ) : null}
      </div>
      <p className="text-caption text-fg-secondary">
        {label ? <span className="font-semibold">{label}: </span> : null}
        {total === 0 ? (
          'no faults yet'
        ) : (
          <>
            <span className="font-mono font-semibold">{cold}</span>{' '}
            <span
              className="bg-fg-secondary mr-0.5 inline-block size-2"
              aria-hidden="true"
            />
            {coldWord} + <span className="font-mono font-semibold">{capacity}</span>{' '}
            <span
              className="border-border mr-0.5 inline-block size-2 border"
              style={{ backgroundImage: HATCH }}
              aria-hidden="true"
            />
            {capacityWord} = {total} {total === 1 ? 'fault' : 'faults'}
          </>
        )}
      </p>
    </div>
  );
}
