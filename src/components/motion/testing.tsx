import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { StepTransitionProvider, type StepChangeOptions } from './useStepTransition';

/**
 * Test helpers for the motion primitives: pretend the viewer asked for reduced motion,
 * and render a primitive at one step then move it to another.
 */

/** Make `prefers-reduced-motion: reduce` match. Returns the undo. */
export function reduceMotion(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    ...original(query),
    matches: query.includes('reduce'),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/** Render `ui(step)` at step `from`, then move to step `to`. */
export function stepFrom(
  from: number,
  to: number,
  ui: (step: number) => ReactNode,
  options: StepChangeOptions = {},
) {
  const view = render(
    <StepTransitionProvider step={from} {...options}>
      {ui(from)}
    </StepTransitionProvider>,
  );
  view.rerender(
    <StepTransitionProvider step={to} {...options}>
      {ui(to)}
    </StepTransitionProvider>,
  );
  return view;
}
