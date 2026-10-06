import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';

import {
  axisLabels,
  axisLabelsFor,
  clipSegments,
  GanttChart,
  ganttSummary,
  type GanttLane,
  type GanttSegment,
} from './GanttChart';

const SEGMENTS: GanttSegment[] = [
  { start: 0, end: 3, kind: 'run', pid: 1 },
  { start: 3, end: 4, kind: 'cs' },
  { start: 4, end: 6, kind: 'run', pid: 2 },
  { start: 6, end: 7, kind: 'idle' },
  { start: 7, end: 9, kind: 'run', pid: 3 },
];

const LANES: GanttLane[] = [
  { id: 0, label: 'Q0 (q = 2)' },
  { id: 1, label: 'Q1 (q = 4)' },
];

const MLFQ: GanttSegment[] = [
  { start: 0, end: 2, kind: 'run', pid: 1, lane: 0 },
  { start: 2, end: 4, kind: 'run', pid: 2, lane: 0 },
  { start: 4, end: 8, kind: 'run', pid: 1, lane: 1 },
];

describe('clipSegments', () => {
  it('drops segments at or after the cursor and cuts the one it crosses', () => {
    expect(clipSegments(SEGMENTS, 5)).toEqual([
      { start: 0, end: 3, kind: 'run', pid: 1 },
      { start: 3, end: 4, kind: 'cs' },
      { start: 4, end: 5, kind: 'run', pid: 2 },
    ]);
    expect(clipSegments(SEGMENTS, 0)).toEqual([]);
    expect(clipSegments(SEGMENTS, 99)).toEqual(SEGMENTS);
  });
});

describe('ganttSummary', () => {
  it('says what has run, naming idle time and context switches', () => {
    expect(ganttSummary(SEGMENTS, 7)).toBe(
      'Gantt chart at t = 7: P1 0–3, context switch 3–4, P2 4–6, idle 6–7.',
    );
    expect(ganttSummary(SEGMENTS, 0)).toBe('Gantt chart at t = 0: nothing has run yet.');
  });

  it('names the lane in MLFQ', () => {
    expect(ganttSummary(MLFQ, 6, { lanes: LANES })).toContain('P1 4–6 in Q1 (q = 4)');
  });
});

describe('axisLabels', () => {
  it('labels every tick on a short run and always the end', () => {
    expect(axisLabels(4)).toEqual([0, 1, 2, 3, 4]);
    expect(axisLabels(23)).toEqual([0, 5, 10, 15, 20, 23]);
    expect(axisLabels(100).at(-1)).toBe(100);
  });
});

describe('GanttChart', () => {
  it('draws only the bars before the cursor, with the PID as text', () => {
    const { container } = render(<GanttChart segments={SEGMENTS} tick={5} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAccessibleName(ganttSummary(SEGMENTS, 5));
    const bars = container.querySelectorAll('[data-kind]');
    expect([...bars].map((bar) => bar.getAttribute('data-kind'))).toEqual([
      'run',
      'cs',
      'run',
    ]);
    expect(within(svg).getByText('P1')).toBeInTheDocument();
    expect(within(svg).getByText('CS')).toBeInTheDocument();
    expect(within(svg).queryByText('P3')).not.toBeInTheDocument();
    expect(within(svg).getByText('t = 5')).toBeInTheDocument();
  });

  it('fades the future instead of hiding it when asked', () => {
    const { container } = render(
      <GanttChart segments={SEGMENTS} tick={5} future="fade" />,
    );
    expect(container.querySelectorAll('g[opacity]')).toHaveLength(3);
  });

  it('follows an external tick: two charts given one tick show one cursor', () => {
    const other: GanttSegment[] = [{ start: 0, end: 9, kind: 'run', pid: 4 }];
    const view = (tick: number) => (
      <>
        <GanttChart segments={SEGMENTS} tick={tick} title="FCFS" />
        <GanttChart segments={other} tick={tick} title="RR" />
      </>
    );
    const { rerender } = render(view(2));
    const cursors = () =>
      screen.getAllByTestId('gantt-cursor').map((c) => c.getAttribute('data-tick'));
    expect(cursors()).toEqual(['2', '2']);
    rerender(view(8));
    expect(cursors()).toEqual(['8', '8']);
  });

  it('draws one row per MLFQ lane, labelled', () => {
    render(<GanttChart segments={MLFQ} tick={8} lanes={LANES} />);
    const svg = screen.getByRole('img');
    expect(within(svg).getByText('Q0 (q = 2)')).toBeInTheDocument();
    expect(within(svg).getByText('Q1 (q = 4)')).toBeInTheDocument();
  });

  it('has a table view with the same segments', async () => {
    const user = userEvent.setup();
    render(<GanttChart segments={MLFQ} tick={6} lanes={LANES} />);
    await user.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'QueueProcessStartEndTicks',
      'Q0 (q = 2)P1022',
      'Q0 (q = 2)P2242',
      'Q1 (q = 4)P1462',
    ]);
    expect(screen.getByRole('button', { name: 'Show as chart' })).toHaveFocus();
  });

  it('is axe clean as a chart and as a table', async () => {
    const user = userEvent.setup();
    const { container } = render(<GanttChart segments={MLFQ} tick={6} lanes={LANES} />);
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Show as table' }));
    await expectNoAxeViolations(container);
  });
});

