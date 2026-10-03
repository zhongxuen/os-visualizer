'use client';

import { useId } from 'react';

import { ProcessPatternDefs } from '@/components/shell/ProcessPatternDefs';
import { processPatternId, processSlot } from '@/components/shell/processPalette';
import { cn } from '@/lib/cn';

import { ChartTableToggle } from './ChartTableToggle';

/**
 * The Gantt chart: who held the CPU over time, one bar per run segment.
 *
 * Plain data in, no module knowledge: the scheduling module turns its run into
 * `GanttSegment`s. Three kinds of segment, each drawn differently and never by colour
 * alone:
 *
 * - `run`: the process's patterned fill with its PID as text on a plain backing.
 * - `idle`: plain grey with the word "idle".
 * - `cs` (context switch): hatched grey with "CS".
 *
 * **The cursor is a prop.** `tick` is how many ticks have elapsed; the chart draws
 * everything before it and hides (or fades, `future="fade"`) everything after. The chart
 * owns no playback state, so several charts given the same `tick` share one cursor
 * (Compare draws one per policy).
 *
 * **MLFQ lanes.** Pass `lanes` and give each segment a `lane`: one row per queue level, so
 * a demotion shows as a bar moving down a row. Without `lanes` there is one row, "CPU".
 *
 * Accessible as an image with a text summary of what has run so far, and as a table
 * through `ChartTableToggle`. No tweening: the cursor jumps, so reduced motion has
 * nothing to turn off.
 */

export type GanttKind = 'run' | 'idle' | 'cs';

export interface GanttSegment {
  /** First tick of the segment. */
  start: number;
  /** Tick the segment ends at (exclusive). */
  end: number;
  kind: GanttKind;
  /** The process, for `run` segments. */
  pid?: number;
  /** Lane id (MLFQ queue level), when the chart has `lanes`. */
  lane?: number;
}

export interface GanttLane {
  id: number;
  /** Shown in the gutter and the table, e.g. "Q0 (q = 2)". */
  label: string;
}

export interface GanttChartProps {
  segments: readonly GanttSegment[];
  /** The cursor: ticks elapsed. Bars after it are hidden or faded. */
  tick: number;
  /** Length of the axis. Defaults to the last segment's end. */
  endTick?: number;
  lanes?: readonly GanttLane[];
  /** What to do with bars after the cursor. */
  future?: 'hide' | 'fade';
  /** Names the chart, e.g. "Gantt chart, Round Robin". */
  title?: string;
  className?: string;
}

const UNIT = 32;
const LANE_H = 36;
const BAR_PAD = 4;
const TOP = 24;
const AXIS_H = 26;
const RIGHT_PAD = 16;

/** The part of each segment before the cursor; segments wholly after it are dropped. */
export function clipSegments(
  segments: readonly GanttSegment[],
  tick: number,
): GanttSegment[] {
  const out: GanttSegment[] = [];
  for (const segment of segments) {
    if (segment.start >= tick || segment.end <= segment.start) continue;
    out.push({ ...segment, end: Math.min(segment.end, tick) });
  }
  return out;
}

export function segmentName(segment: GanttSegment): string {
  if (segment.kind === 'idle') return 'idle';
  if (segment.kind === 'cs') return 'context switch';
  return `P${segment.pid ?? '?'}`;
}

function shortLabel(segment: GanttSegment): string {
  if (segment.kind === 'idle') return 'idle';
  if (segment.kind === 'cs') return 'CS';
  return `P${segment.pid ?? '?'}`;
}

function laneName(lanes: readonly GanttLane[] | undefined, id: number | undefined) {
  return lanes?.find((lane) => lane.id === id)?.label;
}

