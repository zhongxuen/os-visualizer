'use client';

import { memo, useId } from 'react';

import { Check, CircleDot } from 'lucide-react';

import type { RunUnit } from '@/core/events/builder';
import type { PhaseSummary } from '@/core/sim/result';
import { cn } from '@/lib/cn';

import { formatDuration } from './time';

/**
 * The phases of the run, in order, with the current one marked.
 *
 * Vendored from Internet Visualizer (see VENDORED.md). Edits: "Phase" where it said
 * "Step" (a step is a unit of time here), lengths in ticks or steps through the `unit`
 * prop, and one voice -- the title, its length and the description -- in place of
 * Internet Visualizer's Simple / Full detail and its glossary links.
 *
 * Under reduced motion this is the primary way through a run: with nothing moving, the
 * story is the list of phases. Every phase has a real button that seeks, and the current
 * one is marked by an icon and the word "Now" as well as by colour. The button is the
 * number and the status; the text beside it names it through `aria-labelledby`, and a
 * pointer can click anywhere on the row.
 *
 * An ordered list, so a screen reader can say "3 of 5".
 */

export interface PhaseStepperProps {
  phases: readonly PhaseSummary[];
  /** Index of the phase containing the playhead, or `-1` before the first begins. */
  currentIndex: number;
  /** Seek to a virtual time -- the phase's `startMs`. */
  onSeek: (time: number) => void;
  /** Whether phase lengths are printed in ticks or steps. */
  unit: RunUnit;
  className?: string;
}

/** Done, now, or still ahead: a word for every row, never colour alone. */
function statusWord(index: number, currentIndex: number): string {
  if (index === currentIndex) return 'Now';
  if (index < currentIndex) return 'Finished';
  return 'Not reached yet';
}

interface StepRowProps {
  phase: PhaseSummary;
  currentIndex: number;
  unit: RunUnit;
  onSeek: (time: number) => void;
}

function StepRow({ phase, currentIndex, unit, onSeek }: StepRowProps) {
  const id = useId();
  const current = phase.index === currentIndex;
  const done = phase.index < currentIndex;
  const word = statusWord(phase.index, currentIndex);
  const seek = () => onSeek(phase.startMs);

  return (
    <li
      // A pointer convenience only: the button is the keyboard's way in.
      onClick={(event) => {
        if ((event.target as Element).closest('button, a')) return;
        seek();
      }}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-2 py-2 transition-colors',
        current
          ? 'border-accent/60 bg-accent/10'
          : 'hover:border-border hover:bg-surface-overlay/60 border-transparent',
      )}
    >
      <button
        type="button"
        onClick={seek}
        aria-current={current ? 'step' : undefined}
        aria-labelledby={`${id}-number ${id}-status ${id}-text`}
        className={cn(
          'focus-visible:outline-focus min-h-target-floor flex shrink-0 flex-col items-center gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
      >
        <span
          id={`${id}-number`}
          className={cn(
            'text-small flex size-7 items-center justify-center rounded-full border font-mono tabular-nums',
            current
              ? 'border-accent text-fg bg-accent/20'
              : done
                ? 'border-state-ok/60 text-fg-secondary'
                : 'border-border text-fg-secondary',
          )}
        >
          <span className="sr-only">Phase</span> {phase.index + 1}
        </span>
        <span
          id={`${id}-status`}
          className={cn(
            'text-caption flex items-center gap-0.5 font-medium',
            !current && 'sr-only',
            current && 'text-accent',
          )}
        >
          {current ? (
            <CircleDot aria-hidden="true" className="size-3" strokeWidth={2.5} />
          ) : done ? (
            <Check aria-hidden="true" className="size-3" />
          ) : null}
          {word}
        </span>
      </button>

      <span id={`${id}-text`} className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'text-small font-medium',
              current ? 'text-fg' : 'text-fg-secondary',
            )}
          >
            {phase.title}
          </span>
          <span className="text-fg-muted text-caption shrink-0 font-mono">
            {formatDuration(phase.endMs - phase.startMs, unit)}
          </span>
        </span>
        <span className="text-small text-fg-muted mt-0.5 block leading-snug">
          {phase.description}
        </span>
      </span>
    </li>
  );
}

/*
 * Memoized because the view around it re-renders on every animation frame while the
 * playhead moves. Without this, a frame that changes nothing here still costs a full
 * render of it.
 */
export const PhaseStepper = memo(function PhaseStepper({
  phases,
  currentIndex,
  onSeek,
  unit,
  className,
}: PhaseStepperProps) {
  if (phases.length === 0) {
    return (
      <p className={cn('text-fg-muted text-small', className)}>
        This run has no phases: it is one continuous sequence.
      </p>
    );
  }

  return (
    <ol className={cn('flex flex-col gap-1', className)}>
      {phases.map((phase) => (
        <StepRow
          key={phase.id}
          phase={phase}
          currentIndex={currentIndex}
          unit={unit}
          onSeek={onSeek}
        />
      ))}
    </ol>
  );
});
