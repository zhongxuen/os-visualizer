'use client';

import { Check, X } from 'lucide-react';

import { DrawPath, useStepTransition } from '@/components/motion';
import { cn } from '@/lib/cn';

import type { StageState, StageStatus } from './stages';

/**
 * Where the current access is in the seven steps (docs/UIUX.md T2, §7.2.3): Split → TLB
 * → Walk → Check → Fill → PA → Access. The current stage is lit; finished stages get a
 * tick; a stage the access skips (on a TLB hit, the walk and the fill) is struck through
 * and says why, which is what a hit saves; stages after a fault say "not reached".
 *
 * Every state is in words under its stage as well as in colour and line style. On a
 * forward step the connector into the current stage draws in (`DrawPath`).
 */

export interface PipelineProps {
  stages: readonly StageState[];
  /** Restarts the connector draw: the step position. */
  position: number;
}

const BOX: Record<StageStatus, string> = {
  pending: 'border-border text-fg-muted border-dashed',
  current: 'border-accent bg-surface-overlay text-fg border-2',
  done: 'border-border text-fg',
  skipped: 'border-border text-fg-muted border-dashed',
  fault: 'border-state-error text-fg border-2',
  stopped: 'border-border text-fg-muted border-dashed',
};

export function Pipeline({ stages, position }: PipelineProps) {
  const { direction } = useStepTransition();
  return (
    <ol
      aria-label="The seven steps of this access"
      data-pipeline=""
      className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-4"
    >
      {stages.map(({ stage, status, note }, index) => {
        const lit = status === 'current' || status === 'fault';
        const skipped = status === 'skipped';
        return (
          <li
            key={stage.step}
            data-stage={stage.name.toLowerCase()}
            data-status={status}
            aria-current={lit ? 'step' : undefined}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center',
              BOX[status],
            )}
          >
            {index > 0 ? (
              // The path into this stage: drawn in when the access arrives here.
              <svg
                aria-hidden="true"
                viewBox="0 0 16 4"
                className="absolute top-1/2 -left-4 hidden h-1 w-4 -translate-y-1/2 sm:block"
              >
                <DrawPath
                  d="M0 2 H16"
                  trigger={position}
                  active={lit && direction === 'forward'}
                  stroke={lit ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={2}
                  strokeDasharray={skipped || status === 'pending' ? '3 2' : undefined}
                  fill="none"
                />
              </svg>
            ) : null}
            <span className="text-caption text-fg-muted font-mono">{stage.step}</span>
            <span
              className={cn(
                'text-small font-semibold',
                (skipped || status === 'stopped') && 'line-through',
              )}
            >
              {stage.name}
            </span>
            <span
              className={cn(
                'text-caption inline-flex min-h-4 items-center gap-0.5 leading-tight',
                status === 'fault' && 'text-state-error font-semibold',
                status === 'current' && 'text-accent font-semibold',
              )}
            >
              {status === 'done' ? <Check aria-hidden="true" className="size-3" /> : null}
              {status === 'fault' ? <X aria-hidden="true" className="size-3" /> : null}
              {note}
              {status === 'pending' ? <span className="sr-only">to come</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
