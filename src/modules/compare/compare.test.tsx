import { act, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StepTransitionProvider } from '@/components/motion/useStepTransition';
import { expectNoAxeViolations } from '@/components/testing/axe';
import { renderLinked } from '@/components/testing/linked';
import { COMPARE_SHARE } from '@/core/sched/share';
import { COMPARE_SHARE_STATE } from '@/core/sched/state';
import { compare, COMPARE_PRESETS, whyLine } from '@/core/sched/compare';

import { CompareView, tableAt } from './CompareView';
import { PolicyColumns } from './PolicyColumns';
import { rowMarks } from './summary';
import { POP, useArrival } from './useArrival';

// Each view reads and writes `?s=`; start every test from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

/**
 * Every call follows a fresh `render`, which opens in Guided: the lesson (its own chunk)
 * loads its first example once it arrives. Wait for that, or it can land between picking
 * the preset and loading it, and "Load preset" then loads the lesson's example.
 */
async function loadPreset(user: UserEvent, id: string) {
  await screen.findByText(/^Loaded example:/, {}, { timeout: 10_000 });
  await user.selectOptions(screen.getByLabelText('Preset'), id);
  await user.click(screen.getByRole('button', { name: 'Load preset' }));
}

async function openEditor(user: UserEvent) {
  // A `?s=` link is decoded once its schema (its own chunk) loads, and the editor starts
  // again when it is; let that happen first, or a click can land on the old editor.
  await act(async () => {
    await COMPARE_SHARE.load();
  });
  await user.click(
    screen.getByRole('button', { name: 'Edit the policies and workload' }),
  );
  // The editor is its own chunk, loaded on first open.
  await screen.findByRole('button', { name: 'Add a policy' });
}

/** The marks on each body row of the side-by-side table, as `rowMarks` gives them. */
function tableMarks(): (string | null)[][] {
  const table = screen.getByRole('table', { name: /Side by side/ });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.getAttribute('data-mark')),
    );
}

describe('tableAt', () => {
  it('at the end of every run equals the final compare table', () => {
    const preset = COMPARE_PRESETS[1]!;
    const result = compare(preset.workload, preset.policies);
    expect(tableAt(result.table, result.metrics)).toEqual(result.table);
  });
});

