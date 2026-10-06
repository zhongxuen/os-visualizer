'use client';

import { Check, X } from 'lucide-react';
import type { CSSProperties } from 'react';

import { Flash } from '@/components/motion/Flash';
import { useStepTransition } from '@/components/motion/useStepTransition';
import { resourceName } from '@/core/deadlock/model';
import { cn } from '@/lib/cn';

/**
 * One comparison, column by column (docs/UIUX.md §7.2.5): `Need_i ≤ Work`,
 * `Request_i ≤ Work`, `Request ≤ Available`. Each resource type gets its own ✓ or ✗,
 * popping in left to right on a forward step, so you can see *which* resource blocks a
 * thread, and the verdict names it in words.
 *
 * The pop is `<Flash>` with a staggered delay; the marks themselves are static, so a
 * paused frame, a step back and reduced motion show exactly the same result.
 */

/** Gap between one column's pop and the next. */
const STAGGER_MS = 60;

export interface CompareStripProps {
  /** e.g. "Need[T1]". */
  left: string;
  leftValues: readonly number[];
  /** e.g. "Work". */
  right: string;
  rightValues: readonly number[];
  /** Restarts the pop when it changes: the step's row. */
  trigger: string | number;
}

export function CompareStrip({
  left,
  leftValues,
  right,
  rightValues,
  trigger,
}: CompareStripProps) {
  const { scale } = useStepTransition();
  const stagger = scale(STAGGER_MS);
  const cells = leftValues.map((value, r) => ({
    r,
    value,
    against: rightValues[r] ?? 0,
    pass: value <= (rightValues[r] ?? 0),
  }));
  const blocking = cells.filter((c) => !c.pass).map((c) => resourceName(c.r));
  const all = blocking.length === 0;

  return (
    <div
      role="group"
      aria-label={`${left} ≤ ${right}, resource by resource`}
      data-testid="compare-strip"
      data-fits={all}
      className="border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-3"
    >
      <p className="text-small font-semibold">
        <span className="font-mono">{left}</span> ≤{' '}
        <span className="font-mono">{right}</span>? Column by column:
      </p>
      <ol className="flex flex-wrap gap-2">
        {cells.map((c) => (
          <li
            key={c.r}
            data-resource={resourceName(c.r)}
            data-pass={c.pass}
            style={{ '--pop-delay': `${c.r * stagger}ms` } as CSSProperties}
          >
            <Flash
              trigger={trigger}
              tone={c.pass ? 'ok' : 'danger'}
              className="[animation-delay:var(--pop-delay)]!"
            >
              <span
                className={cn(
                  'text-small inline-flex items-center gap-1 rounded-md border-2 px-2 py-1 font-mono',
                  c.pass ? 'border-state-ok' : 'border-state-error',
                )}
              >
                <span className="text-fg-muted">{resourceName(c.r)}</span>
                <span>
                  {c.value} {c.pass ? '≤' : '>'} {c.against}
                </span>
                {c.pass ? (
                  <Check aria-hidden="true" className="text-state-ok size-4" />
                ) : (
                  <X aria-hidden="true" className="text-state-error size-4" />
                )}
                <span className="sr-only">{c.pass ? 'fits' : 'does not fit'}</span>
              </span>
            </Flash>
          </li>
        ))}
      </ol>
      <p className="text-small" data-testid="compare-verdict">
        <span className={cn('font-semibold', all ? 'text-state-ok' : 'text-state-error')}>
          {all
            ? 'Yes: every column fits.'
            : `No: ${blocking.join(' and ')} ${blocking.length === 1 ? 'does' : 'do'} not fit.`}
        </span>
      </p>
    </div>
  );
}
