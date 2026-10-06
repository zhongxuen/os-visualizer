import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MatrixTable } from '@/components/blocks/MatrixTable';
import { reduceMotion, stepFrom } from '@/components/motion/testing';
import { expectNoAxeViolations } from '@/components/testing/axe';
import { runRequest, runSafety } from '@/core/deadlock/bankers';
import type { DlEvent } from '@/core/deadlock/events';
import {
  GRAPH_PRESETS,
  graphPresetById,
  OSC10_BANKERS,
  OSC10_BANKERS_AFTER_T1,
} from '@/core/deadlock/presets';
import { runGraph } from '@/core/deadlock/recover';
import { DL_RULES } from '@/core/deadlock/rules';
import { STEP_MS } from '@/core/events/builder';

import {
  endOfRunText,
  finalResult,
  isPretending,
  releasedAt,
  requestChecklist,
  ruleIdFor,
  tryNextFor,
} from './adapters';
import { BankersEditor, BankersStep } from './BankersView';
import { CompareStrip } from './CompareStrip';
import { DeadlockView } from './DeadlockView';
import { cycleEdgeIds, dfsEdgeIds } from './GraphCanvas';
import GraphCanvas from './GraphCanvas';
import { ResultBanner, WorkFinish } from './StepState';
import { ThreadChip } from './ThreadChip';
import { TOUCH_QUERY } from './touch';
import { WorkBar } from './WorkBar';

/** UIUX U3.5: D1-D5, G10, G11, G13, G16 and the §7.2.5 motion. */

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

const twoLocks = () => graphPresetById('two-locks')!.graph;