/** The text a screen reader hears for the chart: everything up to the cursor. */
export function ganttSummary(
  segments: readonly GanttSegment[],
  tick: number,
  { title = 'Gantt chart', lanes }: { title?: string; lanes?: readonly GanttLane[] } = {},
): string {
  const visible = clipSegments(segments, tick);
  if (visible.length === 0) return `${title} at t = ${tick}: nothing has run yet.`;
  const parts = visible.map((segment) => {
    const lane = lanes ? laneName(lanes, segment.lane) : undefined;
    return `${segmentName(segment)} ${segment.start}–${segment.end}${lane ? ` in ${lane}` : ''}`;
  });
  return `${title} at t = ${tick}: ${parts.join(', ')}.`;
}

/** Which ticks get a number on the axis: every one up to 20, then every 5 or 10. */
export function axisLabels(endTick: number): number[] {
  const step = endTick <= 20 ? 1 : endTick <= 60 ? 5 : 10;
  const labels: number[] = [];
  for (let t = 0; t <= endTick; t += step) labels.push(t);
  if (labels[labels.length - 1] !== endTick) labels.push(endTick);
  return labels;
}

function Bar({
  segment,
  x,
  y,
  hatchId,
  faded,
}: {
  segment: GanttSegment;
  x: (t: number) => number;
  y: number;
  hatchId: string;
  faded?: boolean;
}) {
  const left = x(segment.start);
  const width = x(segment.end) - left;
  const height = LANE_H - BAR_PAD * 2;
  const label = shortLabel(segment);
  const labelWidth = label.length * 7.5 + 6;
  const fits = width >= labelWidth + 2 && !faded;
  const cx = left + width / 2;
  const cy = y + LANE_H / 2;

  let fill: string;
  if (segment.kind === 'run') fill = `url(#${processPatternId(segment.pid ?? 0)})`;
  else if (segment.kind === 'cs') fill = `url(#${hatchId})`;
  else fill = 'var(--idle-fill)';

  return (
    <g opacity={faded ? 0.3 : undefined} data-kind={segment.kind}>
      <rect
        x={left}
        y={y + BAR_PAD}
        width={width}
        height={height}
        rx={3}
        fill={fill}
        stroke={segment.kind === 'run' ? 'var(--proc-ink)' : 'var(--idle-stroke)'}
      />
      {fits ? (
        <>
          <rect
            x={cx - labelWidth / 2}
            y={cy - 8}
            width={labelWidth}
            height={16}
            rx={2}
            fill={
              segment.kind === 'run'
                ? `var(--proc-${processSlot(segment.pid ?? 0)})`
                : 'var(--idle-fill)'
            }
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={600}
            className="font-mono"
            fill={segment.kind === 'run' ? 'var(--proc-ink)' : 'var(--text-secondary)'}
          >
            {label}
          </text>
        </>
      ) : null}
    </g>
  );
}

