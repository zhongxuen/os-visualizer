'use client';

import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react';

import { useReducedMotionSafe } from '../timeline/useReducedMotionSafe';

import { loadMotion, peekMotion, type MotionModule } from './loadMotion';
import { DURATION, EASE_OUT } from './tokens';
import { useStepTransition } from './useStepTransition';

/**
 * Layout animation for a list whose order or membership changes between steps: queue
 * chips, frame cells, Compare columns (docs/UIUX.md §6.3).
 *
 * Each keyed child is wrapped in an item box; once `motion` has loaded, that box is a
 * `motion.div` with `layout`, which glides it from where it was to where it is. The
 * glide lasts `scale(--dur-2)`: on anything but a forward step, under reduced motion
 * and at speeds 4-5 that is `0`, and motion moves the box at once.
 *
 * `motion` is fetched lazily (`loadMotion`) after mount, and never under reduced motion:
 * then the boxes are plain `<div>`s for good. Until it arrives the list renders as plain
 * boxes too, so the end state is right from the first paint; the swap to motion boxes
 * happens once, before any step is taken, and remounts the items that one time.
 *
 * Children need stable `key`s: the key is what says "this chip moved", not "this chip
 * left and another arrived".
 */

export interface FlipProps {
  children?: ReactNode;
  className?: string;
  /** Classes for each item's box. */
  itemClassName?: string;
}

export function Flip({ children, className, itemClassName }: FlipProps) {
  const { scale } = useStepTransition();
  const { reduced } = useReducedMotionSafe();
  const [module, setModule] = useState<MotionModule | null>(peekMotion);

  useEffect(() => {
    if (reduced || module) return;
    let live = true;
    void loadMotion().then((loaded) => {
      if (live) setModule(loaded);
    });
    return () => {
      live = false;
    };
  }, [reduced, module]);

  const items = Children.toArray(children).filter(isValidElement);
  const MotionBox = !reduced && module ? module.motion.div : null;
  const duration = scale(DURATION.move);

  return (
    <div className={className} data-flip={MotionBox ? 'motion' : 'static'}>
      {items.map((child) =>
        MotionBox ? (
          <MotionBox
            key={child.key}
            layout
            transition={{ duration: duration / 1000, ease: EASE_OUT }}
            className={itemClassName}
          >
            {child}
          </MotionBox>
        ) : (
          <div key={child.key} className={itemClassName}>
            {child}
          </div>
        ),
      )}
    </div>
  );
}
