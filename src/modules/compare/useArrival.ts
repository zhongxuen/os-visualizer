'use client';

import { useLayoutEffect, useRef } from 'react';

import { useStepTransition } from '@/components/motion/useStepTransition';

/**
 * Play a one-shot entrance (Web Animations API) when an element first appears, if it
 * appeared on a forward step: the "done at t" flag dropping in, a best or tie marker
 * popping in, a word of the headline (docs/UIUX.md §7.2.2).
 *
 * The duration and delay are tokens put through the step transition's `scale`, so the
 * §6.1 rules hold without a special case: a jump (End), a step back, loading a URL,
 * reduced motion and speeds 4-5 all give `0`, and nothing plays. The element's own
 * styles are its final frame, so whatever does not animate is already right.
 */
export function useArrival<T extends Element>(
  keyframes: Keyframe[],
  {
    token,
    delayToken = 0,
    easing = 'cubic-bezier(.2, .8, .2, 1)',
  }: { token: number; delayToken?: number; easing?: string },
) {
  const ref = useRef<T>(null);
  const { scale } = useStepTransition();
  // Read once, on the render that mounts the element: that is the step it arrived on.
  const plan = useRef({
    keyframes,
    easing,
    duration: scale(token),
    delay: scale(delayToken),
  });

  useLayoutEffect(() => {
    const el = ref.current;
    const { keyframes: frames, easing: ease, duration, delay } = plan.current;
    if (duration <= 0 || !el || typeof el.animate !== 'function') return;
    const animation = el.animate(frames, {
      duration,
      delay,
      easing: ease,
      fill: 'backwards',
    });
    return () => animation.cancel();
  }, []);

  return ref;
}

/** A marker's pop, with the one small overshoot kept for "decided" moments (§6.2). */
export const POP: Keyframe[] = [
  { opacity: 0, transform: 'scale(0.6)' },
  { opacity: 1, transform: 'scale(1)' },
];
export const EASE_SNAP = 'cubic-bezier(.3, 1.4, .5, 1)';

/** A flag dropping in from just above. */
export const DROP: Keyframe[] = [
  { opacity: 0, transform: 'translateY(-6px)' },
  { opacity: 1, transform: 'translateY(0)' },
];

export const FADE: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
