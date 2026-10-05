'use client';

import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { DURATION } from './tokens';
import { useStepTransition } from './useStepTransition';

/**
 * A one-shot background pulse on a value that changed: a matrix cell, a counter
 * (docs/UIUX.md §6.3).
 *
 * The pulse is the `osv-flash` keyframe (motion.css), restarted by re-keying the span
 * when `trigger` changes on a forward step. It is emphasis only (§6.1 rule 4): whatever
 * changed must also be shown statically by the caller, a mark or a label, because a
 * step back, a jump, reduced motion and speeds 4-5 show no pulse at all.
 */

export type FlashTone = 'accent' | 'ok' | 'warn' | 'danger';

const TONE: Record<FlashTone, string> = {
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

export interface FlashProps {
  /** Changes when the value changes; the pulse restarts on each change. */
  trigger: string | number;
  /** Only what changed flashes. */
  active?: boolean;
  tone?: FlashTone;
  className?: string;
  children?: ReactNode;
}

export function Flash({
  trigger,
  active = true,
  tone = 'accent',
  className,
  children,
}: FlashProps) {
  const { scale } = useStepTransition();
  // A pulse rises and falls, so it gets the arrival token rather than a highlight's.
  const duration = active ? scale(DURATION.enter) : 0;
  const run = duration > 0;

  return (
    <span
      key={run ? String(trigger) : 'still'}
      data-flash={run ? '' : undefined}
      className={cn('inline-block rounded-sm', run && 'motion-flash', className)}
      style={
        run
          ? ({
              '--flash-dur': `${duration}ms`,
              '--flash-colour': TONE[tone],
            } as CSSProperties)
          : undefined
      }
    >
      {children}
    </span>
  );
}