export function GanttChart({
  segments,
  tick,
  endTick,
  lanes,
  future = 'hide',
  title = 'Gantt chart',
  className,
}: GanttChartProps) {
  const rawId = useId();
  const hatchId = `gantt-cs-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const end = Math.max(
    1,
    endTick ?? segments.reduce((max, s) => Math.max(max, s.end), 0),
  );
  const cursor = Math.max(0, Math.min(tick, end));
  const rows = lanes && lanes.length > 0 ? lanes : [{ id: 0, label: 'CPU' }];
  const gutter = Math.max(48, ...rows.map((row) => row.label.length * 7 + 16));
  const width = gutter + end * UNIT + RIGHT_PAD;
  const lanesBottom = TOP + rows.length * LANE_H;
  const height = lanesBottom + AXIS_H;
  const x = (t: number) => gutter + t * UNIT;
  const laneY = (id: number | undefined) => {
    const index = rows.findIndex((row) => row.id === id);
    return TOP + Math.max(0, index) * LANE_H;
  };

  const visible = clipSegments(segments, cursor);
  const summary = ganttSummary(segments, cursor, { title, lanes });
  const cursorAnchor = cursor === end ? 'end' : cursor === 0 ? 'start' : 'middle';

  const chart = (
    <div
      // Scrolls sideways on a narrow screen, so it must be reachable by keyboard.
      tabIndex={0}
      role="group"
      aria-label={`${title}, scrollable`}
      className="border-border bg-surface-raised overflow-x-auto rounded-lg border"
    >
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block max-w-none"
      >
        <defs>
          <pattern
            id={hatchId}
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={6} height={6} fill="var(--idle-fill)" />
            <rect width={2} height={6} fill="var(--idle-stroke)" />
          </pattern>
        </defs>
        <ProcessPatternDefs />

        {rows.map((row, i) => (
          <g key={row.id}>
            <line
              x1={gutter}
              x2={x(end)}
              y1={TOP + (i + 1) * LANE_H}
              y2={TOP + (i + 1) * LANE_H}
              stroke="var(--border)"
              strokeOpacity={0.4}
            />
            <text
              x={gutter - 8}
              y={TOP + i * LANE_H + LANE_H / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={12}
              fill="var(--text-secondary)"
            >
              {row.label}
            </text>
          </g>
        ))}

        {future === 'fade'
          ? segments
              .filter((segment) => segment.end > cursor)
              .map((segment, i) => (
                <Bar
                  key={`f${i}`}
                  segment={{ ...segment, start: Math.max(segment.start, cursor) }}
                  x={x}
                  y={laneY(segment.lane)}
                  hatchId={hatchId}
                  faded
                />
              ))
          : null}
        {visible.map((segment, i) => (
          <Bar
            key={`v${i}`}
            segment={segment}
            x={x}
            y={laneY(segment.lane)}
            hatchId={hatchId}
          />
        ))}

        {/* Tick axis. */}
        <line
          x1={gutter}
          x2={x(end)}
          y1={lanesBottom}
          y2={lanesBottom}
          stroke="var(--border-strong)"
        />
        {Array.from({ length: end + 1 }, (_, t) => (
          <line
            key={t}
            x1={x(t)}
            x2={x(t)}
            y1={lanesBottom}
            y2={lanesBottom + 4}
            stroke="var(--border-strong)"
          />
        ))}
        {axisLabels(end).map((t) => (
          <text
            key={t}
            x={x(t)}
            y={lanesBottom + 16}
            textAnchor="middle"
            fontSize={11}
            className="font-mono"
            fill="var(--text-muted)"
          >
            {t}
          </text>
        ))}

        {/* The cursor. */}
        <g data-testid="gantt-cursor" data-tick={cursor}>
          <line
            x1={x(cursor)}
            x2={x(cursor)}
            y1={TOP - 4}
            y2={lanesBottom}
            stroke="var(--accent)"
            strokeWidth={2}
          />
          <text
            x={x(cursor)}
            y={TOP - 8}
            textAnchor={cursorAnchor}
            fontSize={11}
            fontWeight={600}
            className="font-mono"
            fill="var(--accent)"
          >
            t = {cursor}
          </text>
        </g>
      </svg>
    </div>
  );

  const table = (
    <table className="text-small w-full text-left">
      <caption className="text-fg-muted text-caption mb-1 text-left">
        {title} up to t = {cursor}
      </caption>
      <thead className="text-fg-muted">
        <tr>
          {lanes ? <th scope="col">Queue</th> : null}
          <th scope="col">Process</th>
          <th scope="col">Start</th>
          <th scope="col">End</th>
          <th scope="col">Ticks</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {visible.length === 0 ? (
          <tr>
            <td colSpan={lanes ? 5 : 4} className="font-sans">
              Nothing has run yet.
            </td>
          </tr>
        ) : (
          visible.map((segment, i) => (
            <tr key={i}>
              {lanes ? <td>{laneName(lanes, segment.lane) ?? '—'}</td> : null}
              <td>{segmentName(segment)}</td>
              <td>{segment.start}</td>
              <td>{segment.end}</td>
              <td>{segment.end - segment.start}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <ChartTableToggle
      label={title}
      chart={chart}
      table={table}
      className={cn(className)}
    />
  );
}
