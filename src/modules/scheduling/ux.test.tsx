import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { renderLinked } from '@/components/testing/linked';
import { SCHED_SHARE_STATE } from '@/core/sched/state';
import { runMetrics } from '@/core/sched/metrics';
import { presetById, SCHED_PRESETS } from '@/core/sched/presets';
import { SCHED_RULES } from '@/core/sched/rules';
import { schedule } from '@/core/sched/schedule';
import type { Policy, Workload } from '@/core/sched/workload';
import { validatePolicy } from '@/core/sched/workload.schema';

import { finalSegments, snapshotAt } from './adapters';
import {
  bracketsFor,
  preemptionMarks,
  quantumUse,
  resultSentence,
  ruleAt,
  tryNextFor,
  waitingReasons,
} from './explain';
import { HUMAN, humanMessage } from './messages';
import { MODULE_SHORTCUTS, isZoomKey } from './shortcuts';
import { mlfqRulesNote, SchedulingView } from './SchedulingView';
import { WorkloadEditor } from './WorkloadEditor';

/*
 * U3.1: the beginner fixes of docs/UIUX.md §2.3 (S1-S8) and G10, G11, G14, G16.
 */

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

const SJF = presetById('osc-sjf')!;

function w(processes: [number, number[], number?][], contextSwitch = 0): Workload {
  return {
    processes: processes.map(([arrival, bursts, priority = 0], i) => ({
      pid: `P${i + 1}`,
      arrival,
      bursts,
      priority,
    })),
    contextSwitch,
  };
}

describe('rules text (G4)', () => {
  it('every rule has a plain sentence and why it matters', () => {
    for (const rule of SCHED_RULES) {
      expect(rule.plain, rule.id).toBeTruthy();
      expect(rule.whyItMatters, rule.id).toBeTruthy();
    }
  });
});

describe('ruleAt: the rule that decided a tick (G5, S2, S7)', () => {
  it('names the PID tie-break when two equal bursts compete', () => {
    const workload = w([
      [0, [3]],
      [0, [3]],
    ]);
    const policy: Policy = { kind: 'sjf' };
    expect(ruleAt(schedule(workload, policy), 0, policy)).toBe('sched.tie.pid');
  });

  it('names the priority direction when priority decides', () => {
    const preset = presetById('osc-priority')!;
    const run = schedule(preset.workload, preset.policy);
    expect(ruleAt(run, 0, preset.policy)).toBe('sched.priority.lower');
  });

  it('names the quantum rule when an expiry meets a same-tick arrival', () => {
    const workload = w([
      [0, [4]],
      [2, [2]],
    ]);
    const policy: Policy = { kind: 'rr', quantum: 2 };
    expect(ruleAt(schedule(workload, policy), 2, policy)).toBe('sched.order.quantum');
  });

  it('names the context-switch cost on a switching dispatch', () => {
    const workload = w(
      [
        [0, [1]],
        [0, [1]],
      ],
      2,
    );
    const policy: Policy = { kind: 'fcfs' };
    const run = schedule(workload, policy);
    expect(ruleAt(run, 1, policy)).toBe('sched.cs.cost');
  });

  it('names rule 5 on a boost and rule 4 on a demotion', () => {
    const preset = presetById('mlfq-boost')!;
    const run = schedule(preset.workload, preset.policy);
    const boost = run.events.find((e) => e.kind === 'sched.boost')!;
    expect(ruleAt(run, boost.tick, preset.policy)).toBe('sched.mlfq.boost');

    const fixed = presetById('mlfq-gaming-new')!;
    const fixedRun = schedule(fixed.workload, fixed.policy);
    const demote = fixedRun.events.find((e) => e.kind === 'sched.demote')!;
    const atDemote = ruleAt(fixedRun, demote.tick, fixed.policy);
    expect(['sched.mlfq.allotment', 'sched.mlfq.boost']).toContain(atDemote);
  });

  it('returns only rules the policy shows', () => {
    for (const preset of SCHED_PRESETS) {
      const run = schedule(preset.workload, preset.policy);
      const shown = new Set(
        SCHED_RULES.filter(
          (r) => !r.policies || r.policies.includes(preset.policy.kind),
        ).map((r) => r.id),
      );
      for (let t = 0; t <= Math.min(40, run.durationMs / 1000); t += 1) {
        const id = ruleAt(run, t, preset.policy);
        if (id) expect(shown.has(id), `${preset.id} t=${t}: ${id}`).toBe(true);
      }
    }
  });
});

