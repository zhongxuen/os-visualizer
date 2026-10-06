'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';

import { DrawPath } from '@/components/motion/DrawPath';
import { DURATION } from '@/components/motion/tokens';
import { useStepTransition } from '@/components/motion/useStepTransition';
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
 * through `ChartTableToggle`. No tweening by default: the cursor jumps.
 *
 * **Optional extras (U3.1).** Every one is off unless passed, so a chart without them
 * draws exactly as before:
 *
 * - `zoom`: `'fit'` scales the axis to the chart's width (300 ticks fit a phone), a
 *   number is pixels per tick with a sideways scroll. Default: 32 px per tick.
 * - `followCursor`: when the chart scrolls, keep the cursor in view.
 * - `highlightPid` / `onPidHover`: linked highlighting. The chart dims every other
 *   process's bars, and reports the process under the pointer.
 * - `brackets`: one process's response and turnaround drawn as brackets above the bars,
 *   and its waiting time shaded on its row (docs/UIUX.md S3). Passing the prop at all,
 *   even `null`, reserves the room for them, so hovering never shifts the layout.
 * - `marks`: small notches at a tick (a preemption, a quantum expiry).
 * - `animate`: forward steps glide the cursor and wipe the newest tick in (§7.2.1), for
 *   the step's `useStepTransition` duration; back, jump, reduced motion and speeds 4-5
 *   stay instant.
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

/** One process's metrics drawn on the chart (S3). `null` values are not known yet. */
export interface GanttBrackets {
  pid: number;
  arrival: number;
  /** First tick it ran: arrival -> first run is the response time. */
  firstRun: number | null;
  /** Completion: arrival -> completion is the turnaround time. */
  completion: number | null;
  /** Stretches spent ready but not running (the waiting time), shaded. */
  waiting: readonly { start: number; end: number }[];
  /** The lane to shade in (MLFQ). Defaults to every lane. */
  lane?: number;
}

/** A notch at a tick, e.g. "P1 preempted". */
export interface GanttMark {
  tick: number;
  label: string;
  lane?: number;
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
  /** `'fit'`: the whole axis fits the width. A number: pixels per tick. Default 32. */
  zoom?: 'fit' | number;
  /** Scroll so the cursor stays in view (when the chart is wider than its box). */
  followCursor?: boolean;
  /** Linked highlighting: this process's bars stand out, every other run bar dims. */
  highlightPid?: number | null;
  /** The process under the pointer, or `null` when it leaves the bars. */
  onPidHover?: (pid: number | null) => void;
  /** Response, turnaround and waiting for one process (S3). */
  brackets?: GanttBrackets | null;
  /** Notches at ticks (preemptions, quantum expiries). */
  marks?: readonly GanttMark[];
  /** Glide the cursor and wipe the newest tick in on a forward step. */
  animate?: boolean;
}

const UNIT = 32;
const LANE_H = 36;
const BAR_PAD = 4;
const TOP = 24;
const AXIS_H = 26;
const RIGHT_PAD = 16;
/** Room above the lanes for the two brackets (S3). */
const BRACKET_H = 34;
/** The width a fitted chart assumes before it has been measured. */
const FIT_FALLBACK = 640;

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

/**
 * Axis labels for a given scale: a "nice" step (1, 2, 5, 10, 20, 50, 100) at least
 * `minGap` pixels apart, always ending on `endTick`.
 */
export function axisLabelsFor(endTick: number, unit: number, minGap = 28): number[] {
  const steps = [1, 2, 5, 10, 20, 50, 100];
  const step = steps.find((s) => s * unit >= minGap) ?? 100;
  const labels: number[] = [];
  for (let t = 0; t <= endTick; t += step) labels.push(t);
  const last = labels[labels.length - 1]!;
  if (last !== endTick) {
    // Drop the last regular label if it would collide with the end label.
    if ((endTick - last) * unit < minGap && labels.length > 1) labels.pop();
    labels.push(endTick);
  }
  return labels;
}

