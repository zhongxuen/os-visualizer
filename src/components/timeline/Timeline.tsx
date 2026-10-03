'use client';

import { useLayoutEffect, useRef } from 'react';

import { UNIT_MS, type RunUnit } from '@/core/events/builder';
import type { PhaseSummary } from '@/core/sim/result';
import { cn } from '@/lib/cn';

import { useFrameClock } from './frameClock';
import {
  formatTimecode,
  formatTotal,
  formatValueText,
  percentOf,
  snapToUnit,
} from './time';
import { useReducedMotionSafe } from './useReducedMotionSafe';

/**
 * The scrubber.
 *
 * A native `<input type="range">` under the hood, on purpose. It is draggable, it is a
 * real ARIA slider, it announces its value, and its arrow keys, `Home`, and `End` already
 * do the right thing -- the keyboard map hands those back to it whenever it has focus
 * (`shouldIgnoreKey`) rather than moving the playhead twice.
 *
 * Step markers sit on their own rail above the track, as focusable buttons. That is the
 * other half of "navigable without a pointer": tab to a phase, press it, and playback
 * jumps to the moment that chapter begins. They are deliberately *not* overlaid on the
 * slider, where they would swallow drags aimed at the thumb.
 *
 * Everything here is virtual time, printed in the run's unit: ticks ("t = 7") or steps
 * ("step 7 / 23"), never milliseconds. The numbers do not change with the speed.
 *
 * Vendored from Internet Visualizer (see VENDORED.md). Edits: the `unit` prop and the
 * tick/step formatting, "Phase" for the markers, and reduced motion: the fill and thumb
 * snap to the start of the current tick or step instead of gliding through it.
 *
 * ## Why the playhead is written by hand
 *
 * This is the one control that genuinely moves on every frame, and the obvious way to
 * write it is the expensive one. `width: 42%` on the fill invalidates layout; setting the
 * slider's `value` and its `aria-valuetext`, and rewriting the elapsed timecode, do the
 * same to the layout and the accessibility tree. Sixty times a second that is a
 * document-wide cost rather than a timeline-sized one, which is the shape phase 14's
 * measurements kept finding.
 *
 * So when a `FrameClock` is in context, React renders this once and the effect below
 * writes the moving parts itself: `transform: scaleX()` for the fill, which the compositor
 * handles without a reflow, and the slider left uncontrolled so React never touches its
 * value. The two accessible strings -- `aria-valuetext` and the printed timecode -- are
 * updated only when the *displayed* time actually changes, which is what they describe.
 *
 * Without a clock (a timeline rendered on its own, a test) nothing changes: it is the
 * controlled component it always was.
 */

export interface TimelineProps {
  /** Far end of the run, in virtual milliseconds. */
  durationMs: number;
  /** Where the playhead is now. */
  virtualTime: number;
  /** Whether the run is read in ticks or steps. */
  unit: RunUnit;
  /** Phase boundaries to mark. */
  phases: readonly PhaseSummary[];
  /** Index of the phase containing the playhead, or `-1` before the first one. */
  currentPhaseIndex?: number;
  onSeek: (time: number) => void;
  className?: string;
}

/**
 * Slider granularity: one tick or step. Changed from Internet Visualizer's 1/200 of the
 * run: a run here is a few dozen discrete units, and an arrow key on the focused slider
 * should move exactly one of them.
 */
function stepFor(durationMs: number, unit: RunUnit): number {
  return durationMs > 0 ? UNIT_MS[unit] : 1;
}

const THUMB =
  '[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-accent ' +
  '[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-accent';