describe('waitingReasons (S8)', () => {
  it('explains the next two in line on a dispatch step', () => {
    const run = schedule(SJF.workload, SJF.policy);
    expect(waitingReasons(run, 0, SJF.policy, SJF.workload)).toEqual([
      { pid: 'P1', text: 'P1 (arrived t = 0): longer next burst, 6 vs 3' },
      { pid: 'P3', text: 'P3 (arrived t = 0): longer next burst, 7 vs 3' },
    ]);
    // A tick with no dispatch explains nobody.
    expect(waitingReasons(run, 1, SJF.policy, SJF.workload)).toEqual([]);
  });

  it('says when a tie went to the lower PID', () => {
    const workload = w([
      [0, [3]],
      [0, [3]],
    ]);
    const policy: Policy = { kind: 'sjf' };
    const [reason] = waitingReasons(schedule(workload, policy), 0, policy, workload);
    expect(reason!.text).toContain('the lower PID goes first');
  });
});

describe('bracketsFor (S3)', () => {
  it('shades exactly the waiting time, and brackets response and turnaround, on every preset', () => {
    for (const preset of SCHED_PRESETS) {
      const run = schedule(preset.workload, preset.policy);
      const metrics = runMetrics(preset.workload, run);
      const segments = finalSegments(run);
      for (const p of metrics.processes) {
        const b = bracketsFor(preset.workload, segments, p.pid)!;
        expect(b.completion, `${preset.id} ${p.pid}`).toBe(p.completion);
        if (p.response !== null) expect(b.firstRun! - b.arrival).toBe(p.response);
        if (p.waiting !== null) {
          const shaded = b.waiting.reduce((n, g) => n + g.end - g.start, 0);
          expect(shaded, `${preset.id} ${p.pid}`).toBe(p.waiting);
        }
      }
    }
  });
});

describe('quantumUse and marks', () => {
  it('counts the ticks of the quantum used since the last dispatch', () => {
    const preset = presetById('osc-rr')!;
    const run = schedule(preset.workload, preset.policy);
    expect(quantumUse(run, 0, preset.policy, snapshotAt(run, 0))).toEqual({
      pid: 'P1',
      used: 0,
      quantum: 4,
    });
    expect(quantumUse(run, 3, preset.policy, snapshotAt(run, 3))).toEqual({
      pid: 'P1',
      used: 3,
      quantum: 4,
    });
    expect(quantumUse(run, 0, SJF.policy, snapshotAt(run, 0))).toBeNull();
  });

  it('marks every quantum expiry and preemption', () => {
    const preset = presetById('osc-rr')!;
    const run = schedule(preset.workload, preset.policy);
    const marks = preemptionMarks(run, false);
    expect(marks[0]).toEqual({ tick: 4, label: 'P1’s quantum expired at t = 4' });
  });
});

