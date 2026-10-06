'use client';

import type { CSSProperties, ReactNode } from 'react';

import { Flash } from '@/components/motion/Flash';
import { Ticker } from '@/components/motion/Ticker';
import { DURATION } from '@/components/motion/tokens';
import { useStepTransition } from '@/components/motion/useStepTransition';
import { processName, resourceName } from '@/core/deadlock/model';

/**
 * Work as a vector **bar** (docs/UIUX.md D2, §7.2.5): one bar per resource type, filled
 * to Work out of every instance in the system, so it visibly grows as threads finish.
 *
 * On the step a thread finishes, what it gave back (its Allocation row) is shown beside
 * each bar as "+2 from T1" and flashes, the bar grows and the number rolls. The growth
 * is a `scaleX` from the left edge (§6.1 rule 7) for `--dur-2` on a forward step and
 * instant otherwise; the "+n" label stays for the whole step, so a paused frame says
 * the same as the motion (rule 4).
 */

export interface WorkBarProps {
  /** "Work" during the algorithm, "Available" before it starts. */
  label: string;
  values: readonly number[];
  /** Instances of each type in the whole system: the bar's full length. */
  total: readonly number[];
  /** What a thread released on this step, if one finished. */
  released?: { t: number; values: readonly number[] } | null;
  description?: ReactNode;
}

export function WorkBar({ label, values, total, released, description }: WorkBarProps) {
  const { scale } = useStepTransition();
  const duration = scale(DURATION.move);

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="work-bar"
      data-work={values.join(' ')}
    >
      <p className="text-small">
        <span className="font-semibold">{label}</span>
        {description ? <span className="text-fg-muted"> {description}</span> : null}
      </p>
      <ul aria-label={label} className="flex flex-col gap-1.5">
        {values.map((value, r) => {
          const of = Math.max(total[r] ?? 0, value);
          const share = of === 0 ? 0 : value / of;
          const gain = released?.values[r] ?? 0;
          return (
            <li
              key={r}
              data-resource={resourceName(r)}
              className="text-small grid grid-cols-[2.5rem_minmax(4rem,12rem)_auto_auto] items-center gap-2"
            >
              <span className="font-mono font-semibold">{resourceName(r)}</span>
              <span
                aria-hidden="true"
                className="border-border-strong bg-surface relative h-3 overflow-hidden rounded-sm border"
              >
                <span
                  className="bg-accent absolute inset-0 origin-left"
                  style={
                    {
                      transform: `scaleX(${share})`,
                      transitionProperty: 'transform',
                      transitionDuration: `${duration}ms`,
                      transitionTimingFunction: 'var(--ease-out)',
                    } as CSSProperties
                  }
                />
              </span>
              <span className="font-mono whitespace-nowrap">
                <Ticker value={value} />
                <span className="text-fg-muted"> of {of}</span>
              </span>
              {released && gain > 0 ? (
                <Flash trigger={`${released.t}-${r}`} tone="ok" className="px-1">
                  <span className="text-state-ok text-caption font-semibold whitespace-nowrap">
                    +{gain} from {processName(released.t)}
                  </span>
                </Flash>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
