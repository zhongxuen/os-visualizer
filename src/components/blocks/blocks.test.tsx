import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';

import { BitField, splitFields } from './BitField';
import { ChartTableToggle } from './ChartTableToggle';
import { faultCount, FrameStrip, type FrameColumn } from './FrameStrip';
import { compareRow, MatrixTable, parseCell } from './MatrixTable';
import { bestColumns, columnMeans, formatMetric, MetricsTable } from './MetricsTable';
import { linePath, MiniLineChart, spreadLabels } from './MiniLineChart';
import { QueueView } from './QueueView';

describe('ChartTableToggle', () => {
  it('switches between the chart and the table, one at a time', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ChartTableToggle
        label="Faults"
        chart={<p>the chart</p>}
        table={<p>the table</p>}
      />,
    );
    expect(screen.getByRole('group', { name: 'Faults' })).toHaveTextContent('the chart');
    expect(screen.queryByText('the table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByText('the table')).toBeInTheDocument();
    expect(screen.queryByText('the chart')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByText('the chart')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('QueueView', () => {
  const props = {
    running: { pid: 2, remaining: 3 },
    queues: [
      { id: 'q0', label: 'Q0', items: [{ pid: 1, remaining: 4 }, { pid: 3 }] },
      { id: 'q1', label: 'Q1', items: [] },
    ],
    waiting: [{ pid: 4, detail: 'I/O until t = 9' }],
  };

  it('shows the running slot, each queue in order with its head, and the I/O list', () => {
    render(<QueueView {...props} />);
    expect(screen.getByTestId('queue-running')).toHaveTextContent('P23 left');
    const q0 = screen.getByRole('list', { name: 'Q0' });
    const items = within(q0).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['P14 left(next)', 'P3']);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Waiting on I/O' })).toHaveTextContent(
      'I/O until t = 9',
    );
  });

  it('says the CPU is idle, and is axe clean', async () => {
    const { container } = render(<QueueView {...props} running={null} />);
    expect(screen.getByTestId('queue-running')).toHaveTextContent('Idle');
    await expectNoAxeViolations(container);
  });
});

describe('BitField', () => {
  const fields = [
    { id: 'pd', name: 'PD index', bits: 10 },
    { id: 'pt', name: 'PT index', bits: 10 },
    { id: 'off', name: 'Offset', bits: 12 },
  ];

  it('splits an address into fields, most significant first', () => {
    // 0x00403ABC: PD 1, PT 3, offset 0xABC.
    const parts = splitFields(0x00403abc, fields);
    expect(parts.map((p) => [p.id, p.value, p.hex, p.low])).toEqual([
      ['pd', 1, '0x001', 22],
      ['pt', 3, '0x003', 12],
      ['off', 0xabc, '0xABC', 0],
    ]);
    expect(parts[2]!.binary).toBe('101010111100');
  });

  it('handles fields above bit 31', () => {
    const parts = splitFields(2 ** 40 + 5, [
      { id: 'hi', name: 'High', bits: 9 },
      { id: 'lo', name: 'Low', bits: 32 },
    ]);
    expect(parts.map((p) => p.value)).toEqual([256, 5]);
  });

  it('shows each field in binary, hex and decimal, and marks the highlighted one', async () => {
    const { container } = render(
      <BitField
        value={0x00403abc}
        fields={fields}
        highlight="pt"
        label="Virtual address"
      />,
    );
    expect(screen.getByText('0x00403ABC')).toBeInTheDocument();
    const active = container.querySelector('[data-active]')!;
    expect(active).toHaveAttribute('data-field', 'pt');
    expect(active).toHaveTextContent('(this step)');
    expect(active).toHaveTextContent('Bits21–12');
    expect(active).toHaveTextContent('Decimal3');
    await expectNoAxeViolations(container);
  });
});

describe('FrameStrip', () => {
  // FIFO, 3 frames, refs 7 0 1 2 0.
  const columns: FrameColumn[] = [
    { ref: 7, frames: [7, null, null], fault: true, loaded: 0 },
    { ref: 0, frames: [7, 0, null], fault: true, loaded: 1 },
    { ref: 1, frames: [7, 0, 1], fault: true, loaded: 2 },
    { ref: 2, frames: [2, 0, 1], fault: true, loaded: 0, evicted: 7 },
    { ref: 0, frames: [2, 0, 1], fault: false },
  ];

  it('fills columns up to the step, marks loads and evictions, and counts', () => {
    render(<FrameStrip columns={columns} step={3} />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows[0]).toHaveTextContent('Reference70120');
    expect(within(table).getAllByRole('columnheader')[3]).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(rows[1]).toHaveTextContent('Frame 07in772in, 7 out');
    expect(rows.at(-1)).toHaveTextContent('Resultfaultfaultfaultfault');
    expect(screen.getByText('After 4 references: 4 faults, 0 hits.')).toBeInTheDocument();
    expect(faultCount(columns, 4)).toBe(4);
  });

  it('shows use bits and the hand in Clock mode, and is axe clean', async () => {
    const clock: FrameColumn[] = [
      { ref: 1, frames: [1, null], fault: true, loaded: 0, useBits: [1, 0], hand: 1 },
      { ref: 2, frames: [1, 2], fault: true, loaded: 1, useBits: [1, 1], hand: 0 },
    ];
    const { container } = render(<FrameStrip columns={clock} step={1} mode="clock" />);
    expect(screen.getAllByText('u=1')).toHaveLength(3);
    expect(screen.getAllByText('hand')).toHaveLength(2);
    await expectNoAxeViolations(container);
  });
});

describe('MatrixTable', () => {
  const base = {
    caption: 'Need',
    rowLabels: ['P0', 'P1'],
    columnLabels: ['A', 'B'],
    values: [
      [3, 1],
      [1, 0],
    ],
    vector: { label: 'Work', values: [2, 1] },
  };

  it('compares the highlighted row with the vector, in words', () => {
    expect(compareRow([1, 0], [2, 1])).toEqual({ cells: [true, true], all: true });
    expect(compareRow([3, 1], [2, 1]).all).toBe(false);

    const { rerender } = render(<MatrixTable {...base} highlightRow={0} compare />);
    expect(screen.getByTestId('matrix-compare')).toHaveTextContent(
      'Need[P0] ≤ Work: no, at least one resource does not fit',
    );
    expect(screen.getByText('exceeds Work', { exact: false })).toBeInTheDocument();
    rerender(<MatrixTable {...base} highlightRow={1} compare />);
    expect(screen.getByTestId('matrix-compare')).toHaveTextContent(
      'yes, every resource fits',
    );
  });

  it('marks changed cells in text and is axe clean', async () => {
    const { container } = render(
      <MatrixTable {...base} highlightRow={1} changed={[{ row: 1, col: 0 }]} />,
    );
    const cell = container.querySelector('[data-changed]')!;
    expect(cell).toHaveTextContent('1(changed)');
    expect(
      screen.getByRole('rowheader', { name: /^P1 ?\(this step\)$/ }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('parses cell input strictly', () => {
    expect(parseCell('4', 0, 9)).toBe(4);
    expect(parseCell(' 4 ', 0, 9)).toBe(4);
    for (const bad of ['', '-1', '10', '2.5', 'x', '1e1']) {
      expect(parseCell(bad, 0, 9)).toBeNull();
    }
  });

  it('is editable with labelled number inputs, committing only valid values', async () => {
    const onChange = vi.fn();
    function Editable() {
      const [values, setValues] = useState(base.values.map((row) => [...row]));
      return (
        <MatrixTable
          {...base}
          values={values}
          editable
          max={9}
          onChange={(r, c, v) => {
            onChange(r, c, v);
            setValues((old) =>
              old.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)),
            );
          }}
        />
      );
    }
    const { container } = render(<Editable />);
    const input = screen.getByRole('spinbutton', { name: 'Need, P1, B' });
    fireEvent.change(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith(1, 1, 7);
    expect(input).toHaveValue(7);

    onChange.mockClear();
    fireEvent.change(input, { target: { value: '12' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.blur(input);
    expect(input).toHaveValue(7);
    expect(input).not.toHaveAttribute('aria-invalid');
    await expectNoAxeViolations(container);
  });
});

describe('MetricsTable', () => {
  it('finds the best column, ties included, and the column means', () => {
    expect(bestColumns([3, 1, 1], 'lower')).toEqual([1, 2]);
    expect(bestColumns([3, null, 5], 'higher')).toEqual([2]);
    expect(bestColumns([null], 'lower')).toEqual([]);
    expect(
      columnMeans(
        [
          { id: 'a', label: 'a', values: [1, null] },
          { id: 'b', label: 'b', values: [2, null] },
        ],
        2,
      ),
    ).toEqual([1.5, null]);
    expect(formatMetric(10 / 3)).toBe('3.33');
    expect(formatMetric(4)).toBe('4');
  });

  it('marks the best with an icon and the word, and adds an averages row', async () => {
    const { container } = render(
      <MetricsTable
        caption="Compare"
        columns={[
          { id: 'fcfs', label: 'FCFS' },
          { id: 'sjf', label: 'SJF' },
        ]}
        rows={[
          { id: 'wait', label: 'Avg waiting', values: [5, 3], better: 'lower' },
          { id: 'tput', label: 'Throughput', values: [0.3, 0.3], better: 'higher' },
        ]}
        average="Average"
      />,
    );
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Avg waiting53best');
    expect(rows[2]).toHaveTextContent('Throughput0.3best0.3best');
    expect(rows[3]).toHaveTextContent('Average2.651.65');
    expect(container.querySelectorAll('[data-best]')).toHaveLength(3);
    await expectNoAxeViolations(container);
  });
});

describe('MiniLineChart', () => {
  it('keeps end labels apart without reordering them', () => {
    expect(spreadLabels([50, 10, 90], 13)).toEqual([50, 10, 90]);
    const ys = spreadLabels([100, 100, 100], 13);
    expect(ys).toEqual([87, 100, 113]);
  });

  it('breaks a line at a gap', () => {
    expect(
      linePath(
        [1, null, 2, 3],
        (i) => i,
        (v) => v,
      ),
    ).toBe('M0 1 M2 2 L3 3');
  });

  it('summarises every line, labels each one, and has a table view', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MiniLineChart
        title="Faults vs frames"
        xLabel="Frames"
        yLabel="Faults"
        x={[1, 2, 3]}
        series={[
          { id: 'fifo', label: 'FIFO', values: [10, 8, 9] },
          { id: 'lru', label: 'LRU', values: [10, 7, 5] },
        ]}
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAccessibleName(
      'Faults vs frames. FIFO: 1 → 10, 2 → 8, 3 → 9; LRU: 1 → 10, 2 → 7, 3 → 5.',
    );
    expect(within(img).getByText('FIFO')).toBeInTheDocument();
    expect(within(img).getByText('LRU')).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'FramesFIFOLRU',
      '11010',
      '287',
      '395',
    ]);
    await expectNoAxeViolations(container);
  });
});
