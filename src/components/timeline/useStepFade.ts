'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

import { DURATION, EASE_OUT } from '../motion/tokens';
import { useStepTransition } from '../motion/useStepTransition';

/**
 * A short cross-fade on text that changes with the step: the caption, the inspector
 * (docs/UIUX.md §4.2, §6.1).
 *
 * Asks `useStepTransition()` whether this change animates, so exactly one step forward
 * fades and a step back, a jump, a scrub, reduced motion and speeds 4-5 are instant
 * (§6.1 rules 2, 3 and 5). The Web Animations API, not a keyframe: nothing to restart by
 * re-keying, and the element's resting style is its end frame (rule 4). Opacity only
 * (rule 7). Does nothing where `element.animate` does not exist (jsdom).
 */
export function useStepFade<T extends HTMLElement>(key: unknown): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { animate, scale } = useStepTransition();
  const previous = useRef(key);

  useLayoutEffect(() => {
    if (Object.is(previous.current, key)) return;
    previous.current = key;
    const element = ref.current;
    const duration = scale(DURATION.move);
    if (!animate || duration <= 0 || !element || typeof element.animate !== 'function') {
      return;
    }
    const animation = element.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration,
      easing: `cubic-bezier(${EASE_OUT.join(',')})`,
    });
    return () => animation.cancel();
  }, [key, animate, scale]);

  return ref;
}