describe('end of run (G16)', () => {
  const kinds: Policy[] = [
    { kind: 'fcfs' },
    { kind: 'sjf' },
    { kind: 'srtf' },
    { kind: 'rr', quantum: 2 },
    { kind: 'rr', quantum: 4 },
    { kind: 'priority', preemptive: false },
    { kind: 'priority', preemptive: false, aging: { every: 2, by: 1 } },
    presetById('mlfq-gaming-old')!.policy,
    presetById('mlfq-gaming-new')!.policy,
    presetById('mlfq-boost')!.policy,
  ];
  it('always suggests a valid, different policy', () => {
    for (const policy of kinds) {
      const next = tryNextFor(policy);
      expect(validatePolicy(next.policy).ok).toBe(true);
      expect(next.policy).not.toEqual(policy);
      expect(next.label).toBeTruthy();
    }
  });

  it('states the result in one sentence', () => {
    const run = schedule(SJF.workload, SJF.policy);
    expect(
      resultSentence(SJF.policy, runMetrics(SJF.workload, run), finalSegments(run)),
    ).toBe('SJF: average waiting 7 ticks, average turnaround 13 ticks; P4 ran first.');
  });

  it('names OSTEP’s rules for an MLFQ setup (S7)', () => {
    expect(mlfqRulesNote(presetById('mlfq-gaming-old')!.policy)).toContain('rule 4a/4b');
    expect(mlfqRulesNote({ kind: 'fcfs' } as Policy)).toBeNull();
  });
});

describe('plain-words validation (G11)', () => {
  it('maps each schema message to a sentence a student can act on', () => {
    expect(humanMessage({ path: ['processes', 0, 'priority'], message: 'x' })).toBe(
      HUMAN.priority,
    );
    expect(
      humanMessage({
        path: ['processes', 0, 'bursts'],
        message: 'Bursts alternate CPU and I/O and must start and end with CPU',
      }),
    ).toBe(HUMAN.endsWithCpu);
    expect(humanMessage({ path: ['processes', 0, 'bursts', 1], message: 'x' })).toBe(
      HUMAN.burst,
    );
    expect(humanMessage({ path: ['contextSwitch'], message: 'x' })).toBe(
      HUMAN.contextSwitch,
    );
    expect(HUMAN.priority).toBe('Priority is 0–9; 0 is the highest.');
  });
});

describe('shortcuts', () => {
  it('binds Z, and only without Ctrl, Cmd or Alt', () => {
    expect(MODULE_SHORTCUTS.map((s) => s.chords)).toEqual([[['Z']]]);
    expect(isZoomKey({ key: 'z' })).toBe(true);
    expect(isZoomKey({ key: 'z', ctrlKey: true })).toBe(false);
  });
});

