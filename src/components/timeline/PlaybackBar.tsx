'use client';

import { useMemo, type ReactNode } from 'react';

import type { RunUnit } from '@/core/events/builder';
import { currentPhaseStart } from '@/core/sim/playback';
import type { PhaseSummary } from '@/core/sim/result';

import { FrameClockContext, type FrameClock } from './frameClock';
import { usePlaybackState, type PlaybackStore } from './hooks/usePlayback';
import { PlaybackControls } from './PlaybackControls';
import { Timeline } from './Timeline';

/**
 * The transport bar, wired: controls and scrubber reading one playback store.
 *
 * Local (not vendored). In Internet Visualizer this wiring lives inside its
 * `SimulationView`, which is too tied to packets to copy. It provides the `FrameClock`
 * the vendored `Timeline` uses to move its playhead without a React render per frame, so
 * this component itself re-renders only when the status, speed or phase changes.
 */

export function frameClockFor(store: PlaybackStore): FrameClock {
  return {
    now: () => store.getState().virtualTime,
    subscribe: (listener) =>
      store.subscribe((state, previous) => {
        if (state.virtualTime !== previous.virtualTime) listener(state.virtualTime);
      }),
  };
}

/** Index of the phase containing `time`, or `-1` before the first. */
export function phaseIndexAt(phases: readonly PhaseSummary[], time: number): number {
  for (let i = phases.length - 1; i >= 0; i -= 1) {
    if (phases[i]!.startMs <= time) return i;
  }
  return -1;
}

export interface PlaybackBarProps {
  store: PlaybackStore;
  phases: readonly PhaseSummary[];
  unit: RunUnit;
  /** Extra content after the timeline, inside the bar. */
  children?: ReactNode;
  className?: string;
}

export function PlaybackBar({
  store,
  phases,
  unit,
  children,
  className,
}: PlaybackBarProps) {
  const clock = useMemo(() => frameClockFor(store), [store]);
  const status = usePlaybackState(store, (s) => s.status);
  const speed = usePlaybackState(store, (s) => s.speed);
  const durationMs = usePlaybackState(store, (s) => s.timeline.durationMs);
  // Selected as the phase *start*, so the bar re-renders when the phase turns over and
  // not on every frame in between.
  const phaseStart = usePlaybackState(store, (s) =>
    currentPhaseStart(s.timeline, s.virtualTime),
  );
  const currentPhaseIndex = phaseIndexAt(phases, phaseStart);

  return (
    <FrameClockContext value={clock}>
      <PlaybackControls
        status={status}
        speed={speed}
        unit={unit}
        onCommand={(command) => store.getState().run(command)}
        className={className}
      >
        <Timeline
          className="min-w-0 flex-1"
          durationMs={durationMs}
          virtualTime={store.getState().virtualTime}
          unit={unit}
          phases={phases}
          currentPhaseIndex={currentPhaseIndex}
          onSeek={(time) => store.getState().seek(time)}
        />
        {children}
      </PlaybackControls>
    </FrameClockContext>
  );
}
