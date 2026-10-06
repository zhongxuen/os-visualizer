import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { explore } from '@/core/sync/explore';
import { interleave } from '@/core/sync/interleave';
import { presetById } from '@/core/sync/presets';
import { SYNC_RULES } from '@/core/sync/rules';

import {
  explorationSummary,
  histogramRows,
  lostUpdatesAt,
  picksUpTo,
  ruleForEvent,
  snapshotAt,
  threadStatusText,
  TRY_NEXT,
} from './adapters';
import { FIELD_MESSAGES } from './ScheduleBar';
import { MODULE_SHORTCUTS, threadForKey, threadKey } from './shortcuts';
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

describe('lost updates, rules and keys', () => {
  it('finds the lost update of the counter race, and keeps it until the next store', () => {
    const run = interleave(RACE.program, RACE.schedule);
    // Picks T0 T0 T1 T1 T1 T0: T1 stores 1 at tick 5, T0 its stale 1 at tick 6.
    expect(lostUpdatesAt(RACE.program, run, 5)).toEqual({});
    expect(lostUpdatesAt(RACE.program, run, 6)).toEqual({
      counter: { var: 'counter', lost: 1, value: 1, by: 0, victim: 1, tick: 6 },
    });
    const safe = interleave(MUTEX.program, MUTEX.schedule);
    expect(lostUpdatesAt(MUTEX.program, safe, 1000)).toEqual({});
  });

  it('names a rule only for steps a rule decided, and only real rules', () => {
    const ids = new Set(SYNC_RULES.map((r) => r.id));
    const race = interleave(RACE.program, RACE.schedule);
    expect(ruleForEvent(race.events.find((e) => e.kind === 'sync.store' && e.lost))).toBe(
      'sync.lost',
    );
    expect(ruleForEvent(race.events.find((e) => e.kind === 'sync.load'))).toBeNull();
    const mutex = interleave(MUTEX.program, MUTEX.schedule);
    expect(ruleForEvent(mutex.events.find((e) => e.kind === 'sync.spin'))).toBe(
      'sync.tas',
    );
    for (const e of [...race.events, ...mutex.events]) {
      const id = ruleForEvent(e);
      if (id) expect(ids).toContain(id);
    }
  });

  it('gives every rule a plain sentence and why it matters (G4)', () => {
    for (const rule of SYNC_RULES) {
      expect(rule.plain, rule.id).toBeTruthy();
      expect(rule.whyItMatters, rule.id).toBeTruthy();
    }
  });

  it('suggests a different, real preset after every preset (G16)', () => {
    for (const [from, next] of Object.entries(TRY_NEXT)) {
      expect(presetById(from), from).toBeDefined();
      expect(presetById(next.preset), next.preset).toBeDefined();
      expect(next.preset).not.toBe(from);
    }
  });

  it('maps the thread keys A, B, C to T0, T1, T2 in either case (Y1)', () => {
    expect([0, 1, 2].map(threadKey)).toEqual(['A', 'B', 'C']);
    expect(threadForKey('a')).toBe(0);
    expect(threadForKey('B')).toBe(1);
    expect(threadForKey('c')).toBe(2);
    expect(threadForKey('1')).toBeNull();
    expect(MODULE_SHORTCUTS[0]!.chords).toEqual([['A'], ['B'], ['C']]);
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

  it('picks threads by hand with keys A and B, then loads an interleaving', () => {
    render(<SyncView />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear picks' }));
    for (const key of ['a', 'A', 'a', 'b', 'B', 'b']) {
      act(() => {
        fireEvent.keyDown(window, { key });
      });
    }
    expect(screen.getByTestId('trace')).toHaveTextContent('T0 T0 T0 T1 T1 T1');
    expect(screen.getByTestId('var-counter')).toHaveTextContent('2');
    expect(screen.getByTestId('run-verdict')).toHaveTextContent(/as expected/);

    // A finished run takes no more picks.
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    expect(screen.getByText('The run has ended.')).toBeInTheDocument();

    // Loading an outcome plays it from the start: the schedule fills in from nothing.
    const outcomes = screen.getByRole('list', { name: 'Outcomes' });
    fireEvent.click(
      within(outcomes).getByRole('button', { name: /Load one: counter = 1/ }),
    );
    expect(screen.getByTestId('trace')).toHaveTextContent('nothing yet');
    act(() => {
      fireEvent.keyDown(window, { key: 'End' });
    });
    expect(screen.getByTestId('var-counter')).toHaveTextContent('1');
  });

  it('leaves 1 to 5 to the speed control under a manual schedule (B6)', () => {
    render(<SyncView />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear picks' }));
    for (const key of ['1', '2', '3']) {
      act(() => {
        fireEvent.keyDown(window, { key });
      });
    }
    expect(screen.getByTestId('trace')).toHaveTextContent('nothing yet');
    expect(screen.getByRole('button', { name: 'Run T0 next op' })).toHaveAttribute(
      'aria-keyshortcuts',
      'A',
    );
  });

  it('strikes through the overwritten value of a lost update (Y2)', () => {
    const { container } = render(<SyncView />);
    act(() => {
      fireEvent.keyDown(window, { key: 'End' });
    });
    const mark = screen.getByTestId('lost-counter');
    expect(mark).toHaveTextContent('lost update');
    expect(mark).toHaveTextContent('T1’s store of 1 was overwritten by T0’s stale 1');
    expect(mark.querySelector('del')).toHaveAttribute('data-lost-value', '1');
    expect(container.querySelector('tr[data-lost]')).not.toBeNull();
    // The step that lost it names the rule that says so.
    expect(screen.getByRole('link', { name: /Rule used:/ })).toHaveAttribute(
      'href',
      '#rule-sync-lost',
    );
    // One tick back, T0 has not stored yet: nothing is struck through.
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(screen.queryByTestId('lost-counter')).toBeNull();
  });

  it('keeps the scheduler choice behind "Change who picks", with human messages (G10, G11)', () => {
    const { container } = render(<SyncView />);
    const edit = container.querySelector<HTMLDetailsElement>('[data-schedule-edit]')!;
    expect(edit.open).toBe(false);
    fireEvent.click(screen.getByText('Change who picks'));
    fireEvent.click(screen.getByRole('radio', { name: 'Round robin' }));
    const quantum = screen.getByLabelText('Quantum (ticks)');
    fireEvent.change(quantum, { target: { value: '99' } });
    expect(quantum).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(FIELD_MESSAGES.quantum)).toBeInTheDocument();
    expect(screen.getByTestId('schedule-kind')).toHaveTextContent('Round robin');
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
    fireEvent.click(screen.getByText('Change who picks'));
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
