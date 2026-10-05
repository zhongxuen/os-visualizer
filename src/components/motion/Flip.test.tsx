import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Flip } from './Flip';
import { reduceMotion } from './testing';
import { StepTransitionProvider } from './useStepTransition';

/**
 * `motion` is replaced by a stand-in that records the `layout` and `transition` it was
 * given, so the test checks what Flip asks for, not motion's own measuring.
 */
const fake = vi.hoisted(() => {
  const state = { peeked: null as unknown };
  return { state };
});

function FakeMotionDiv({
  layout,
  transition,
  children,
  className,
}: {
  layout?: boolean;
  transition?: { duration: number };
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-motion=""
      data-layout={String(layout)}
      data-duration={String(transition?.duration)}
      className={className}
    >
      {children}
    </div>
  );
}

const fakeMotion = { motion: { div: FakeMotionDiv } };
const loadMotion = vi.fn(() => Promise.resolve(fakeMotion));

vi.mock('./loadMotion', () => ({
  loadMotion: () => loadMotion(),
  peekMotion: () => fake.state.peeked,
}));

function List({ step, order, speed }: { step: number; order: string[]; speed?: number }) {
  return (
    <StepTransitionProvider step={step} speed={speed}>
      <Flip itemClassName="item">
        {order.map((id) => (
          <span key={id}>{id}</span>
        ))}
      </Flip>
    </StepTransitionProvider>
  );
}

function boxes() {
  return ['A', 'B', 'C'].map((id) => screen.getByText(id).parentElement!);
}

describe('Flip', () => {
  let restore: (() => void) | null = null;
  beforeEach(() => {
    loadMotion.mockClear();
    fake.state.peeked = null;
  });
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('renders the end state at once, then lazy-loads motion', async () => {
    const { container } = render(<List step={0} order={['A', 'B', 'C']} />);
    expect(container.querySelector('[data-flip]')).toHaveAttribute('data-flip', 'static');
    expect(boxes().every((box) => box.classList.contains('item'))).toBe(true);
    await act(async () => {});
    expect(loadMotion).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-flip]')).toHaveAttribute('data-flip', 'motion');
  });

  it('glides for --dur-2 on a forward step, keeping the new order', () => {
    fake.state.peeked = fakeMotion;
    const view = render(<List step={0} order={['A', 'B', 'C']} />);
    view.rerender(<List step={1} order={['C', 'A', 'B']} />);
    expect(view.container.textContent).toBe('CAB');
    for (const box of boxes()) {
      expect(box).toHaveAttribute('data-layout', 'true');
      expect(box).toHaveAttribute('data-duration', '0.22');
    }
  });

  it('moves instantly on a step back', () => {
    fake.state.peeked = fakeMotion;
    const view = render(<List step={3} order={['A', 'B', 'C']} />);
    view.rerender(<List step={2} order={['B', 'A', 'C']} />);
    for (const box of boxes()) expect(box).toHaveAttribute('data-duration', '0');
  });

  it('moves instantly at speeds 4-5', () => {
    fake.state.peeked = fakeMotion;
    for (const speed of [2, 4]) {
      const view = render(<List step={0} order={['A', 'B', 'C']} speed={speed} />);
      view.rerender(<List step={1} order={['C', 'B', 'A']} speed={speed} />);
      for (const box of boxes()) expect(box).toHaveAttribute('data-duration', '0');
      view.unmount();
    }
  });

  it('never loads motion under reduced motion, and renders plain boxes', async () => {
    restore = reduceMotion();
    const view = render(<List step={0} order={['A', 'B', 'C']} />);
    await act(async () => {});
    view.rerender(<List step={1} order={['C', 'A', 'B']} />);
    expect(loadMotion).not.toHaveBeenCalled();
    expect(view.container.querySelector('[data-motion]')).toBeNull();
    expect(view.container.textContent).toBe('CAB');
  });
});
