'use client';

import type { CSSProperties, SVGProps } from 'react';

import { cn } from '@/lib/cn';

import { DURATION } from './tokens';
import { useStepTransition } from './useStepTransition';

/**
 * An SVG path or edge that draws itself in (docs/UIUX.md §6.3): a request edge in the
 * deadlock graph, a line in a chart.
 *
 * `pathLength="1"` normalises the path, so the `osv-draw` keyframe (motion.css) runs the
 * dash offset from 1 to 0 whatever the path's real length. It runs once per change of
 * `trigger` (default: the path data) on a forward step. Otherwise -- a step back, a jump,
 * reduced motion, speeds 4-5 -- the path is drawn whole, with no dash at all.
 */

export interface DrawPathProps extends SVGProps<SVGPathElement> {
  /** Restarts the draw when it changes. Defaults to `d`. */
  trigger?: string | number;
  /** Only a path that just appeared draws in. */
  active?: boolean;
}

export function DrawPath({
  trigger,
  active = true,
  className,
  style,
  ...props
}: DrawPathProps) {
  const { scale } = useStepTransition();
  const duration = active ? scale(DURATION.enter) : 0;
  const run = duration > 0;

  return (
    <path
      key={run ? String(trigger ?? props.d) : 'still'}
      {...props}
      pathLength={run ? 1 : props.pathLength}
      data-draw={run ? '' : undefined}
      className={cn(run && 'motion-draw', className)}
      style={run ? ({ ...style, '--draw-dur': `${duration}ms` } as CSSProperties) : style}
    />
  );
}
