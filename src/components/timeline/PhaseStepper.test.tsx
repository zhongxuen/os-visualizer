import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { STEP_MS, TICK_MS } from '@/core/events/builder';

import { PhaseStepper } from './PhaseStepper';
import { buildTickRun } from './testing';

/*
 * Adapted from Internet Visualizer's PhaseStepper.test.tsx (see VENDORED.md): one voice
 * instead of Simple / Full detail, "Phase" instead of "Step", lengths in ticks or steps.
 */

const RUN = buildTickRun();

describe('PhaseStepper', () => {
  it('lists the phases in order, numbered, with title and description', () => {
    render(
      <PhaseStepper phases={RUN.phases} currentIndex={1} onSeek={vi.fn()} unit="tick" />,
    );

    const phases = screen.getAllByRole('listitem');
    expect(phases).toHaveLength(3);
    expect(phases[0]).toHaveTextContent(/^Phase 1/);
    expect(phases[0]).toHaveTextContent('P1 arrives');
    expect(phases[1]).toHaveTextContent('P2 arrives with a shorter burst');
    expect(phases[2]).toHaveTextContent(/^Phase 3/);
  });

  it('marks the current phase with an icon and the word "Now", not by colour alone', () => {
    render(
      <PhaseStepper phases={RUN.phases} currentIndex={1} onSeek={vi.fn()} unit="tick" />,
    );

    const current = screen.getByRole('button', { name: /P2 preempts P1/ });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).toHaveTextContent('Now');
    expect(current.querySelector('svg')).not.toBeNull();

    expect(screen.getByRole('button', { name: /P1 arrives/ })).toHaveTextContent(
      'Finished',
    );
    expect(screen.getByRole('button', { name: /P1 finishes/ })).toHaveTextContent(
      'Not reached yet',
    );
  });

  it('seeks to the start of a phase from its button, or anywhere on its row', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    render(
      <PhaseStepper phases={RUN.phases} currentIndex={0} onSeek={onSeek} unit="tick" />,
    );

    await user.click(screen.getByRole('button', { name: /P1 finishes/ }));
    expect(onSeek).toHaveBeenLastCalledWith(5 * TICK_MS);

    await user.click(screen.getByText('P2 preempts P1'));
    expect(onSeek).toHaveBeenLastCalledWith(2 * TICK_MS);
    expect(onSeek).toHaveBeenCalledTimes(2);
  });

  it('prints how long each phase lasts, in the run unit', () => {
    const { unmount } = render(
      <PhaseStepper phases={RUN.phases} currentIndex={0} onSeek={vi.fn()} unit="tick" />,
    );
    const phases = screen.getAllByRole('listitem');
    expect(phases[0]).toHaveTextContent('2 ticks');
    expect(phases[2]).toHaveTextContent('1 tick');
    unmount();

    const stepPhases = [{ ...RUN.phases[0]!, startMs: 0, endMs: 3 * STEP_MS }];
    render(
      <PhaseStepper phases={stepPhases} currentIndex={0} onSeek={vi.fn()} unit="step" />,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('3 steps');
  });

  it('says so plainly when a run has no phases', () => {
    render(<PhaseStepper phases={[]} currentIndex={-1} onSeek={vi.fn()} unit="step" />);

    expect(screen.getByText(/one continuous sequence/)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
