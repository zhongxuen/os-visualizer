import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { coffman } from '@/core/deadlock/coffman';
import { deriveMatrices, type Graph } from '@/core/deadlock/model';
import {
  EMPTY_GRAPH,
  graphPresetById,
  OSC10_BANKERS,
  OSC10_BANKERS_AFTER_T1,
} from '@/core/deadlock/presets';
import { runRequest, runSafety } from '@/core/deadlock/bankers';
import { runGraph } from '@/core/deadlock/recover';

import {
  coffmanAt,
  endsDeadlocked,
  eventAt,
  finalResult,
  graphSummary,
  recoveryOptions,
  resultText,
  stepHeading,
} from './adapters';
import { BankersEditor, BankersQueryForm, BankersStep } from './BankersView';
import { CoffmanPanel } from './CoffmanPanel';
import { DeadlockView } from './DeadlockView';
import { DetectView } from './DetectView';
import GraphCanvas, { layout } from './GraphCanvas';
import { GraphEditorForm } from './GraphEditorForm';
import { RecoveryPanel } from './RecoveryPanel';

// React Flow measures nodes with ResizeObserver, which jsdom does not have.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

const twoLocks = () => graphPresetById('two-locks')!.graph;

describe('adapters', () => {
  it('summarises the graph in words, with the cycle', () => {
    expect(graphSummary(deriveMatrices(twoLocks()))).toEqual([
      'T0 holds R0, requests R1.',
      'T1 holds R1, requests R0.',
      'Cycle: T0 → R1 → T1 → R0 → T0.',
    ]);
    const multi = deriveMatrices(graphPresetById('osc10-detect')!.graph);
    expect(graphSummary(multi)[1]).toBe(
      'T1 holds 2 of R0, requests 2 of R0 and 2 of R2.',
    );
    expect(graphSummary(deriveMatrices(EMPTY_GRAPH))).toEqual([
      'T0 holds nothing.',
      'T1 holds nothing.',
      'No cycle.',
    ]);
    expect(graphSummary(deriveMatrices(EMPTY_GRAPH), [1])[1]).toBe('T1 was terminated.');
  });

  it('reads results, headings and recovery options off a run', () => {
    const run = runGraph(twoLocks(), 'cycle');
    expect(endsDeadlocked(run)).toBe(true);
    expect(resultText(finalResult(run)!)).toBe(
      'Deadlocked: cycle T0 → R1 → T1 → R0 → T0.',
    );
    expect(stepHeading(eventAt(run, 0), run)).toBe(
      `Step 1 of ${run.events.length}: wait-for graph`,
    );
    expect(eventAt(run, 10_000)).toBe(run.events.at(-1));
    expect(recoveryOptions(twoLocks(), [])).toEqual({
      terminate: [0, 1],
      preempt: [
        { t: 0, r: 0 },
        { t: 1, r: 1 },
      ],
    });
    expect(recoveryOptions(twoLocks(), [{ kind: 'terminate', t: 1 }])).toEqual({
      terminate: [0],
      preempt: [{ t: 0, r: 0 }],
    });
    const recovered = runGraph(twoLocks(), 'cycle', [{ kind: 'preempt', t: 0, r: 0 }]);
    expect(endsDeadlocked(recovered)).toBe(false);
    expect(coffmanAt(recovered.events.at(-1)!.state)[2]!.status).toBe('violated');
  });

  it('lays threads out above resources, centred', () => {
    const at = layout(2, 4);
    expect(at.thread(0)).toEqual({ x: 120, y: 0 });
    expect(at.resource(0)).toEqual({ x: 0, y: 190 });
    expect(at.resource(3).x - at.resource(0).x).toBe(360);
  });
});

