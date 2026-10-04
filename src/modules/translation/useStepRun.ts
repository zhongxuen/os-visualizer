'use client';

import { useEffect, useRef } from 'react';

import { usePlayback, usePlaybackState } from '@/components/timeline/hooks/usePlayback';
import { usePlaybackKeys } from '@/components/timeline/hooks/usePlaybackKeys';
import { phaseIndexAt } from '@/components/timeline/PlaybackBar';
import { stageMoment } from '@/components/timeline/StepCaption';
import { unitCount, unitIndex } from '@/components/timeline/time';
import { STEP_MS } from '@/core/events/builder';
import type { ShareStateBase } from '@/core/state/schema';
import type { SimResult } from '@/core/sim/result';

/**
 * One playback store for a step run, the keyboard shortcuts, and the step kept in the
 * URL. `position` is the playhead as a whole step, 0 to the run length; the event on
 * screen is `events[min(position, length - 1)]`, so the end of the run shows the last
 * step. The step-run twin of the scheduling module's `useTickRun`.
 */
export function useStepRun<S extends ShareStateBase>(
  result: SimResult,
  share: {
    linked: S | null;
    setState: (next: (current: S) => S) => void;
  },
) {
  const store = usePlayback({ result });
  usePlaybackKeys(store);

  const total = unitCount(result.durationMs, 'step');
  const index = usePlaybackState(store, (s) => unitIndex(s.virtualTime, 'step'));
  const moment = usePlaybackState(store, (s) => stageMoment(s.status, s.virtualTime));
  const phaseIndex = usePlaybackState(store, (s) =>
    phaseIndexAt(result.phases, s.virtualTime),
  );
  const position = Math.min(index, total);

  // Apply the link's step once, after the linked run is in place.
  const { linked, setState } = share;
  const seeked = useRef(false);
  useEffect(() => {
    if (linked === null || seeked.current) return;
    seeked.current = true;
    if (linked.step > 0) store.getState().seek(Math.min(linked.step, total) * STEP_MS);
  }, [linked, store, total]);

  useEffect(() => {
    if (!seeked.current) return;
    setState((s) => (s.step === position ? s : { ...s, step: position }));
  }, [position, setState]);

  return { store, position, total, moment, phaseIndex };
}
