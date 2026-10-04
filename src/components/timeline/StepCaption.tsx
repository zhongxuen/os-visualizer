'use client';

import { memo, useEffect, useRef, useState } from 'react';

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
 * `stage.ts` is inlined above, without the detail level or glossary links; and the
 * spoken copy is a separate, throttled live region (below).
 *
 * Exactly one caption region per view. A run moves the playhead sixty times a second; a
 * live region fed any of that would be a stream of interruptions, so only the phase is
 * announced, and during playback at most once every `CAPTION_THROTTLE_MS`: at 4x speed a
 * scheduling run can change phase several times a second, and a screen reader that is
 * interrupted that often says nothing useful. The latest phase is always announced once
 * the run settles (trailing edge), and the start and the end are announced at once.
 * `status` (polite) rather than `alert`: a new phase can wait for the reader. The per-tick
 * reason ("P3 runs: shortest remaining time") is the inspector's job.
 *
 * The visible caption updates at once; only what is spoken is throttled.
 */

/** Shortest gap between two spoken captions while a run is moving. */
export const CAPTION_THROTTLE_MS = 1000;

/** The caption as one spoken sentence: "Phase 2 of 4: P1 arrives. P1 runs." */
export function spokenCaption(caption: StepCaptionText): string {
  return [
    caption.step ? `${caption.step}: ` : '',
    caption.title ? `${caption.title}. ` : '',
    caption.text,
  ].join('');
}

/** `text`, but changing at most once per `CAPTION_THROTTLE_MS` unless `immediate`. */
function useThrottled(text: string, immediate: boolean): string {
  const [spoken, setSpoken] = useState(text);
  const last = useRef(0);
  useEffect(() => {
    const now = Date.now();
    const wait = immediate ? 0 : Math.max(0, last.current + CAPTION_THROTTLE_MS - now);
    const timer = setTimeout(() => {
      last.current = Date.now();
      setSpoken(text);
    }, wait);
    return () => clearTimeout(timer);
  }, [text, immediate]);
  return spoken;
}

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
  const spoken = useThrottled(spokenCaption(caption), moment !== 'running');

  return (
    <div
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
      {/* Seen, not heard: the status region below speaks the same words, throttled. */}
      <span aria-hidden="true" className="block">
        {caption.step ? (
          <span className="text-accent text-small mb-0.5 block font-semibold tracking-wide">
            {caption.step}
          </span>
        ) : null}
        {caption.title ? (
          <span className="block font-semibold">{caption.title}</span>
        ) : null}
        <span
          className={cn('block', caption.title && 'text-fg-secondary text-body mt-0.5')}
        >
          {caption.text}
        </span>
      </span>
      <span role="status" className="sr-only">
        {spoken}
      </span>
    </div>
  );
});
