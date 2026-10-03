'use client';

import { useMemo, useState, type ReactNode } from 'react';

import { BitField } from '@/components/blocks/BitField';
import { FrameStrip } from '@/components/blocks/FrameStrip';
import { GanttChart } from '@/components/blocks/GanttChart';
import { MatrixTable } from '@/components/blocks/MatrixTable';
import { MetricsTable } from '@/components/blocks/MetricsTable';
import { MiniLineChart } from '@/components/blocks/MiniLineChart';
import { QueueView } from '@/components/blocks/QueueView';

import {
  ADDRESS_FIELDS,
  addressAt,
  BANKER_ALLOCATION,
  BANKER_AVAILABLE,
  BANKER_MAX,
  BANKER_PROCESSES,
  BELADY,
  COMPARE,
  FCFS_PER_PROCESS,
  fcfsSegments,
  frameColumns,
  MLFQ_LANES,
  MLFQ_SEGMENTS,
  need,
  queueAt,
  REFERENCES,
  RESOURCES,
} from './fakeBlocks';
import type { DemoEvent } from './fakeRun';

/**
 * Every building block, driven by the fake run's position. `reached` is the index of the
 * event on screen and `cursor` the ticks elapsed after it, so every block moves with the
 * one timeline: Space, the arrow keys, Home and End drive them all.
 */

function Block({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="text-lead font-semibold">
          {title}
        </h2>
        <p className="text-fg-muted text-small">{note}</p>
      </div>
      {children}
    </section>
  );
}

export function BlocksDemo({
  event,
  reached,
  cursor,
}: {
  event: DemoEvent | undefined;
  reached: number;
  cursor: number;
}) {
  const [clock, setClock] = useState(false);
  const [max, setMax] = useState(() => BANKER_MAX.map((row) => [...row]));

  const fcfs = useMemo(() => fcfsSegments(), []);
  const columns = useMemo(
    () => frameColumns(REFERENCES, 3, clock ? 'clock' : 'fifo'),
    [clock],
  );
  const queue = queueAt(event, reached);
  const address = addressAt(reached);
  const needRows = need(max, BANKER_ALLOCATION);
  const bankerRow = reached % BANKER_PROCESSES.length;

  return (
    <div className="mt-8 flex flex-col gap-10">
      <Block
        id="gantt-heading"
        title="Two Gantt charts, one cursor"
        note="Both charts take the same tick from the timeline. The second has MLFQ lanes, a context switch and idle time (hand-drawn, not a real MLFQ run)."
      >
        <GanttChart segments={fcfs} tick={cursor} endTick={9} title="Gantt chart, FCFS" />
        <GanttChart
          segments={MLFQ_SEGMENTS}
          tick={cursor}
          endTick={9}
          lanes={MLFQ_LANES}
          future="fade"
          title="Gantt chart, MLFQ lanes"
        />
      </Block>

      <Block
        id="queue-heading"
        title="Queue view"
        note="The FCFS ready queue at this tick, from the fake run."
      >
        <QueueView
          running={queue.running}
          queues={[{ id: 'ready', label: 'Ready queue', items: queue.ready }]}
          waiting={[]}
        />
      </Block>

      <Block
        id="bits-heading"
        title="Bit field"
        note="A 32-bit address split for a two-level page table. The highlighted field moves with each step."
      >
        <BitField
          value={address.value}
          fields={ADDRESS_FIELDS}
          highlight={address.highlight}
          label="Virtual address"
        />
      </Block>

      <Block
        id="frames-heading"
        title="Frame strip"
        note="Reference string 7 0 1 2 0 3 0 4 2 with three frames, one reference per step."
      >
        <label className="text-small inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={clock}
            onChange={(e) => setClock(e.target.checked)}
            className="accent-accent size-4"
          />
          Clock mode (use bits and the hand) instead of FIFO
        </label>
        <FrameStrip
          columns={columns}
          step={reached}
          mode={clock ? 'clock' : 'plain'}
          caption={clock ? 'Clock, 3 frames' : 'FIFO, 3 frames'}
        />
      </Block>

      <Block
        id="matrix-heading"
        title="Matrix table"
        note="OSC10's Banker's example. Read-only Need compares one row with Available per step; Max below is editable and Need follows it."
      >
        <MatrixTable
          caption="Need"
          rowLabels={BANKER_PROCESSES}
          columnLabels={RESOURCES}
          values={needRows}
          vector={{ label: 'Available', values: BANKER_AVAILABLE }}
          highlightRow={bankerRow}
          compare
          changed={[{ row: bankerRow, col: reached % RESOURCES.length }]}
        />
        <MatrixTable
          caption="Max (editable)"
          rowLabels={BANKER_PROCESSES}
          columnLabels={RESOURCES}
          values={max}
          editable
          min={0}
          max={20}
          onChange={(r, c, v) =>
            setMax((old) =>
              old.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)),
            )
          }
        />
      </Block>

      <Block
        id="metrics-heading"
        title="Metrics table"
        note="Per-process FCFS metrics with an averages row, and FCFS against Round Robin with the best of each row marked."
      >
        <MetricsTable
          caption="FCFS, per process"
          columns={FCFS_PER_PROCESS.columns}
          rows={FCFS_PER_PROCESS.rows}
          average="Average"
        />
        <MetricsTable
          caption="FCFS vs RR"
          columns={COMPARE.columns}
          rows={COMPARE.rows}
        />
      </Block>

      <Block
        id="line-heading"
        title="Mini line chart"
        note="Belady's anomaly: FIFO makes more faults with four frames than with three."
      >
        <MiniLineChart
          title="Faults vs frames, Belady's string"
          xLabel="Frames"
          yLabel="Faults"
          x={BELADY.x}
          series={BELADY.series}
        />
      </Block>
    </div>
  );
}