function Bar({
  segment,
  x,
  y,
  hatchId,
  faded,
  dimmed,
  highlighted,
  onHover,
}: {
  segment: GanttSegment;
  x: (t: number) => number;
  y: number;
  hatchId: string;
  faded?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  onHover?: (pid: number | null) => void;
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

  const hover =
    onHover && segment.kind === 'run'
      ? {
          onMouseEnter: () => onHover(segment.pid ?? null),
          onMouseLeave: () => onHover(null),
        }
      : {};

  return (
    <g
      opacity={faded ? 0.3 : dimmed ? 0.35 : undefined}
      data-kind={segment.kind}
      data-pid={segment.kind === 'run' ? segment.pid : undefined}
      data-highlight={highlighted ? '' : undefined}
      {...hover}
    >
      <rect
        x={left}
        y={y + BAR_PAD}
        width={width}
        height={height}
        rx={Math.min(3, width / 2)}
        fill={fill}
        stroke={
          highlighted
            ? 'var(--accent)'
            : segment.kind === 'run'
              ? 'var(--proc-ink)'
              : 'var(--idle-stroke)'
        }
        strokeWidth={highlighted ? 2.5 : undefined}
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

/** The width of `ref`'s box, tracked; `null` until measured (and on the server). */
function useBoxWidth(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const measure = () => setWidth(node.clientWidth || null);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, active]);
  return width;
}

function Bracket({
  kind,
  from,
  to,
  y,
  label,
  x,
  trigger,
}: {
  kind: 'response' | 'turnaround';
  from: number;
  to: number;
  y: number;
  label: string;
  x: (t: number) => number;
  trigger: string;
}) {
  const x1 = x(from);
  const x2 = x(to);
  const d =
    x2 - x1 < 1
      ? `M ${x1} ${y + 7} V ${y}`
      : `M ${x1} ${y + 7} V ${y} H ${x2} V ${y + 7}`;
  return (
    <g data-bracket={kind}>
      <DrawPath
        d={d}
        trigger={trigger}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
      <text
        x={x1 + 4}
        y={y - 3}
        fontSize={11}
        fontWeight={600}
        className="font-mono"
        fill="var(--text-secondary)"
      >
        {label}
      </text>
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
  zoom,
  followCursor = false,
  highlightPid = null,
  onPidHover,
  brackets,
  marks,
  animate = false,
}: GanttChartProps) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const hatchId = `gantt-cs-${safeId}`;
  const clipId = `gantt-clip-${safeId}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fit = zoom === 'fit';
  const boxWidth = useBoxWidth(scrollRef, fit);
  const { scale } = useStepTransition();
  const moveMs = animate ? scale(DURATION.move) : 0;

  const end = Math.max(
    1,
    endTick ?? segments.reduce((max, s) => Math.max(max, s.end), 0),
  );
  const cursor = Math.max(0, Math.min(tick, end));
  const rows = lanes && lanes.length > 0 ? lanes : [{ id: 0, label: 'CPU' }];
  const gutter = Math.max(48, ...rows.map((row) => row.label.length * 7 + 16));
  const unit = fit
    ? Math.max(0.5, ((boxWidth ?? FIT_FALLBACK) - 2 - gutter - RIGHT_PAD) / end)
    : typeof zoom === 'number'
      ? zoom
      : UNIT;
  const width = gutter + end * unit + RIGHT_PAD;
  const top = TOP + (brackets !== undefined ? BRACKET_H : 0);
  const lanesBottom = top + rows.length * LANE_H;
  const height = lanesBottom + AXIS_H;
  const x = (t: number) => gutter + t * unit;
  const laneY = (id: number | undefined) => {
    const index = rows.findIndex((row) => row.id === id);
    return top + Math.max(0, index) * LANE_H;
  };

  const visible = clipSegments(segments, cursor);
  const summary = ganttSummary(segments, cursor, { title, lanes });
  const cursorAnchor = cursor === end ? 'end' : cursor === 0 ? 'start' : 'middle';
  const labels = zoom === undefined ? axisLabels(end) : axisLabelsFor(end, unit);
  const minorTicks = unit >= 4;

  // Keep the cursor in view while the chart is wider than its box.
  useEffect(() => {
    const node = scrollRef.current;
    if (!followCursor || !node || node.scrollWidth <= node.clientWidth) return;
    const at = gutter + cursor * unit;
    const margin = Math.min(64, node.clientWidth / 4);
    if (
      at < node.scrollLeft + margin ||
      at > node.scrollLeft + node.clientWidth - margin
    ) {
      node.scrollLeft = Math.max(0, at - node.clientWidth / 2);
    }
  }, [followCursor, cursor, unit, gutter]);

  const glide = (px: number): CSSProperties | undefined =>
    animate
      ? {
          transform: `translateX(${px}px)`,
          transition: moveMs > 0 ? `transform ${moveMs}ms var(--ease-out)` : undefined,
        }
      : undefined;

  const dimOthers = highlightPid !== null && highlightPid !== undefined;
  const bar = (segment: GanttSegment, key: string, faded?: boolean) => {
    const mine = segment.kind === 'run' && segment.pid === highlightPid;
    return (
      <Bar
        key={key}
        segment={segment}
        x={x}
        y={laneY(segment.lane)}
        hatchId={hatchId}
        faded={faded}
        dimmed={!faded && dimOthers && segment.kind === 'run' && !mine}
        highlighted={!faded && dimOthers && mine}
        onHover={onPidHover}
      />
    );
  };

  // S3: what is known about the bracketed process at the cursor.
  const shown = brackets ?? null;
  const shadeTop = shown && shown.lane !== undefined ? laneY(shown.lane) : top;
  const shadeBottom = shown && shown.lane !== undefined ? shadeTop + LANE_H : lanesBottom;
  const waiting = shown
    ? shown.waiting
        .filter((gap) => gap.start < cursor)
        .map((gap) => ({ start: gap.start, end: Math.min(gap.end, cursor) }))
    : [];

  const chart = (
    <div
      ref={scrollRef}
      // Scrolls sideways on a narrow screen, so it must be reachable by keyboard.
      tabIndex={0}
      role="group"
      aria-label={`${title}, scrollable`}
      className="border-border bg-surface-raised overflow-x-auto rounded-lg border"
      onMouseLeave={onPidHover ? () => onPidHover(null) : undefined}
    >
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${width} ${height}`}
        width={fit && boxWidth === null ? '100%' : width}
        height={fit && boxWidth === null ? undefined : height}
        className="block max-w-none"
        data-zoom={zoom === undefined ? undefined : String(zoom)}
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
          {animate ? (
            <clipPath id={clipId}>
              {/* The revealed part: everything left of the cursor, gliding with it. */}
              <rect
                x={-width}
                y={0}
                width={width}
                height={height}
                style={glide(x(cursor))}
              />
            </clipPath>
          ) : null}
        </defs>
        <ProcessPatternDefs />

        {rows.map((row, i) => (
          <g key={row.id}>
            <line
              x1={gutter}
              x2={x(end)}
              y1={top + (i + 1) * LANE_H}
              y2={top + (i + 1) * LANE_H}
              stroke="var(--border)"
              strokeOpacity={0.4}
            />
            <text
              x={gutter - 8}
              y={top + i * LANE_H + LANE_H / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={12}
              fill="var(--text-secondary)"
            >
              {row.label}
            </text>
          </g>
        ))}

        {/* S3: the waiting stretches, shaded under the bars. */}
        {waiting.map((gap) => (
          <rect
            key={`w${gap.start}`}
            data-waiting=""
            x={x(gap.start)}
            y={shadeTop + 1}
            width={Math.max(1, x(gap.end) - x(gap.start))}
            height={shadeBottom - shadeTop - 2}
            fill="var(--warn)"
            fillOpacity={0.16}
            stroke="var(--warn)"
            strokeDasharray="3 2"
          />
        ))}

        {future === 'fade'
          ? segments
              .filter((segment) => segment.end > cursor)
              .map((segment, i) =>
                bar(
                  { ...segment, start: Math.max(segment.start, cursor) },
                  `f${i}`,
                  true,
                ),
              )
          : null}
        <g clipPath={animate ? `url(#${clipId})` : undefined}>
          {visible.map((segment, i) => bar(segment, `v${i}`))}
        </g>

        {/* Notches: preemptions and quantum expiries. */}
        {(marks ?? [])
          .filter((mark) => mark.tick <= cursor)
          .map((mark, i) => {
            const y = laneY(mark.lane);
            const mx = x(mark.tick);
            return (
              <path
                key={`m${i}`}
                data-mark=""
                d={`M ${mx - 4} ${y} L ${mx + 4} ${y} L ${mx} ${y + 6} Z`}
                fill="var(--fg)"
              >
                <title>{mark.label}</title>
              </path>
            );
          })}

        {/* S3: the brackets above the lanes. */}
        {shown ? (
          <g data-brackets={shown.pid}>
            {shown.firstRun !== null && shown.firstRun <= cursor ? (
              <Bracket
                kind="response"
                from={shown.arrival}
                to={shown.firstRun}
                y={TOP + 2}
                x={x}
                trigger={`r${shown.pid}`}
                label={`response ${shown.firstRun - shown.arrival}`}
              />
            ) : null}
            {shown.completion !== null && shown.completion <= cursor ? (
              <Bracket
                kind="turnaround"
                from={shown.arrival}
                to={shown.completion}
                y={TOP + 20}
                x={x}
                trigger={`t${shown.pid}`}
                label={`turnaround ${shown.completion - shown.arrival}`}
              />
            ) : null}
          </g>
        ) : null}

        {/* Tick axis. */}
        <line
          x1={gutter}
          x2={x(end)}
          y1={lanesBottom}
          y2={lanesBottom}
          stroke="var(--border-strong)"
        />
        {(minorTicks ? Array.from({ length: end + 1 }, (_, t) => t) : labels).map((t) => (
          <line
            key={t}
            x1={x(t)}
            x2={x(t)}
            y1={lanesBottom}
            y2={lanesBottom + 4}
            stroke="var(--border-strong)"
          />
        ))}
        {labels.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={lanesBottom + 16}
            textAnchor={zoom !== undefined && t === end ? 'end' : 'middle'}
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
            x1={animate ? 0 : x(cursor)}
            x2={animate ? 0 : x(cursor)}
            y1={top - 4}
            y2={lanesBottom}
            stroke="var(--accent)"
            strokeWidth={2}
            style={glide(x(cursor))}
          />
          <text
            x={x(cursor)}
            y={top - 8}
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