/** Make `query` match in `matchMedia`. Returns the undo. */
function matchQuery(query: string): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({
    ...original(q),
    matches: q === query,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe('rules (G4)', () => {
  it('every deadlock rule has a plain sentence and why it matters', () => {
    for (const rule of DL_RULES) {
      expect(rule.plain, rule.id).toMatch(/\S/);
      expect(rule.whyItMatters, rule.id).toMatch(/\S/);
    }
  });

  it('names the rule that decided each kind of step (G5)', () => {
    const at = (run: { events: readonly DlEvent[] }, kind: DlEvent['kind']) =>
      run.events.find((e) => e.kind === kind);
    const cycle = runGraph(twoLocks(), 'cycle');
    expect(ruleIdFor(at(cycle, 'dl.wfg'))).toBe('dl.wfg');
    expect(ruleIdFor(at(cycle, 'dl.visit'))).toBe('dl.dfs.order');
    expect(ruleIdFor(at(cycle, 'dl.cycle'))).toBe('dl.dfs.order');
    const safety = runSafety(OSC10_BANKERS);
    expect(ruleIdFor(at(safety, 'dl.check'))).toBe('dl.scan.order');
    expect(ruleIdFor(safety.events.at(-1))).toBe('dl.scan.order');
    const request = runRequest(OSC10_BANKERS_AFTER_T1, { t: 0, request: [0, 2, 0] });
    expect(ruleIdFor(at(request, 'dl.req.pretend'))).toBe('dl.request.steps');
    const multi = runGraph(graphPresetById('cycle-no-deadlock')!.graph, 'cycle');
    expect(ruleIdFor(at(multi, 'dl.multi'))).toBe('dl.cycle.multi');
    const terminated = runGraph(twoLocks(), 'cycle', [{ kind: 'terminate', t: 1 }]);
    expect(ruleIdFor(at(terminated, 'dl.recover'))).toBe('dl.recover.terminate');
    const preempted = runGraph(twoLocks(), 'cycle', [{ kind: 'preempt', t: 0, r: 0 }]);
    expect(ruleIdFor(at(preempted, 'dl.recover'))).toBe('dl.recover.preempt');
    expect(ruleIdFor(undefined)).toBeNull();
  });
});

describe('Banker’s request checklist (§7.2.5)', () => {
  const run = runRequest(OSC10_BANKERS_AFTER_T1, { t: 0, request: [0, 2, 0] });
  const pretendAt = run.events.findIndex((e) => e.kind === 'dl.req.pretend');

  it('ticks each check in turn and ends refused', () => {
    expect(requestChecklist(run, 0).map((c) => c.status)).toEqual([
      'pass',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    expect(requestChecklist(run, 0)[0]!.changed).toBe(true);
    expect(requestChecklist(run, pretendAt + 1).map((c) => c.status)).toEqual([
      'pass',
      'pass',
      'pass',
      'current',
      'pending',
    ]);
    const end = requestChecklist(run, run.events.length - 1);
    expect(end.map((c) => c.status)).toEqual(['pass', 'pass', 'pass', 'fail', 'fail']);
    expect(end[4]!.label).toBe('Roll back: the thread waits');
    expect(end.filter((c) => c.changed).map((c) => c.id)).toEqual(['decision']);
  });

  it('ghosts the matrices between "pretend" and the decision, then says it rolled back', async () => {
    expect(isPretending(run, pretendAt - 1)).toBe(false);
    expect(isPretending(run, pretendAt)).toBe(true);
    expect(isPretending(run, run.events.length - 1)).toBe(false);
    const { container, unmount } = render(
      <BankersStep
        state={run.events[pretendAt]!.state}
        kind="dl.req.pretend"
        checks={requestChecklist(run, pretendAt)}
        pretending
      />,
    );
    expect(container.querySelector('[data-pretend]')).not.toBeNull();
    expect(screen.getByText(/^Pretend state, not granted yet/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Request checks' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(5);
    await expectNoAxeViolations(container);
    unmount();
    const last = run.events.at(-1)!;
    render(<BankersStep state={last.state} kind={last.kind} pretending={false} />);
    expect(screen.getByTestId('rolled-back')).toHaveTextContent('Rolled back');
  });
});

describe('Work bar and per-column checks (D2)', () => {
  it('shows what a finishing thread gives back, and the bar grows', () => {
    const run = runSafety(OSC10_BANKERS);
    const finish = run.events.find((e) => e.kind === 'dl.finish')!;
    const released = releasedAt(finish.state, finish.kind);
    expect(released).toEqual({ t: 1, values: [2, 0, 0] });
    expect(releasedAt(finish.state, 'dl.check')).toBeNull();
    render(<WorkFinish state={finish.state} released={released} />);
    expect(screen.getByTestId('work-bar')).toHaveAttribute('data-work', '5 3 2');
    expect(screen.getByText('+2 from T1')).toBeInTheDocument();
    const r0 = screen.getByRole('list', { name: 'Work' }).querySelector('li')!;
    expect(r0).toHaveTextContent(/5 of 10/);
    expect(screen.getByTestId('order')).toHaveTextContent('⟨T1⟩');
  });

  it('marks each column ✓ or ✗ and names the resource that blocks', async () => {
    const { container } = render(
      <CompareStrip
        left="Need[T0]"
        leftValues={[7, 4, 3]}
        right="Work"
        rightValues={[3, 3, 2]}
        trigger={0}
      />,
    );
    const cells = within(screen.getByTestId('compare-strip')).getAllByRole('listitem');
    expect(cells.map((c) => c.getAttribute('data-pass'))).toEqual([
      'false',
      'false',
      'false',
    ]);
    expect(cells[0]).toHaveTextContent('R07 > 3does not fit');
    expect(screen.getByTestId('compare-verdict')).toHaveTextContent(
      'No: R0 and R1 and R2 do not fit.',
    );
    await expectNoAxeViolations(container);
  });

  it('pops the columns in left to right on a forward step only', () => {
    const strip = (step: number) => (
      <CompareStrip
        left="Need[T1]"
        leftValues={[1, 2, 2]}
        right="Work"
        rightValues={[3, 3, 2]}
        trigger={step}
      />
    );
    const forward = stepFrom(0, 1, strip, { speed: 1, stepIntervalMs: STEP_MS });
    const pops = forward.container.querySelectorAll('[data-flash]');
    expect(pops).toHaveLength(3);
    const delays = [...forward.container.querySelectorAll('li')].map((li) =>
      (li as HTMLElement).style.getPropertyValue('--pop-delay'),
    );
    expect(delays).toEqual(['0ms', '60ms', '120ms']);
    forward.unmount();
    const back = stepFrom(2, 1, strip, { speed: 1, stepIntervalMs: STEP_MS });
    expect(back.container.querySelectorAll('[data-flash]')).toHaveLength(0);
    back.unmount();
    const undo = reduceMotion();
    try {
      const reduced = stepFrom(0, 1, strip, { speed: 1, stepIntervalMs: STEP_MS });
      expect(reduced.container.querySelectorAll('[data-flash]')).toHaveLength(0);
    } finally {
      undo();
    }
  });

  it('WorkBar grows with a transition on a forward step and instantly otherwise', () => {
    const bar = (step: number) => <WorkBar label="Work" values={[step]} total={[4]} />;
    const forward = stepFrom(1, 2, bar, { speed: 1, stepIntervalMs: STEP_MS });
    const fill = forward.container.querySelector('[aria-hidden="true"] > span')!;
    expect((fill as HTMLElement).style.transform).toBe('scaleX(0.5)');
    expect((fill as HTMLElement).style.transitionDuration).toBe('220ms');
    forward.unmount();
    const back = stepFrom(3, 2, bar, { speed: 1, stepIntervalMs: STEP_MS });
    const still = back.container.querySelector('[aria-hidden="true"] > span')!;
    expect((still as HTMLElement).style.transitionDuration).toBe('0ms');
  });

  it('MatrixTable dims every row but the one compared, and keeps it readable', () => {
    render(
      <MatrixTable
        caption="Need"
        rowLabels={['T0', 'T1', 'T2']}
        columnLabels={['R0']}
        values={[[1], [2], [3]]}
        highlightRow={1}
        dimOthers
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => r.className.includes('text-fg-muted'))).toEqual([
      true,
      false,
      true,
    ]);
  });
});

describe('results (D5, G13)', () => {
  it('says the safe sequence is one of possibly several, with thread chips', async () => {
    const run = runSafety(OSC10_BANKERS);
    const result = finalResult(run)!;
    const { container } = render(<ResultBanner result={result} />);
    expect(screen.getByTestId('order-note')).toHaveTextContent(
      'One safe order (there may be others).',
    );
    const chips = within(screen.getByRole('list', { name: 'Order found' })).getAllByText(
      /^T\d$/,
    );
    expect(chips.map((c) => c.textContent)).toEqual(['T1', 'T3', 'T0', 'T2', 'T4']);
    expect(endOfRunText(result)).toBe(
      'Safe: ⟨T1, T3, T0, T2, T4⟩ is one safe order (there may be others).',
    );
    await expectNoAxeViolations(container);
  });

  it('outlines the threads that cannot finish', () => {
    const run = runGraph(graphPresetById('osc10-detect-after')!.graph, 'detect');
    render(<ResultBanner result={finalResult(run)} />);
    const stuck = within(
      screen.getByRole('list', { name: 'Threads that cannot finish' }),
    ).getAllByRole('listitem');
    expect(stuck).toHaveLength(4);
    expect(stuck[0]).toHaveTextContent('T1can’t finish');
  });

  it('draws threads as rounded squares, not pills', () => {
    render(<ThreadChip t={3} />);
    const chip = screen.getByText('T3').parentElement!;
    expect(chip.className).toContain('rounded-md');
    expect(chip.className).toContain('size-8');
    expect(chip.className).not.toContain('rounded-full');
  });
});

describe('Try this next (G16)', () => {
  it('pairs each graph preset with one that contrasts, and falls back by result', () => {
    const graph = (id: string) => graphPresetById(id)!.graph;
    const next = (id: string) =>
      tryNextFor({
        view: 'graph',
        graph: graph(id),
        result: finalResult(runGraph(graph(id), graphPresetById(id)!.method)),
        graphPresets: GRAPH_PRESETS,
      })?.presetId;
    expect(next('two-locks')).toBe('cycle-no-deadlock');
    expect(next('cycle-no-deadlock')).toBe('multi-deadlock');
    expect(next('dining')).toBe('dining-right-first');
    for (const preset of GRAPH_PRESETS) {
      expect(next(preset.id), preset.id).not.toBe(preset.id);
    }
    const custom = { ...twoLocks(), processes: 3 };
    expect(
      tryNextFor({
        view: 'graph',
        graph: custom,
        result: finalResult(runGraph(custom, 'cycle')),
        graphPresets: GRAPH_PRESETS,
      })?.presetId,
    ).toBe('cycle-no-deadlock');
  });

  it('turns a Banker’s grant into a refusal and a refusal into a grant', () => {
    const at = (kind: 'granted' | 'refused' | 'safe', current: string | null) =>
      tryNextFor({
        view: 'bankers',
        graph: twoLocks(),
        result:
          kind === 'safe' ? { kind, order: [1] } : ({ kind } as { kind: typeof kind }),
        graphPresets: GRAPH_PRESETS,
        bankersPresetId: current,
      })?.presetId;
    expect(at('granted', 'osc10-t1')).toBe('osc10-t0');
    expect(at('refused', 'osc10-t0')).toBe('osc10-t1');
    expect(at('safe', 'osc10-safe')).toBe('osc10-t0');
  });
});

describe('G11: human validation messages', () => {
  it('says what a matrix cell needs, next to it, and announces it', async () => {
    const user = userEvent.setup();
    render(<BankersEditor state={OSC10_BANKERS} onChange={() => {}} />);
    const cell = screen.getByLabelText('Max, T0, R0');
    await user.clear(cell);
    await user.type(cell, 'x');
    await user.clear(cell);
    await user.type(cell, '25');
    expect(cell).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a whole number from 0 to 20.');
    expect(cell.getAttribute('aria-describedby')).toBe(alert.id);
    expect(screen.getByText('Computed, not edited')).toBeInTheDocument();
  });
});

describe('GraphCanvas', () => {
  let undo: (() => void) | null = null;
  afterEach(() => {
    undo?.();
    undo = null;
  });

  it('is view-only on a touch screen (D4)', () => {
    undo = matchQuery(TOUCH_QUERY);
    const run = runGraph(twoLocks(), 'cycle');
    render(<GraphCanvas state={run.events.at(-1)!.state} onConnect={() => {}} />);
    const canvas = screen.getByTestId('graph-canvas');
    expect(canvas).toHaveAttribute('data-touch', 'view-only');
    expect(canvas.querySelector('.react-flow__handle.connectable')).toBeNull();
  });

  it('can be edited with a mouse', () => {
    const run = runGraph(twoLocks(), 'cycle');
    render(<GraphCanvas state={run.events.at(-1)!.state} onConnect={() => {}} />);
    const canvas = screen.getByTestId('graph-canvas');
    expect(canvas).not.toHaveAttribute('data-touch');
    expect(canvas.querySelector('.react-flow__handle.connectable')).not.toBeNull();
  });

  it('knows the cycle’s edges in order and the DFS path’s graph edges', () => {
    const run = runGraph(twoLocks(), 'cycle');
    const last = run.events.at(-1)!.state;
    expect(cycleEdgeIds(last.cycle)).toEqual(['T0-R1', 'R1-T1', 'T1-R0', 'R0-T0']);
    const edge = run.events.find((e) => e.kind === 'dl.edge')!;
    const { current } = dfsEdgeIds(edge.state);
    expect([...current].sort()).toEqual(['R1-T1', 'T0-R1']);
  });
});

describe('DeadlockView (D1, D3, G10, G13)', { timeout: 30_000 }, () => {
  it('opens with presets; Edit reveals the editor; the method is under More options', async () => {
    const user = userEvent.setup();
    const { container } = render(<DeadlockView />);
    expect(screen.getByTestId('thread-names')).toHaveTextContent(
      /Silberschatz calls the waiting parties threads.*, T0, T1/,
    );
    expect(screen.getByTestId('view-intro')).toHaveTextContent(
      'Detection: what’s happening now.',
    );
    expect(screen.queryByRole('button', { name: 'Clear graph' })).toBeNull();
    const edit = screen.getByRole('button', { name: 'Edit the graph' });
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    await user.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Clear graph' })).toBeVisible();
    const more = screen.getByText('More options').closest('details')!;
    expect(more.open).toBe(false);
    expect(within(more).getByLabelText('Look for deadlock with')).toBeInTheDocument();
    expect(
      container.querySelector('[data-condition="mutual-exclusion"]'),
    ).toHaveTextContent('Always true here');

    await user.click(screen.getByRole('tab', { name: 'Banker’s' }));
    expect(screen.getByTestId('view-intro')).toHaveTextContent(
      'Avoidance: what might happen, given every thread’s maximum.',
    );
    expect(screen.getByRole('button', { name: 'Edit the state' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByLabelText('Max, T0, R0')).toBeInTheDocument();
  });

  it('shows the Rule used chip on a step a rule decided', async () => {
    const user = userEvent.setup();
    render(<DeadlockView />);
    (document.activeElement as HTMLElement | null)?.blur();
    await act(async () => {
      await user.keyboard('{End}');
    });
    const chip = document.querySelector('[data-rule-chip]');
    expect(chip).toHaveAttribute('data-rule-chip', 'dl.dfs.order');
    expect(document.querySelector('[data-rule="dl.dfs.order"]')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('says the canvas is view-only on a touch screen', () => {
    const undo = matchQuery(TOUCH_QUERY);
    try {
      render(<DeadlockView />);
      expect(screen.getByTestId('canvas-caption')).toHaveTextContent(
        'On a touch screen the picture is view-only: drag to pan, pinch to zoom.',
      );
    } finally {
      undo();
    }
  });
});
