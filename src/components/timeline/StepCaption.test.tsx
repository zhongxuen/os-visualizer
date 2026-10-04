import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CAPTION_THROTTLE_MS,
  DONE_CAPTION,
  stageMoment,
  StepCaption,
  stepCaption,
} from './StepCaption';
import { buildTickRun } from './testing';

const RUN = buildTickRun();

describe('stageMoment', () => {
  it('is ready only at rest at the start, and done only at the end', () => {
    expect(stageMoment('idle', 0)).toBe('ready');
    expect(stageMoment('paused', 0)).toBe('running');
    expect(stageMoment('idle', 1000)).toBe('running');
    expect(stageMoment('ended', 6000)).toBe('done');
  });
});

describe('stepCaption', () => {
  it('names the phase, its title and its description while running', () => {
    expect(stepCaption(RUN.phases, 1, 'running')).toEqual({
      step: 'Phase 2 of 3',
      title: 'P2 preempts P1',
      text: 'P2 arrives with a shorter burst and takes the CPU.',
    });
  });

  it('asks the question before the first play, and says done at the end', () => {
    expect(stepCaption(RUN.phases, -1, 'ready', 'Which runs first?').text).toBe(
      'Which runs first?',
    );
    expect(stepCaption(RUN.phases, -1, 'ready').text).toMatch(/in 3 phases/);
    expect(stepCaption(RUN.phases, 2, 'done').text).toBe(DONE_CAPTION);
  });
});

describe('StepCaption', () => {
  it('is the one polite live region, and reads as one sentence', () => {
    render(<StepCaption phases={RUN.phases} currentIndex={0} moment="running" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Phase 1 of 3: P1 arrives. P1 is the only process, so it runs.',
    );
  });
});

describe('StepCaption throttling', () => {
  it('speaks at most once per CAPTION_THROTTLE_MS while running, then the latest', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <StepCaption phases={RUN.phases} currentIndex={0} moment="running" />,
      );
      const status = screen.getByRole('status');
      act(() => vi.advanceTimersByTime(CAPTION_THROTTLE_MS));

      rerender(<StepCaption phases={RUN.phases} currentIndex={1} moment="running" />);
      act(() => vi.advanceTimersByTime(0));
      expect(status).toHaveTextContent(/^Phase 2 of 3/);

      // Two more phases inside one window: nothing is said until it closes, then only
      // the latest.
      rerender(<StepCaption phases={RUN.phases} currentIndex={2} moment="running" />);
      act(() => vi.advanceTimersByTime(CAPTION_THROTTLE_MS / 2));
      expect(status).toHaveTextContent(/^Phase 2 of 3/);
      act(() => vi.advanceTimersByTime(CAPTION_THROTTLE_MS));
      expect(status).toHaveTextContent(/^Phase 3 of 3/);

      // The end is said at once.
      rerender(<StepCaption phases={RUN.phases} currentIndex={2} moment="done" />);
      act(() => vi.advanceTimersByTime(0));
      expect(status).toHaveTextContent(DONE_CAPTION);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the new phase at once even while the spoken copy waits', () => {
    const { rerender } = render(
      <StepCaption phases={RUN.phases} currentIndex={0} moment="running" />,
    );
    rerender(<StepCaption phases={RUN.phases} currentIndex={1} moment="running" />);
    expect(screen.getByText('P2 preempts P1')).toBeVisible();
  });
});