describe('burst builder (S1)', () => {
  it('adds an I/O and a CPU burst with buttons, and edits a block', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkloadEditor workload={SJF.workload} onChange={onChange} burstBuilder />);

    const blocks = screen.getByRole('list', { name: 'P1 bursts, in order' });
    expect(within(blocks).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Add a CPU burst to P1' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Add an I/O burst to P1' }));
    expect(screen.getByText(HUMAN.endsWithCpu)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a CPU burst to P1' }));
    expect(onChange.mock.lastCall![0].processes[0].bursts).toEqual([6, 2, 3]);

    const io = screen.getByLabelText('P1 I/O burst 1 (ticks)');
    await user.clear(io);
    await user.type(io, '5');
    expect(onChange.mock.lastCall![0].processes[0].bursts).toEqual([6, 5, 3]);
    expect(within(blocks).getAllByRole('listitem')[1]).toHaveAttribute(
      'data-burst',
      'io',
    );

    await user.click(screen.getByRole('button', { name: 'Remove P1’s last burst' }));
    expect(screen.getByText(HUMAN.endsWithCpu)).toBeInTheDocument();
  });

  it('puts the context-switch cost under More options (G10) and is axe clean', async () => {
    const { container } = render(
      <WorkloadEditor
        workload={SJF.workload}
        onChange={() => {}}
        burstBuilder
        disclose
      />,
    );
    const more = screen.getByText('More options').closest('details')!;
    expect(more).not.toHaveAttribute('open');
    expect(within(more).getByLabelText(/Context-switch cost/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('SchedulingView, U3.1', { timeout: 60_000 }, () => {
  it('links a process across editor, Gantt, queues and metrics, and brackets it (S3, S4)', async () => {
    const user = userEvent.setup();
    const { container } = render(<SchedulingView />);
    // The editor is folded in Guided and loads on first open.
    await user.click(
      screen.getByRole('button', { name: 'Edit the policy and workload' }),
    );
    await screen.findByRole('combobox', { name: 'Policy' });
    await act(async () => {
      await user.keyboard('{End}');
    });

    const table = screen.getByRole('table', { name: /Per process/ });
    const row = within(table).getByRole('row', { name: /^P2/ });
    await user.hover(row);

    expect(container.querySelector('[data-brackets="2"]')).not.toBeNull();
    expect(container.querySelector('[data-bracket="response"]')).toHaveTextContent(
      'response 16',
    );
    expect(container.querySelector('[data-bracket="turnaround"]')).toHaveTextContent(
      'turnaround 24',
    );
    expect(container.querySelectorAll('[data-waiting]').length).toBeGreaterThan(0);
    expect(container.querySelector('g[data-pid="2"][data-highlight]')).not.toBeNull();
    expect(
      container.querySelector('fieldset[data-pid="P2"][data-highlight]'),
    ).not.toBeNull();
    expect(container.querySelector('span[data-pid="2"][data-highlight]')).not.toBeNull();
    expect(row).toHaveAttribute('data-highlight');

    await user.unhover(row);
    expect(container.querySelector('[data-brackets]')).toBeNull();

    // The keyboard does what hovering does.
    act(() => row.focus());
    expect(container.querySelector('[data-brackets="2"]')).not.toBeNull();
  });

  it('shows the rule used, who waited, and the zoom key (G5, S8, S6)', async () => {
    const user = userEvent.setup();
    const { container } = render(<SchedulingView />);

    // t = 0 of SJF: P4 is dispatched; P1 and P3 wait, each with why.
    expect(screen.getByTestId('waiting-reasons')).toHaveTextContent(
      'P1 (arrived t = 0): longer next burst, 6 vs 3',
    );
    expect(container.querySelector('[data-rule-chip="sched.sjf.next"]')).not.toBeNull();

    const svg = () => container.querySelector('svg[data-zoom]')!;
    expect(svg()).toHaveAttribute('data-zoom', 'fit');
    await act(async () => {
      await user.keyboard('z');
    });
    expect(svg()).toHaveAttribute('data-zoom', '16');
    expect(
      screen.getByRole('button', { name: /Zoom in: 1 tick = 16 px/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('folds the editor behind Edit (G10) and offers a contrasting next run (G16)', async () => {
    const user = userEvent.setup();
    renderLinked(<SchedulingView />, SCHED_SHARE_STATE);

    const edit = screen.getByRole('button', { name: 'Edit the policy and workload' });
    // Folded in Guided, where the lesson chooses the input.
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: 'Policy' })).toBeNull();
    await user.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('combobox', { name: 'Policy' })).toBeInTheDocument();
    await user.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: 'Policy' })).toBeNull();

    // The end-of-run card offers SRTF on the same workload, and loads it.
    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByText(/SJF: average waiting 7 ticks/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /SRTF on the same workload/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'SRTF' })).toBeInTheDocument();
  });

  it('marks each metric with its direction and a definition (G14)', () => {
    render(<SchedulingView />);
    const table = screen.getByRole('table', { name: /Per process/ });
    const headers = within(table).getAllByRole('columnheader');
    const waiting = headers.find((h) => h.textContent?.startsWith('Waiting'))!;
    expect(waiting).toHaveTextContent('lower is better');
    expect(within(waiting).getByRole('button', { name: 'Waiting' })).toBeInTheDocument();
    expect(screen.getByTestId('utilisation').closest('div')).toHaveTextContent(
      'higher is better',
    );
  });
});
