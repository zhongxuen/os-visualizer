'use client';

import { useMemo, useSyncExternalStore } from 'react';

/**
 * The reduced-motion hook every animated component uses.
 *
 * Vendored from Internet Visualizer's `useReducedMotionSafe.ts`, with the parts of its
 * `MotionProvider.tsx` it needs folded in (see VENDORED.md). What is gone is the in-app
 * override stored with Internet Visualizer's preferences: here the OS setting is the
 * only source, which the CSS half of the policy (globals.css) also reads, so the two
 * halves cannot disagree.
 *
 * `reduced === true` removes **tweening only**. Playback still advances and every step
 * stays reachable; a transition lands on its end state at once. Durations go through
 * `scale()`, which collapses them to `0`.
 *
 * SSR-safe: the server renders full motion and the client corrects on hydration.
 */

export interface MotionContextValue {
  /** Tweening is off. Read this before animating anything. */
  reduced: boolean;
  /** An intended duration (ms), or `0` when motion is reduced. */
  scale: (ms: number) => number;
}

const MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const list = window.matchMedia(MEDIA_QUERY);
  list.addEventListener('change', onStoreChange);
  return () => list.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** `0` rather than a small value, so nothing schedules a frame that still moves. */
export function scaleDuration(reduced: boolean, ms: number): number {
  return reduced ? 0 : ms;
}

export function useReducedMotionSafe(): MotionContextValue {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(
    () => ({ reduced, scale: (ms: number) => scaleDuration(reduced, ms) }),
    [reduced],
  );
}
