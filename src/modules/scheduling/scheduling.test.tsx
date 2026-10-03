import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { presetById } from '@/core/sched/presets';
import { schedule } from '@/core/sched/schedule';
import type { Policy, Workload } from '@/core/sched/workload';

import {
  eventsAt,
  ganttLanes,
  primaryEvent,
  queueLabel,
  queueState,
  snapshotAt,
  toGanttSegments,
} from './adapters';
import { PolicyPicker } from './PolicyPicker';
import { SchedulingView } from './SchedulingView';
import { parseBursts, WorkloadEditor } from './WorkloadEditor';

const SJF = presetById('osc-sjf')!;

// Each view reads and writes `?s=`; start every test from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('adapters', () => {
  it('turns core segments into Gantt segments with numeric PIDs and lanes', () => {
    expect(
      toGanttSegments([
        { pid: 'P2', start: 0, end: 2, level: 1 },
        { pid: 'cs', start: 2, end: 3 },
        { pid: 'idle', start: 3, end: 4 },
      ]),
    ).toEqual([
      { start: 0, end: 2, kind: 'run', pid: 2, lane: 1 },
      { start: 2, end: 3, kind: 'cs' },
      { start: 3, end: 4, kind: 'idle' },
    ]);
  });

  it('gives MLFQ one lane per queue and other policies none', () => {
    const mlfq = presetById('mlfq-boost')!.policy;
    expect(ganttLanes(mlfq)?.map((l) => l.label)).toEqual([
      'Q0 (q = 2)',
      'Q1 (q = 2)',
      'Q2 (q = 2)',
    ]);
    expect(ganttLanes({ kind: 'fcfs' })).toBeUndefined();
    expect(queueLabel(mlfq, 0)).toBe('Q0 (top, q = 2)');
    expect(queueLabel({ kind: 'sjf' }, 0)).toBe('Ready queue');
  });

  it('leads with the decision of the tick and reads the state at a tick', () => {
    const run = schedule(SJF.workload, SJF.policy);
    const atZero = eventsAt(run, 0);
    expect(primaryEvent(atZero)?.kind).toBe('sched.dispatch');
    expect(primaryEvent(atZero)?.label).toBe('P4 runs: shortest next burst (3)');
    expect(primaryEvent(eventsAt(run, 1))?.kind).toBe('sched.run');

    const state = queueState(snapshotAt(run, 0), SJF.policy, SJF.workload);
    expect(state.running?.pid).toBe(4);
    expect(state.queues[0]!.items.map((i) => i.pid)).toEqual([1, 2, 3]);
    expect(state.waiting).toBeUndefined();
  });

  it('shows a context switch as the process switching in', () => {
    const w: Workload = {
      processes: [
        { pid: 'P1', arrival: 0, bursts: [1], priority: 0 },
        { pid: 'P2', arrival: 0, bursts: [1], priority: 0 },
      ],
      contextSwitch: 2,
    };
    const run = schedule(w, { kind: 'fcfs' });
    const state = queueState(snapshotAt(run, 1), { kind: 'fcfs' }, w);
    expect(state.running).toEqual({
      pid: 2,
      detail: 'switching in: context switch, 1 tick left',
    });
  });
});

function EditorHarness({ onChange }: { onChange: (w: Workload) => void }) {
  return <WorkloadEditor workload={SJF.workload} onChange={onChange} />;
}

describe('WorkloadEditor', () => {
  it('parses bursts with commas or spaces', () => {
    expect(parseBursts('3, 2 4')).toEqual([3, 2, 4]);
  });

  it('reports a valid edit and shows the schema message for an invalid one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditorHarness onChange={onChange} />);

    const bursts = screen.getByLabelText('P1 bursts');
    await user.clear(bursts);
    await user.type(bursts, '3, 2');
    expect(screen.getByText(/must start and end with CPU/)).toBeInTheDocument();
    expect(bursts).toHaveAttribute('aria-invalid', 'true');

    await user.type(bursts, ', 4');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        processes: expect.arrayContaining([
          expect.objectContaining({ pid: 'P1', bursts: [3, 2, 4] }),
        ]),
      }),
    );
    expect(bursts).not.toHaveAttribute('aria-invalid');
  });

  it('adds and removes processes from the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditorHarness onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Add process' }));
    expect(screen.getByLabelText('P5 arrival')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Remove P2' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByLabelText('P2 arrival')).not.toBeInTheDocument();
    expect(
      onChange.mock.lastCall![0].processes.map((p: { pid: string }) => p.pid),
    ).toEqual(['P1', 'P3', 'P4', 'P5']);
  });

  it('is axe clean', async () => {
    const { container } = render(<EditorHarness onChange={() => {}} />);
    await expectNoAxeViolations(container);
  });
});

function PickerHarness({ initial }: { initial: Policy }) {
  const [policy, setPolicy] = useState<Policy>(initial);
  return (
    <>
      <PolicyPicker policy={policy} onChange={setPolicy} />
      <output data-testid="policy">{JSON.stringify(policy)}</output>
    </>
  );
}

describe('PolicyPicker', () => {
  it('shows the controls for the chosen policy', async () => {
    const user = userEvent.setup();
    render(<PickerHarness initial={{ kind: 'fcfs' }} />);

    await user.selectOptions(screen.getByLabelText('Policy'), 'rr');
    const quantum = screen.getByLabelText('Quantum (ticks)');
    await user.clear(quantum);
    await user.type(quantum, '4');
    expect(JSON.parse(screen.getByTestId('policy').textContent!)).toEqual({
      kind: 'rr',
      quantum: 4,
    });

    await user.selectOptions(screen.getByLabelText('Policy'), 'priority');
    await user.click(screen.getByLabelText('Aging'));
    expect(screen.getByLabelText('Every (ticks waited)')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Policy'), 'mlfq');
    expect(screen.getByLabelText('Q2 allotment')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Priority boost'));
    await user.click(screen.getByLabelText(/Old rules 4a\/4b/));
    expect(JSON.parse(screen.getByTestId('policy').textContent!)).toMatchObject({
      kind: 'mlfq',
      boostEvery: 20,
      rule4: 'original',
    });
  });

  it('is axe clean with MLFQ controls', async () => {
    const { container } = render(
      <PickerHarness initial={presetById('mlfq-boost')!.policy} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('SchedulingView', { timeout: 30_000 }, () => {
  it('opens on the SJF example and steps to the end from the keyboard: average waiting 7', async () => {
    const user = userEvent.setup();
    render(<SchedulingView />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'CPU Scheduling' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('avg-waiting')).toHaveTextContent('0');
    expect(screen.getByRole('heading', { name: 'At t = 0' })).toBeInTheDocument();

    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('avg-waiting')).toHaveTextContent(/^7$/);
    expect(screen.getByRole('heading', { name: 'At t = 24' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /Per process/ });
    expect(within(table).getByRole('row', { name: /^P2/ })).toHaveTextContent('16');
  });

  it('loads a preset', async () => {
    const user = userEvent.setup();
    render(<SchedulingView />);
    await user.selectOptions(screen.getByLabelText('Preset'), 'mlfq-boost');
    await user.click(screen.getByRole('button', { name: 'Load preset' }));
    expect(
      screen.getByRole('heading', { level: 2, name: /^MLFQ 3 queues/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loaded preset: MLFQ priority boost')).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: 'Gantt chart, MLFQ 3 queues, boost 5, old rule 4',
      }),
    ).toBeInTheDocument();
  });
});
