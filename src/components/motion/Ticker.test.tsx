import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { reduceMotion, stepFrom } from './testing';
import { Ticker } from './Ticker';

/** The transition duration on each digit column. */
function durations(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[data-digit] > span')].map(
    (column) => column.style.transitionDuration,
  );
}

const ui = (step: number) => <Ticker value={step} />;

describe('Ticker', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('reads as its value, in tabular mono, with the digit columns hidden', () => {
    const { container } = render(<Ticker value={42} />);
    expect(screen.getByText('42')).toHaveClass('sr-only');
    expect(container.querySelector('[data-ticker]')).toHaveClass('num');
    expect(container.querySelector('[aria-hidden="true"] [data-digit]')).not.toBeNull();
  });

  it('places each digit column on its digit', () => {
    const { container } = render(<Ticker value={7} />);
    const column = container.querySelector<HTMLElement>('[data-digit="7"] > span');
    expect(column?.style.transform).toBe('translateY(-70%)');
  });

  it('rolls on a forward step', () => {
    const { container } = stepFrom(9, 10, ui);
    expect(durations(container)).toEqual(['220ms', '220ms']);
  });

  it('is instant on a step back', () => {
    const { container } = stepFrom(10, 9, ui);
    expect(durations(container)).toEqual(['0ms']);
  });

  it('is instant under reduced motion', () => {
    restore = reduceMotion();
    const { container } = stepFrom(1, 2, ui);
    expect(durations(container)).toEqual(['0ms']);
  });

  it('is instant at speeds 4-5', () => {
    for (const speed of [2, 4]) {
      const { container, unmount } = stepFrom(1, 2, ui, { speed });
      expect(durations(container)).toEqual(['0ms']);
      unmount();
    }
  });

  it('passes non-digits through', () => {
    render(<Ticker value="-3.5" />);
    expect(screen.getByText('-3.5')).toBeInTheDocument();
  });
});
