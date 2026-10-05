import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Flash } from './Flash';
import { reduceMotion, stepFrom } from './testing';

const ui = (step: number) => <Flash trigger={step}>{`value ${step}`}</Flash>;

describe('Flash', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('pulses once on a forward step, for the arrival token', () => {
    stepFrom(1, 2, ui);
    const el = screen.getByText('value 2');
    expect(el).toHaveClass('motion-flash');
    expect(el.style.getPropertyValue('--flash-dur')).toBe('360ms');
  });

  it('shows the value with no pulse on a step back or a jump', () => {
    const back = stepFrom(2, 1, ui);
    expect(screen.getByText('value 1')).not.toHaveClass('motion-flash');
    back.unmount();
    stepFrom(1, 7, ui);
    expect(screen.getByText('value 7')).not.toHaveClass('motion-flash');
  });

  it('is instant under reduced motion', () => {
    restore = reduceMotion();
    stepFrom(1, 2, ui);
    expect(screen.getByText('value 2')).not.toHaveClass('motion-flash');
  });

  it('is instant at speeds 4-5', () => {
    for (const speed of [2, 4]) {
      const { unmount } = stepFrom(1, 2, ui, { speed });
      expect(screen.getByText('value 2')).not.toHaveAttribute('data-flash');
      unmount();
    }
  });

  it('does not pulse when inactive', () => {
    stepFrom(1, 2, (step) => (
      <Flash trigger={step} active={false}>
        {`value ${step}`}
      </Flash>
    ));
    expect(screen.getByText('value 2')).not.toHaveClass('motion-flash');
  });
});
