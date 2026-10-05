import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PLAYBACK_SPEEDS } from '@/core/sim/playback';

import { createPlaybackStore, PlaybackContext } from '../timeline/hooks/usePlayback';

import { reduceMotion } from './testing';
import { DURATION } from './tokens';
import {
  StepTransitionProvider,
  stepTransition,
  useStepTransition,
} from './useStepTransition';

/** docs/UIUX.md §6.1 rules 2, 3 and 5, as the one function every primitive asks. */

const base = { speed: 1, reduced: false };

describe('stepTransition', () => {
  it('animates exactly one step forward, for the token', () => {
    const t = stepTransition({ ...base, from: 3, to: 4 });
    expect(t).toMatchObject({
      direction: 'forward',
      animate: true,
      duration: DURATION.move,
    });
    expect(t.scale(DURATION.enter)).toBe(DURATION.enter);
  });

  it('is instant for a step back, a jump and the first render (rule 2)', () => {
    const cases: [number, number][] = [
      [4, 3],
      [0, 9],
      [9, 0],
      [2, 2],
    ];
    for (const [from, to] of cases) {
      const t = stepTransition({ ...base, from, to });
      expect(t.animate, `${from} -> ${to}`).toBe(false);
      expect(t.duration).toBe(0);
      expect(t.scale(DURATION.enter)).toBe(0);
    }
    expect(stepTransition({ ...base, from: 4, to: 3 }).direction).toBe('back');
  });

  it('fits inside the step: min(token, 0.6 x real interval) (rule 3)', () => {
    // 200 virtual ms per step at 1x is 200 real ms: capped at 120.
    expect(
      stepTransition({ ...base, from: 0, to: 1, stepIntervalMs: 200 }).duration,
    ).toBe(120);
    // The same interval at 0.5x is 400 real ms: the 220 ms token fits.
    expect(
      stepTransition({ ...base, speed: 0.5, from: 0, to: 1, stepIntervalMs: 200 })
        .duration,
    ).toBe(220);
  });

  it('is instant at speeds 4-5, so fast playback never queues animations', () => {
    for (const speed of PLAYBACK_SPEEDS.slice(3)) {
      const t = stepTransition({ ...base, speed, from: 0, to: 1 });
      expect(t.animate, `${speed}x`).toBe(false);
      expect(t.scale(DURATION.enter)).toBe(0);
    }
    for (const speed of PLAYBACK_SPEEDS.slice(0, 3)) {
      expect(
        stepTransition({ ...base, speed, from: 0, to: 1 }).animate,
        `${speed}x`,
      ).toBe(true);
    }
  });

  it('is instant under reduced motion (rule 5)', () => {
    const t = stepTransition({ ...base, reduced: true, from: 0, to: 1 });
    expect(t.animate).toBe(false);
    expect(t.scale(DURATION.highlight)).toBe(0);
  });
});

function Probe() {
  const t = useStepTransition();
  return (
    <output>
      {t.direction}:{t.animate ? 'animate' : 'instant'}:{t.duration}
    </output>
  );
}

function at(step: number) {
  return (
    <StepTransitionProvider step={step}>
      <Probe />
    </StepTransitionProvider>
  );
}

describe('StepTransitionProvider', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('reports nothing outside a provider, and nothing on first render', () => {
    const view = render(<Probe />);
    expect(screen.getByRole('status')).toHaveTextContent('none:instant:0');
    view.rerender(at(2));
    expect(screen.getByRole('status')).toHaveTextContent('none:instant:0');
  });

  it('tracks the step it is given', () => {
    const view = render(at(2));
    view.rerender(at(3));
    expect(screen.getByRole('status')).toHaveTextContent('forward:animate:220');
    view.rerender(at(2));
    expect(screen.getByRole('status')).toHaveTextContent('back:instant:0');
  });

  it('reads the speed from the surrounding playback store', () => {
    const store = createPlaybackStore(
      { durationMs: 10, phaseStarts: [], eventTimes: [] },
      4,
    );
    const ui = (step: number) => (
      <PlaybackContext value={store}>{at(step)}</PlaybackContext>
    );
    const view = render(ui(0));
    view.rerender(ui(1));
    expect(screen.getByRole('status')).toHaveTextContent('forward:instant:0');
  });

  it('goes through useReducedMotionSafe', () => {
    restore = reduceMotion();
    const view = render(at(0));
    view.rerender(at(1));
    expect(screen.getByRole('status')).toHaveTextContent('forward:instant:0');
  });
});
