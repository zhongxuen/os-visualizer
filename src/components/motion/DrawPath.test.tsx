import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DrawPath } from './DrawPath';
import { reduceMotion, stepFrom } from './testing';

const ui = (step: number) => (
  <svg>
    <DrawPath d={`M0 0 L${step} 10`} stroke="currentColor" />
  </svg>
);

describe('DrawPath', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('draws in on a forward step', () => {
    const { container } = stepFrom(1, 2, ui);
    const path = container.querySelector('path')!;
    expect(path).toHaveClass('motion-draw');
    expect(path).toHaveAttribute('pathLength', '1');
    expect(path.style.getPropertyValue('--draw-dur')).toBe('360ms');
    expect(path).toHaveAttribute('d', 'M0 0 L2 10');
  });

  it('is drawn whole on first render and on a step back', () => {
    const first = render(ui(3));
    expect(first.container.querySelector('path')).not.toHaveClass('motion-draw');
    first.unmount();
    const { container } = stepFrom(3, 2, ui);
    expect(container.querySelector('path')).not.toHaveAttribute('pathLength');
  });

  it('is instant under reduced motion', () => {
    restore = reduceMotion();
    const { container } = stepFrom(1, 2, ui);
    expect(container.querySelector('path')).not.toHaveClass('motion-draw');
  });

  it('is instant at speeds 4-5', () => {
    for (const speed of [2, 4]) {
      const { container, unmount } = stepFrom(1, 2, ui, { speed });
      expect(container.querySelector('path')).not.toHaveAttribute('data-draw');
      unmount();
    }
  });
});
