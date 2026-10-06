'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

import { DURATION, useStepTransition } from '@/components/motion';

/**
 * Run a Web Animations API animation on one element when `key` changes on a forward
 * step: the module's step motion (docs/UIUX.md §7.2.3) beyond what Flash, Ticker,
 * DrawPath and Flip cover, built the same way as the shared `useStepFade`.
 *
 * The duration comes from `useStepTransition().scale(token)`, so a step back, a jump, a
 * scrub, reduced motion and speeds 4-5 get `0` and nothing runs (§6.1 rules 2, 3 and 5).
 * `animate` describes motion *towards* the element's resting style, which is its end
 * frame: a paused frame shows the same thing as a finished animation (rule 4). Only
 * `transform`, `opacity` and colours move (rule 7). Does nothing where `element.animate`
 * does not exist (jsdom).
 */
export function useStepMotion<T extends HTMLElement>(
  key: unknown,
  animate: (element: T, duration: number) => Animation[] | Animation | null | undefined,
  token: number = DURATION.move,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { scale } = useStepTransition();
  const previous = useRef(key);
  const run = useRef(animate);
  useLayoutEffect(() => {
    run.current = animate;
  });

  useLayoutEffect(() => {
    if (Object.is(previous.current, key)) return;
    previous.current = key;
    const element = ref.current;
    const duration = scale(token);
    if (duration <= 0 || !element || typeof element.animate !== 'function') return;
    const started = run.current(element, duration);
    if (!started) return;
    const list = Array.isArray(started) ? started : [started];
    return () => list.forEach((a) => a.cancel());
  }, [key, scale, token]);

  return ref;
}

/** `--ease-out`, for `element.animate`. */
export const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