describe('GanttChart, optional extras (U3.1)', () => {
  it('spaces fitted axis labels at least 28 px apart and always ends on the last tick', () => {
    const labels = axisLabelsFor(300, 1);
    expect(labels.at(-1)).toBe(300);
    for (let i = 1; i < labels.length; i += 1) {
      expect(labels[i]! - labels[i - 1]!).toBeGreaterThanOrEqual(28);
    }
    expect(axisLabelsFor(9, 32)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('fits 300 ticks into a phone-width box', () => {
    const width = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(358);
    try {
      const long: GanttSegment[] = [{ start: 0, end: 300, kind: 'run', pid: 1 }];
      render(<GanttChart segments={long} tick={300} zoom="fit" />);
      const svg = screen.getByRole('img');
      expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(358);
      expect(svg).toHaveAttribute('data-zoom', 'fit');
    } finally {
      width.mockRestore();
    }
  });

  it('scrolls to keep the cursor in view when zoomed', () => {
    const client = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(300);
    const scroll = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(5000);
    try {
      const long: GanttSegment[] = [{ start: 0, end: 300, kind: 'run', pid: 1 }];
      render(<GanttChart segments={long} tick={200} zoom={16} followCursor />);
      const box = screen.getByRole('group', { name: /scrollable/ });
      expect(box.scrollLeft).toBeGreaterThan(0);
    } finally {
      client.mockRestore();
      scroll.mockRestore();
    }
  });

  it('dims other processes, reports hovers, and draws brackets and marks', async () => {
    const user = userEvent.setup();
    const onPidHover = vi.fn();
    const { container } = render(
      <GanttChart
        segments={SEGMENTS}
        tick={9}
        highlightPid={2}
        onPidHover={onPidHover}
        brackets={{
          pid: 2,
          arrival: 1,
          firstRun: 4,
          completion: 6,
          waiting: [{ start: 1, end: 4 }],
        }}
        marks={[{ tick: 3, label: 'P1 preempted at t = 3' }]}
      />,
    );
    expect(container.querySelector('g[data-pid="2"][data-highlight]')).not.toBeNull();
    expect(container.querySelector('g[data-pid="1"]')).toHaveAttribute('opacity', '0.35');
    expect(container.querySelector('[data-bracket="response"]')).toHaveTextContent(
      'response 3',
    );
    expect(container.querySelector('[data-bracket="turnaround"]')).toHaveTextContent(
      'turnaround 5',
    );
    expect(container.querySelectorAll('[data-waiting]')).toHaveLength(1);
    expect(container.querySelector('[data-mark] title')).toHaveTextContent(
      'P1 preempted at t = 3',
    );
    await user.hover(container.querySelector('g[data-pid="3"]')!);
    expect(onPidHover).toHaveBeenLastCalledWith(3);
    await expectNoAxeViolations(container);
  });

  it('draws nothing extra when the extras are not passed', () => {
    const { container } = render(<GanttChart segments={SEGMENTS} tick={9} />);
    expect(container.querySelector('[data-zoom]')).toBeNull();
    expect(
      container.querySelector('[data-brackets], [data-mark], [data-highlight]'),
    ).toBeNull();
    expect(container.querySelector('clipPath')).toBeNull();
  });
});
