import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { allCurves } from '@/core/replace/curve';
import { BELADY_STRING, OSC10_STRING, presetById } from '@/core/replace/presets';
import { replace, runReplace } from '@/core/replace/replace';

import {
  anomaliesOf,
  columnsAt,
  countersAt,
  eventAt,
  finalColumns,
  hitRate,
  referencesDone,
  stepHeading,
} from './adapters';
import { BeladyPanel } from './BeladyPanel';
import { CurvePanel } from './CurvePanel';
import { InputPanel, refStringMessages } from './InputPanel';
import { PolicyState } from './PolicyState';
import { PolicyTabs } from './PolicyTabs';
import { ReplacementView } from './ReplacementView';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('adapters', () => {
  it('builds one column per reference with loads and evictions marked', () => {
    const run = replace(OSC10_STRING, 3, 'fifo');
    const columns = finalColumns(run, OSC10_STRING);
    expect(columns).toHaveLength(20);
    expect(columns.filter((c) => c.fault)).toHaveLength(15);
    expect(columns[3]).toMatchObject({
      ref: 2,
      frames: [2, 0, 1],
      loaded: 0,
      evicted: 7,
    });
    expect(columns[4]).toMatchObject({ ref: 0, fault: false });
    expect(columns[4]!.loaded).toBeUndefined();
  });

  it('shows the current column as it stands mid-fault', () => {
    const run = replace(OSC10_STRING, 3, 'fifo');
    const fault = run.events.findIndex((e) => e.state.index === 3);
    const columns = columnsAt(run, OSC10_STRING, run.events[fault]);
    // Still the old frames, no "in" mark yet.
    expect(columns[3]).toMatchObject({ fault: true, frames: [7, 0, 1] });
    expect(columns[3]!.loaded).toBeUndefined();
  });

  it('carries Clock use bits and the hand', () => {
    const run = replace([1, 2, 3, 4], 3, 'clock');
    const last = finalColumns(run, [1, 2, 3, 4]).at(-1)!;
    expect(last).toMatchObject({ useBits: [1, 0, 0], hand: 1 });
  });

  it('counts, rates and names steps', () => {
    const run = runReplace(presetById('ostep')!.input);
    const end = eventAt(run, 10_000)!;
    expect(countersAt(end)).toEqual({ hits: 6, faults: 5, cold: 4 });
    expect(referencesDone(end)).toBe(11);
    expect(hitRate(6, 11)).toBe('54.5%');
    expect(hitRate(0, 0)).toBe('—');
    // Step 0 is the first fault: the reference is not done until the load.
    expect(referencesDone(eventAt(run, 0))).toBe(0);
    expect(referencesDone(eventAt(run, 1))).toBe(1);
    expect(stepHeading(eventAt(run, 0), [0, 1])).toBe(
      'Reference 1 of 2 (page 0): page fault',
    );
  });

  it('finds every anomaly on every curve', () => {
    expect(anomaliesOf(allCurves(BELADY_STRING))).toEqual([
      { policy: 'fifo', frames: 4, faults: 10, previous: 9 },
      { policy: 'clock', frames: 4, faults: 10, previous: 9 },
    ]);
  });
});

describe('InputPanel', { timeout: 30_000 }, () => {
  it('reports bad references by position and only passes on valid input', async () => {
    const user = userEvent.setup();
    const seen: number[][] = [];
    const input = presetById('belady')!.input;
    const { container } = render(
      <InputPanel input={input} onChange={(next) => seen.push(next.refString)} />,
    );
    const box = screen.getByLabelText(/Pages referenced/);
    await user.clear(box);
    await user.type(box, '1, 2, 99');
    expect(screen.getByText(/Reference 3: Page must be at most 15/)).toBeInTheDocument();
    expect(seen.at(-1)).toEqual([1, 2, 9]);
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    expect(seen.at(-1)).toHaveLength(30);
    await expectNoAxeViolations(container);
    expect(refStringMessages({ ...input, refString: [] })).toEqual([
      'Add at least one reference',
    ]);
  });
});

describe('PolicyTabs', () => {
  it('moves between tabs with the arrow keys and selects', async () => {
    const user = userEvent.setup();
    let policy: 'fifo' | 'lru' | 'opt' | 'clock' = 'fifo';
    const { rerender } = render(
      <PolicyTabs policy={policy} onChange={(p) => (policy = p)}>
        <p>panel</p>
      </PolicyTabs>,
    );
    const fifo = screen.getByRole('tab', { name: /FIFO/ });
    expect(fifo).toHaveAttribute('aria-selected', 'true');
    fifo.focus();
    await user.keyboard('{ArrowLeft}');
    expect(policy).toBe('clock');
    rerender(
      <PolicyTabs policy={policy} onChange={(p) => (policy = p)}>
        <p>panel</p>
      </PolicyTabs>,
    );
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/Clock/);
  });
});

describe('panels', { timeout: 30_000 }, () => {
  it('PolicyState shows what OPT looks at', () => {
    const run = replace([1, 2, 3, 4, 1], 3, 'opt');
    const victim = run.events.find((e) => e.kind === 'repl.victim')!;
    render(<PolicyState event={victim} policy="opt" />);
    expect(screen.getAllByText('never')).toHaveLength(2);
    expect(screen.getByText('this step')).toBeInTheDocument();
  });

  it('CurvePanel names the anomaly in words and is axe clean', async () => {
    const { container } = render(
      <CurvePanel curves={allCurves(BELADY_STRING)} frames={3} />,
    );
    expect(screen.getAllByTestId('belady-point')[0]).toHaveTextContent(
      'FIFO faults 10 times with 4 frames but only 9 with 3',
    );
    await expectNoAxeViolations(container);
  });

  it('BeladyPanel steps both runs to the end: 9 vs 10', async () => {
    const user = userEvent.setup();
    const { container } = render(<BeladyPanel refString={BELADY_STRING} frames={3} />);
    expect(screen.getByTestId('belady-faults-small')).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: 'Last' }));
    expect(screen.getByTestId('belady-faults-small')).toHaveTextContent('9');
    expect(screen.getByTestId('belady-faults-large')).toHaveTextContent('10');
    expect(screen.getByText(/Belady’s anomaly: with 4 frames/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Policy to compare'), 'lru');
    expect(screen.getByTestId('belady-faults-small')).toHaveTextContent('10');
    expect(screen.getByTestId('belady-faults-large')).toHaveTextContent('8');
    expect(screen.getByText(/stack algorithm/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('ReplacementView', { timeout: 30_000 }, () => {
  it('renders the OSC10 preset and steps to the end with the keyboard', async () => {
    const user = userEvent.setup();
    render(<ReplacementView />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page Replacement' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('faults')).toHaveTextContent('1');
    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('faults')).toHaveTextContent('15');
    expect(screen.getByTestId('cold')).toHaveTextContent('6');
    expect(screen.getByTestId('capacity')).toHaveTextContent('9');
    expect(screen.getByTestId('refs-done')).toHaveTextContent('20 / 20');
  });

  it('switching to the LRU tab reruns the string', async () => {
    const user = userEvent.setup();
    render(<ReplacementView />);
    await user.click(screen.getByRole('tab', { name: /LRU/ }));
    (document.activeElement as HTMLElement).blur();
    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('faults')).toHaveTextContent('12');
    const inspector = screen.getByRole('region', { name: 'Inspector' });
    expect(
      within(inspector).getByRole('heading', { name: /Reference 20 of 20/ }),
    ).toBeInTheDocument();
  });
});
