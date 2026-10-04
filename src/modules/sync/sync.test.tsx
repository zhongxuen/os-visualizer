import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { explore } from '@/core/sync/explore';
import { interleave } from '@/core/sync/interleave';
import { presetById } from '@/core/sync/presets';

import {
  explorationSummary,
  histogramRows,
  picksUpTo,
  snapshotAt,
  threadStatusText,
} from './adapters';
import { SyncView } from './SyncView';

const RACE = presetById('counter-race')!;
const MUTEX = presetById('counter-mutex')!;

// Each view reads and writes `?s=`; start every test from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('adapters', () => {
  it('summarises every interleaving of the counter race', () => {
    const exploration = explore(RACE.program);
    expect(explorationSummary(exploration)).toBe(
      '20 interleavings: 2 give counter = 2; 18 give counter = 1.',
    );
    expect(histogramRows(exploration).map((r) => [r.verdict, r.count])).toEqual([
      ['correct', 2],
      ['wrong', 18],
    ]);
  });

  it('names what a waiting thread waits for, in words', () => {
    const run = interleave(MUTEX.program, MUTEX.schedule);
    // T0 holds m after tick 1, so T1's lock can't succeed.
    const at2 = snapshotAt(run, 2)!;
    expect(threadStatusText(at2, 1)).toBe('Can’t take m: held by T0');
    expect(threadStatusText(at2, 0)).toBe('Ready');
    const end = run.events.at(-1)!.state;
    expect(threadStatusText(end, 0)).toBe('Finished');

    const prodcons = presetById('prodcons-1')!;
    const pc = interleave(prodcons.program, prodcons.schedule);
    const asleep = pc.events.find((e) => e.kind === 'sync.block')!;
    expect(threadStatusText(asleep.state, asleep.thread!)).toBe('Asleep on full');
  });

  it('takes the picks of a run up to a tick, spins left out', () => {
    const run = interleave(MUTEX.program, MUTEX.schedule);
    // Ticks 1-6: T0 lock, T0 load, T1 spin, T1 spin, T0 add, T0 store.
    expect(picksUpTo(run, 6)).toEqual([0, 0, 0, 0]);
  });
});

describe('SyncView', () => {
  it('replays the lost update and shows every interleaving', async () => {
    render(<SyncView />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Synchronisation' }),
    ).toBeVisible();
    expect(screen.getByTestId('outcome-summary')).toHaveTextContent(
      '20 interleavings: 2 give counter = 2; 18 give counter = 1.',
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'End' });
    });
    expect(screen.getByTestId('var-counter')).toHaveTextContent('1');
    expect(screen.getByTestId('run-verdict')).toHaveTextContent(/1 update was lost/);
    expect(screen.getByTestId('trace')).toHaveTextContent('T0 T0 T1 T1 T1 T0');
  });

  it('picks threads by hand with keys 1 and 2, then loads a correct interleaving', () => {
    render(<SyncView />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear picks' }));
    for (const key of ['1', '1', '1', '2', '2', '2']) {
      act(() => {
        fireEvent.keyDown(window, { key });
      });
    }
    expect(screen.getByTestId('trace')).toHaveTextContent('T0 T0 T0 T1 T1 T1');
    expect(screen.getByTestId('var-counter')).toHaveTextContent('2');
    expect(screen.getByTestId('run-verdict')).toHaveTextContent(/as expected/);

    // A finished run takes no more picks.
    act(() => {
      fireEvent.keyDown(window, { key: '1' });
    });
    expect(screen.getByText('The run has ended.')).toBeInTheDocument();

    const outcomes = screen.getByRole('list', { name: 'Outcomes' });
    fireEvent.click(
      within(outcomes).getByRole('button', { name: /Load one: counter = 1/ }),
    );
    expect(screen.getByTestId('var-counter')).toHaveTextContent('1');
  });

  it('disables a thread that can’t make progress, and says why', () => {
    render(<SyncView />);
    fireEvent.change(screen.getByLabelText('Preset'), {
      target: { value: 'prodcons-broken' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load preset' }));
    act(() => {
      fireEvent.keyDown(window, { key: 'End' });
    });
    expect(screen.getByRole('button', { name: 'Run T0 next op' })).toBeDisabled();
    expect(screen.getByTestId('thread-status-0')).toHaveTextContent(
      'Can’t take m: held by T1',
    );
    expect(screen.getByTestId('thread-status-1')).toHaveTextContent('Asleep on full');
    expect(screen.getByTestId('run-verdict')).toHaveTextContent(/a deadlock/);
  });

  it('switches to round robin and back to manual from the tick on screen', () => {
    render(<SyncView />);
    fireEvent.click(screen.getByRole('radio', { name: 'Round robin' }));
    expect(screen.getByLabelText('Quantum (ticks)')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Pick by hand from this tick' }));
    expect(screen.getByRole('radio', { name: 'Manual' })).toBeChecked();
  });

  it('is axe clean', async () => {
    const { container } = render(<SyncView />);
    await expectNoAxeViolations(container);
  });
});
