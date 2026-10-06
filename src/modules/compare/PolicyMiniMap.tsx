'use client';

import type { GanttSegment } from '@/components/blocks/GanttChart';
import { processSlot } from '@/components/shell/processPalette';
import { cn } from '@/lib/cn';

/**
 * The phone's overview of every run (C1): one thin strip per policy, all on the same
 * time axis with the shared cursor, so the policy on screen can be seen against the
 * others. Pressing a strip shows that policy.
 *
 * It is a pointer shortcut only, hidden from assistive technology: the segmented
 * control above it is the accessible way to switch, and each chart has its own text
 * summary.
 */

const H = 10;

function fill(segment: GanttSegment): string {
  if (segment.kind === 'run') return `var(--proc-${processSlot(segment.pid ?? 0)})`;
  if (segment.kind === 'cs') return 'var(--idle-stroke)';
  return 'var(--idle-fill)';
}

export interface MiniMapRun {
  name: string;
  segments: readonly GanttSegment[];
  /** When the run finished. */
  ticks: number;
}

export function PolicyMiniMap({
  runs,
  tick,
  endTick,
  shown,
  onShow,
}: {
  runs: readonly MiniMapRun[];
  tick: number;
  endTick: number;
  shown: number;
  onShow: (index: number) => void;
}) {
  const end = Math.max(1, endTick);
  const x = (t: number) => (t / end) * 100;
  return (
    <div aria-hidden="true" data-testid="mini-map" className="flex flex-col gap-1">
      {runs.map((run, i) => (
        <div
          key={i}
          data-shown={i === shown ? '' : undefined}
          onClick={() => onShow(i)}
          className={cn(
            'grid cursor-pointer grid-cols-[5.5rem_1fr] items-center gap-2 rounded px-1 py-0.5',
            i === shown && 'bg-surface-overlay',
          )}
        >
          <span
            className={cn(
              'text-caption truncate font-mono',
              i === shown ? 'text-fg font-semibold' : 'text-fg-secondary',
            )}
          >
            {run.name}
          </span>
          <svg
            viewBox={`0 0 100 ${H}`}
            preserveAspectRatio="none"
            className={cn(
              'border-border block h-2.5 w-full rounded-sm border',
              i !== shown && 'opacity-60',
            )}
          >
            {run.segments
              .filter((s) => s.start < tick)
              .map((s, j) => (
                <rect
                  key={j}
                  x={x(s.start)}
                  y={0}
                  width={x(Math.min(s.end, tick)) - x(s.start)}
                  height={H}
                  fill={fill(s)}
                />
              ))}
            <line
              x1={x(Math.min(tick, end))}
              x2={x(Math.min(tick, end))}
              y1={0}
              y2={H}
              stroke="var(--accent)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            {run.ticks < end ? (
              <line
                x1={x(run.ticks)}
                x2={x(run.ticks)}
                y1={0}
                y2={H}
                stroke="var(--text-secondary)"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
        </div>
      ))}
    </div>
  );
}