describe('GraphEditorForm', { timeout: 30_000 }, () => {
  it('builds the two-lock deadlock from the keyboard and rejects an impossible edge', async () => {
    const user = userEvent.setup();
    let graph: Graph = EMPTY_GRAPH;
    const statuses: string[] = [];
    const { rerender, container } = render(
      <GraphEditorForm
        graph={graph}
        onChange={(g) => (graph = g)}
        onStatus={(s) => statuses.push(s)}
      />,
    );
    const add = async (t: string, verb: string, r: string) => {
      await user.selectOptions(screen.getByLabelText('Thread'), t);
      await user.selectOptions(screen.getByLabelText('Edge'), verb);
      await user.selectOptions(screen.getByLabelText('Resource'), r);
      await user.click(screen.getByRole('button', { name: 'Add edge' }));
      rerender(
        <GraphEditorForm
          graph={graph}
          onChange={(g) => (graph = g)}
          onStatus={(s) => statuses.push(s)}
        />,
      );
    };
    await add('T0', 'holds', 'R0');
    await add('T1', 'holds', 'R1');
    await add('T0', 'requests', 'R1');
    await add('T1', 'requests', 'R0');
    expect(graph).toEqual(twoLocks());
    expect(statuses.at(-1)).toBe('Added: T1 requests 1 of R0.');
    expect(
      screen.getByRole('list', { name: 'Edges in the graph' }).children,
    ).toHaveLength(4);

    await add('T1', 'holds', 'R0');
    expect(screen.getByText('R0 has 1 instance but 2 are assigned')).toBeInTheDocument();
    expect(graph).toEqual(twoLocks());

    await user.click(screen.getByRole('button', { name: 'Remove: T0 requests 1 of R1' }));
    expect(graph.requests).toEqual([{ t: 1, r: 0, n: 1 }]);
    await expectNoAxeViolations(container);
  });
});