describe('CompareView', { timeout: 30_000 }, () => {
  it('draws one chart per policy and fills the table at the end', async () => {
    const user = userEvent.setup();
    render(<CompareView />);

    await loadPreset(user, 'rr-sweep');
    for (const q of [1, 2, 4, 8]) {
      expect(
        screen.getByRole('group', { name: `Gantt chart, RR q=${q}` }),
      ).toBeInTheDocument();
    }

    await act(async () => {
      await user.keyboard('{End}');
    });
    const table = screen.getByRole('table', { name: /Side by side/ });
    const row = within(table).getByRole('row', { name: /Context switches/ });
    const cells = within(row)
      .getAllByRole('cell')
      .map((c) => parseInt(c.textContent!, 10));
    expect(cells).toEqual([17, 10, 5, 3]);
    expect(screen.getByTestId('why-line')).toHaveTextContent(
      'RR q=1 has the lowest average response time',
    );
  });

  it('gives no markers and no verdict until every run has finished (C2, C3)', async () => {
    const user = userEvent.setup();
    render(<CompareView />);
    await loadPreset(user, 'fcfs-sjf-srtf');
    const result = compare(COMPARE_PRESETS[0]!.workload, COMPARE_PRESETS[0]!.policies);

    expect(screen.getByTestId('why-line')).toHaveTextContent(
      `settled when every run has finished, at t = ${result.durationTicks}`,
    );
    expect(document.querySelectorAll('[data-marker]')).toHaveLength(0);

    await act(async () => {
      await user.keyboard('{End}');
    });
    // The headline is the "Why?" sentence, above the table (C3).
    const why = screen.getByTestId('why-line');
    expect(why).toHaveTextContent(whyLine(result.table, result.names));
    const heading = screen.getByRole('heading', { name: /^Metrics at t = / });
    const table = screen.getByRole('table', { name: /Side by side/ });
    expect(
      heading.compareDocumentPosition(why) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      why.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Every row says which way is good (C2).
    for (const tr of within(table).getAllByRole('row').slice(1)) {
      expect(tr).toHaveTextContent(/(lower|higher) is better/);
    }
  });

  it('marks ties as ties and the sole best as best, matching the headline', async () => {
    const user = userEvent.setup();
    render(<CompareView />);
    // FCFS, SJF, SRTF, then a second FCFS: FCFS and FCFS (2) tie on every row.
    await loadPreset(user, 'fcfs-sjf-srtf');
    await openEditor(user);
    await user.click(screen.getByRole('button', { name: 'Add a policy' }));
    await user.click(screen.getByRole('button', { name: /^FCFS: first come/ }));
    // The new column's select has focus, and End there is the select's own key.
    (document.activeElement as HTMLElement).blur();
    await act(async () => {
      await user.keyboard('{End}');
    });

    const preset = COMPARE_PRESETS[0]!;
    const result = compare(preset.workload, [...preset.policies, { kind: 'fcfs' }]);
    expect(tableMarks()).toEqual(
      result.table.map((row) => rowMarks(row).map((m) => m ?? null)),
    );
    const marks = tableMarks().flat();
    expect(marks).toContain('tie');
    // Each tie marker says "tie" in words, each best "best".
    for (const marker of document.querySelectorAll('[data-marker="tie"]')) {
      expect(marker).toHaveTextContent('tie');
    }
    for (const marker of document.querySelectorAll('[data-marker="best"]')) {
      expect(marker).toHaveTextContent('best');
    }
    expect(screen.getByTestId('why-line')).toHaveTextContent(
      whyLine(result.table, result.names),
    );
  });

  it('adds and removes policy columns within 2 to 4', async () => {
    const user = userEvent.setup();
    renderLinked(<CompareView />, COMPARE_SHARE_STATE);
    await openEditor(user);
    expect(screen.getAllByRole('button', { name: /^Remove column/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Add a policy' }));
    await user.click(screen.getByRole('button', { name: 'Round robin' }));
    expect(screen.getByRole('button', { name: 'Add a policy' })).toBeDisabled();
    expect(screen.getByText(/Four columns is the most/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove column 4' }));
    await user.click(screen.getByRole('button', { name: 'Remove column 3' }));
    for (const button of screen.getAllByRole('button', { name: /^Remove column/ })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByText(/needs at least two columns/)).toBeInTheDocument();
  });

  it('"Same policy, other settings" copies a column and focuses its setting (C4)', async () => {
    const user = userEvent.setup();
    render(<CompareView />);
    await loadPreset(user, 'response-vs-turnaround');
    await openEditor(user);
    await user.click(screen.getByRole('button', { name: 'Add a policy' }));
    await user.click(
      screen.getByRole('button', { name: 'Copy column 2 (RR q=2), quantum 2 → 4' }),
    );
    const quantum = screen.getByLabelText('Column 3 Quantum (ticks)');
    expect(quantum).toHaveValue(4);
    expect(quantum).toHaveFocus();
    expect(
      screen.getByRole('group', { name: 'Gantt chart, RR q=4' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a copy of column 2 \(RR q=2\) with quantum 2 → 4/),
    ).toBeInTheDocument();
  });

  it('on a phone, shows the policy picked in the segmented control (C1)', async () => {
    const user = userEvent.setup();
    render(<CompareView />);
    await loadPreset(user, 'fcfs-sjf-srtf');
    const charts = () =>
      [...document.querySelectorAll('[data-chart]')].map(
        (el) => !el.className.includes('max-sm:hidden'),
      );
    expect(charts()).toEqual([true, false, false]);
    await user.click(screen.getByRole('radio', { name: 'SRTF' }));
    expect(charts()).toEqual([false, false, true]);
    expect(screen.getByTestId('mini-map').querySelectorAll('svg')).toHaveLength(3);
  });

  it('policy columns are axe clean', async () => {
    const preset = COMPARE_PRESETS[0]!;
    const { container } = render(
      <PolicyColumns
        policies={preset.policies}
        names={['FCFS', 'SJF', 'SRTF']}
        onChange={() => {}}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('useArrival', () => {
  const animate = vi.fn(() => ({ cancel: () => {} }));
  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: animate,
    });
    animate.mockClear();
  });
  afterEach(() => {
    delete (Element.prototype as { animate?: unknown }).animate;
  });

  function Thing() {
    const ref = useArrival<HTMLSpanElement>(POP, { token: 120, delayToken: 60 });
    return <span ref={ref}>marker</span>;
  }

  function Harness({ step, show }: { step: number; show: boolean }) {
    return (
      <StepTransitionProvider step={step}>
        {show ? <Thing /> : null}
      </StepTransitionProvider>
    );
  }

  it('plays when the element arrives on one step forward', () => {
    const { rerender } = render(<Harness step={0} show={false} />);
    rerender(<Harness step={1} show />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(
      POP,
      expect.objectContaining({ duration: 120, delay: 60 }),
    );
  });

  it('is instant on a jump, a step back and the first render', () => {
    render(<Harness step={4} show />);
    const { rerender } = render(<Harness step={0} show={false} />);
    rerender(<Harness step={9} show />);
    rerender(<Harness step={8} show={false} />);
    rerender(<Harness step={7} show />);
    expect(animate).not.toHaveBeenCalled();
  });
});
