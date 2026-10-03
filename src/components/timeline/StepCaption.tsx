'use client';

import { memo } from 'react';

import type { PhaseSummary } from '@/core/sim/result';
import { cn } from '@/lib/cn';

/**
 * Where a run stands, for the caption. `ready` is before the first play or seek; `done`
 * is the resting state at the end. From Internet Visualizer's `stage.ts`.
 */
export type StageMoment = 'ready' | 'running' | 'done';

export function stageMoment(status: string, virtualTime: number): StageMoment {
  if (status === 'idle' && virtualTime <= 0) return 'ready';
  return status === 'ended' ? 'done' : 'running';
}

/** What the caption says, as text. */
export interface StepCaptionText {
  /** 'Phase 2 of 4', or `null` when no phase is in force. */
  step: string | null;
  title: string | null;
  text: string;
}

export const DONE_CAPTION =
  'Done: the whole run is on screen. Step back to revisit any part.';

/**
 * The caption for a moment in a run. From Internet Visualizer's `stage.ts`, with one
 * voice (title and description) in place of its Simple / Full detail, and "Phase".
 */
export function stepCaption(
  phases: readonly PhaseSummary[],
  currentIndex: number,
  moment: StageMoment,
  question?: string,
): StepCaptionText {
  const count = phases.length;
  const noun = `${count} ${count === 1 ? 'phase' : 'phases'}`;

  if (moment === 'done') return { step: null, title: null, text: DONE_CAPTION };

  const phase = phases[currentIndex];
  if (moment === 'ready' || !phase) {
    const fallback = count
      ? `Press Play to watch it happen, in ${noun}, or step through it with the arrow keys.`
      : 'Press Play to watch it happen, or step through it with the arrow keys.';
    return { step: null, title: null, text: question ?? fallback };
  }

  return {
    step: `Phase ${currentIndex + 1} of ${count}`,
    title: phase.title,
    text: phase.description,
  };
}

/**
 * The phase, told large, next to the picture -- and the one thing a run says out loud.
 *
 * Vendored from Internet Visualizer (see VENDORED.md). Edits: the caption logic from its
 * `stage.ts` is inlined above, without the detail level or glossary links.
 *
 * Exactly one `role="status"` per view. A run moves the playhead sixty times a second; a
 * live region fed any of that would be a stream of interruptions, so only the phase is
 * announced. `status` (polite) rather than `alert`: a new phase can wait for the reader.
 * The per-tick reason ("P3 runs: shortest remaining time") is the inspector's job.
 *
 * Memoized, and handed only discrete values: some screen readers announce any mutation
 * of a live region, not just a change of text.
 */

export interface StepCaptionProps {
  phases: readonly PhaseSummary[];
  /** Index of the step in force, or `-1` before the first begins. */
  currentIndex: number;
  moment: StageMoment;
  /** A question to ask before the first play. */
  question?: string;
  className?: string;
}

export const StepCaption = memo(function StepCaption({
  phases,
  currentIndex,
  moment,
  question,
  className,
}: StepCaptionProps) {
  const caption = stepCaption(phases, currentIndex, moment, question);

  return (
    <div
      role="status"
      data-moment={moment}
      // Its height may be fixed by the view, so a long phase scrolls, and a scroll box of
      // text needs a tab stop of its own.
      tabIndex={0}
      className={cn(
        'text-fg text-story overflow-y-auto overscroll-contain leading-snug text-pretty',
        'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      {caption.step ? (
        <span className="text-accent text-small mb-0.5 block font-semibold tracking-wide">
          {caption.step}
          {/* Heard as one sentence, not "Phase 2 of 4P1 arrives...". */}
          <span className="sr-only">: </span>
        </span>
      ) : null}
      {caption.title ? (
        <span className="block font-semibold">
          {caption.title}
          <span className="sr-only">. </span>
        </span>
      ) : null}
      <span
        className={cn('block', caption.title && 'text-fg-secondary text-body mt-0.5')}
      >
        {caption.text}
      </span>
    </div>
  );
});