describe('panels', { timeout: 30_000 }, () => {
  it('CoffmanPanel marks the assumed conditions as assumed', async () => {
    const { container } = render(
      <CoffmanPanel conditions={coffman(deriveMatrices(twoLocks()))} />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-status'))).toEqual([
      'assumed',
      'holds',
      'assumed',
      'holds',
    ]);
    expect(within(items[0]!).getByText('Assumed')).toBeInTheDocument();
    expect(
      screen.getByText(/necessary for deadlock, not sufficient/),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('RecoveryPanel applies a termination', async () => {
    const user = userEvent.setup();
    const applied: unknown[] = [];
    const { container } = render(
      <RecoveryPanel
        graph={twoLocks()}
        recovery={[]}
        deadlocked
        onApply={(a) => applied.push(a)}
        onUndo={() => {}}
        onClear={() => {}}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Thread to terminate'), 'T1');
    await user.click(screen.getByRole('button', { name: 'Terminate T1' }));
    expect(applied).toEqual([{ kind: 'terminate', t: 1 }]);
    await user.selectOptions(screen.getByLabelText('Recovery action'), 'preempt');
    expect(screen.getByLabelText('Instance to preempt')).toHaveDisplayValue(
      '1 of R0 from T0',
    );
    await expectNoAxeViolations(container);
  });

  it('DetectView shows the DFS for cycles and the matrices for detection', async () => {
    const cycle = runGraph(twoLocks(), 'cycle');
    const { unmount } = render(<DetectView state={cycle.events.at(-1)!.state} />);
    expect(screen.getByTestId('dfs-path')).toHaveTextContent('T0 → T1');
    expect(screen.getByTestId('dl-result')).toHaveTextContent(
      'Deadlocked: cycle T0 → R1 → T1 → R0 → T0.',
    );
    unmount();
    const detect = runGraph(graphPresetById('osc10-detect-after')!.graph, 'detect');
    const check = detect.events.find((e) => e.kind === 'dl.check' && e.process === 1)!;
    const { container } = render(<DetectView state={check.state} />);
    expect(screen.getByTestId('matrix-compare')).toHaveTextContent(
      'Request[T1] ≤ Work: no, at least one resource does not fit',
    );
    expect(screen.getByTestId('work')).toHaveTextContent('010');
    await expectNoAxeViolations(container);
  });

  it('BankersStep compares the request with Need, then shows the refusal', async () => {
    const run = runRequest(OSC10_BANKERS_AFTER_T1, { t: 0, request: [0, 2, 0] });
    const { unmount } = render(<BankersStep state={run.events[0]!.state} />);
    expect(screen.getAllByTestId('matrix-compare')[0]).toHaveTextContent(
      'Request[T0] ≤ Need[T0]: yes',
    );
    unmount();
    const { container } = render(<BankersStep state={run.events.at(-1)!.state} />);
    expect(screen.getByTestId('dl-result')).toHaveTextContent(/^Refused/);
    await expectNoAxeViolations(container);
    expect(runSafety(OSC10_BANKERS).events.length).toBeGreaterThan(5);
  });

  it('BankersEditor shows Need and refuses Allocation above Max', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    const { container } = render(
      <BankersEditor state={OSC10_BANKERS} onChange={(s) => seen.push(s)} />,
    );
    expect(
      screen.getByRole('table', { name: 'Need = Max − Allocation' }),
    ).toBeInTheDocument();
    const cell = screen.getByLabelText('Allocation, T0, R0');
    await user.clear(cell);
    await user.type(cell, '9');
    expect(screen.getByText('T0 holds 9 of R0 but its maximum is 7')).toBeInTheDocument();
    expect(seen).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('BankersQueryForm runs a request', async () => {
    const user = userEvent.setup();
    const runs: unknown[] = [];
    render(
      <BankersQueryForm
        state={OSC10_BANKERS}
        query={{ run: 'safety', t: 0, request: [0, 0, 0] }}
        onRun={(q) => runs.push(q)}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Requesting thread'), 'T1');
    await user.clear(screen.getByLabelText('Request R0'));
    await user.type(screen.getByLabelText('Request R0'), '1');
    await user.clear(screen.getByLabelText('Request R2'));
    await user.type(screen.getByLabelText('Request R2'), '2');
    await user.click(screen.getByRole('button', { name: 'Run request' }));
    expect(runs).toEqual([{ run: 'request', t: 1, request: [1, 0, 2] }]);
  });

  it('GraphCanvas draws a node per thread and resource type', () => {
    const run = runGraph(twoLocks(), 'cycle');
    render(<GraphCanvas state={run.events.at(-1)!.state} />);
    const canvas = screen.getByTestId('graph-canvas');
    for (const name of ['T0', 'T1', 'R0', 'R1']) {
      expect(within(canvas).getByText(name)).toBeInTheDocument();
    }
  });
});

describe('DeadlockView', { timeout: 30_000 }, () => {
  it('runs the two-lock preset to the cycle, then recovers by terminating T1', async () => {
    const user = userEvent.setup();
    render(<DeadlockView />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Deadlock' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('graph-summary')).toHaveTextContent(
      'Cycle: T0 → R1 → T1 → R0 → T0.',
    );
    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('dl-result')).toHaveTextContent('Deadlocked: cycle');
    await user.selectOptions(screen.getByLabelText('Thread to terminate'), 'T1');
    await user.click(screen.getByRole('button', { name: 'Terminate T1' }));
    (document.activeElement as HTMLElement).blur();
    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('dl-result')).toHaveTextContent(
      'Not deadlocked: the wait-for graph has no cycle.',
    );
    expect(screen.getByTestId('graph-summary')).toHaveTextContent('T1 was terminated.');
  });

  it('switches to the Banker’s tab and runs the safety algorithm to the end', async () => {
    const user = userEvent.setup();
    render(<DeadlockView />);
    await user.click(screen.getByRole('tab', { name: 'Banker’s' }));
    expect(screen.getByRole('tab', { name: 'Banker’s' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    (document.activeElement as HTMLElement).blur();
    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('dl-result')).toHaveTextContent(
      'Safe. Safe sequence ⟨T1, T3, T0, T2, T4⟩ (one of possibly several).',
    );
  });
});
