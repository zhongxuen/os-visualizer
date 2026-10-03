import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { STEP_MS, TICK_MS } from '@/core/events/builder';

import { buildTickRun } from './testing';
import { Timeline } from './Timeline';

const RUN = buildTickRun();

function renderTimeline(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
  const onSeek = vi.fn();
  render(
    <Timeline
      durationMs={RUN.durationMs}
      virtualTime={3 * TICK_MS}
      unit="tick"
      phases={RUN.phases}
      currentPhaseIndex={1}
      onSeek={onSeek}
      {...overrides}
    />,
  );
  return { onSeek };
}

describe('Timeline', () => {
  it('is a real slider, reporting ticks rather than milliseconds', () => {
    renderTimeline();

    const scrubber = screen.getByRole('slider', { name: 'Playback position' });
    expect(scrubber).toHaveValue(String(3 * TICK_MS));
    expect(scrubber).toHaveAttribute('aria-valuetext', 't = 3 of 6 ticks');
    expect(screen.getByText('t = 3')).toBeInTheDocument();
    expect(screen.getByText('6 ticks')).toBeInTheDocument();
  });

  it('moves one tick per arrow key on the focused slider', () => {
    renderTimeline();
    expect(screen.getByRole('slider')).toHaveAttribute('step', String(TICK_MS));
  });

  it('seeks when it is dragged', () => {
    const { onSeek } = renderTimeline();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '4000' } });
    expect(onSeek).toHaveBeenCalledWith(4000);
  });

  it('gives every phase a labelled marker that seeks to its start', async () => {
    const user = userEvent.setup();
    const { onSeek } = renderTimeline();

    const marker = screen.getByRole('button', {
      name: 'Phase 3, P1 finishes, at t = 5',
    });
    await user.click(marker);

    expect(onSeek).toHaveBeenCalledWith(5 * TICK_MS);
  });

  it('marks which phase the playhead is in', () => {
    renderTimeline();

    const current = screen.getByRole('button', { name: /Phase 2/ });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /Phase 1/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('is reachable by keyboard: every marker is a tab stop', async () => {
    const user = userEvent.setup();
    const { onSeek } = renderTimeline();

    await user.tab();
    expect(screen.getByRole('button', { name: /Phase 1/ })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('reads a step run as "step n of m"', () => {
    renderTimeline({
      durationMs: 23 * STEP_MS,
      virtualTime: 6 * STEP_MS,
      unit: 'step',
      phases: [],
    });

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'step 7 of 23');
    expect(screen.getByText('step 7 / 23')).toBeInTheDocument();
    expect(screen.getByText('23 steps')).toBeInTheDocument();
  });

  it('snaps the playhead to the current tick under reduced motion', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;

    renderTimeline({ virtualTime: 3.6 * TICK_MS });
    window.matchMedia = original;

    expect(screen.getByRole('slider')).toHaveValue(String(3 * TICK_MS));
  });

  it('disables itself rather than pretending an empty run can be scrubbed', () => {
    renderTimeline({ durationMs: 0, virtualTime: 0, phases: [] });
    expect(screen.getByRole('slider')).toBeDisabled();
  });
});