export function Timeline({
  durationMs,
  virtualTime: rawTime,
  unit,
  phases,
  currentPhaseIndex = -1,
  onSeek,
  className,
}: TimelineProps) {
  const { reduced } = useReducedMotionSafe();
  const virtualTime = reduced ? snapToUnit(rawTime, unit) : rawTime;
  const elapsed = percentOf(virtualTime, durationMs);
  const empty = durationMs <= 0;

  const clock = useFrameClock();
  const fillRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const elapsedRef = useRef<HTMLSpanElement | null>(null);
  const total = formatTotal(durationMs, unit);

  useLayoutEffect(() => {
    if (!clock) return;

    let printed: string | null = null;

    const apply = (raw: number) => {
      const time = reduced ? snapToUnit(raw, unit) : raw;
      const fraction = durationMs > 0 ? Math.min(1, Math.max(0, time / durationMs)) : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${fraction})`;
      if (sliderRef.current) sliderRef.current.value = String(time);

      // The playhead moves continuously; the timecode it is printed as does not. Writing
      // the text and the accessible value only when that string changes keeps both exact
      // while costing a DOM write a few times a second instead of sixty.
      const text = formatTimecode(time, durationMs, unit);
      if (text === printed) return;
      printed = text;
      if (elapsedRef.current) elapsedRef.current.textContent = text;
      sliderRef.current?.setAttribute(
        'aria-valuetext',
        formatValueText(time, durationMs, unit),
      );
    };

    apply(clock.now());
    return clock.subscribe(apply);
  }, [clock, durationMs, unit, reduced]);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/*
        Below `lg` the bar has room for the track and not for a marker per step, and a
        marker narrower than the 24px target floor is worse than none: the Steps tab is
        the way to a phase there.
      */}
      <div className="relative h-5 max-lg:hidden" aria-hidden={phases.length === 0}>
        {phases.map((phase) => (
          <button
            key={phase.id}
            type="button"
            onClick={() => onSeek(phase.startMs)}
            style={{ left: `${percentOf(phase.startMs, durationMs)}%` }}
            aria-current={phase.index === currentPhaseIndex ? 'step' : undefined}
            aria-label={`Phase ${phase.index + 1}, ${phase.title}, at ${formatTimecode(phase.startMs, durationMs, unit)}`}
            title={`${phase.title} (${formatTimecode(phase.startMs, durationMs, unit)})`}
            className={cn(
              'focus-visible:outline-focus absolute bottom-0 flex h-5 w-4 -translate-x-1/2 items-end justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2',
              'group',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'block h-2.5 w-0.5 rounded-full transition-colors',
                phase.index === currentPhaseIndex
                  ? 'bg-accent h-3.5'
                  : 'bg-border-strong group-hover:bg-fg-secondary',
              )}
            />
          </button>
        ))}
      </div>

      <div className="relative flex h-4 items-center">
        {/* Track and fill are decorative: the slider below carries the semantics. */}
        <div
          aria-hidden="true"
          className="bg-surface-overlay border-border absolute inset-x-0 h-1.5 rounded-full border"
        />
        {/*
          Full width, scaled down: `transform` is a compositor property, so the playhead
          advancing does not dirty the page's layout. See the note at the top of the file.
        */}
        <div
          ref={fillRef}
          aria-hidden="true"
          style={{
            transform: `scaleX(${Math.min(1, Math.max(0, elapsed / 100))})`,
            transformOrigin: 'left center',
          }}
          className="bg-accent absolute inset-x-0 h-1.5 rounded-full"
        />

        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={empty ? 1 : durationMs}
          step={stepFor(durationMs, unit)}
          // Uncontrolled while a clock is driving it, so React never writes `value` and
          // the effect above is the only thing that moves the thumb. Controlled without
          // one, exactly as before.
          {...(clock ? { defaultValue: virtualTime } : { value: virtualTime })}
          disabled={empty}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Playback position"
          aria-valuetext={formatValueText(virtualTime, durationMs, unit)}
          className={cn(
            'relative w-full cursor-pointer appearance-none bg-transparent',
            'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-4',
            'disabled:cursor-not-allowed',
            THUMB,
          )}
        />
      </div>

      {/* Always shown, unlike Internet Visualizer's: "t = 7" is the lesson, not chrome. */}
      <div className="text-fg-muted text-caption flex justify-between font-mono">
        <span ref={elapsedRef}>{formatTimecode(virtualTime, durationMs, unit)}</span>
        <span>{total}</span>
      </div>
    </div>
  );
}
