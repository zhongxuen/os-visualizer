'use client';

import { Check } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { Flash } from '@/components/motion/Flash';
import { Flip } from '@/components/motion/Flip';
import { ProcessChip } from '@/components/shell/ProcessChip';
import { cn } from '@/lib/cn';

/**
 * The scheduler's state at one tick: who is running, the ready queue(s) in order, and
 * who is waiting on I/O. One queue for most policies; MLFQ passes one per level.
 *
 * Order is the point, so each queue is an ordered list with its head marked in words
 * ("next"), not by position alone.
 *
 * Optional (U3.1), off unless passed, so a view without them renders as before:
 * - `highlightPid` / `onPidHover`: linked highlighting. The chip is ringed, and the
 *   process under the pointer is reported.
 * - `done`: a "Done" tray of finished processes, each with a tick.
 * - `animate`: chips glide within their lane when the order changes (`Flip`), and a chip
 *   that has just joined a lane, or the CPU, pulses once (`Flash`). Forward steps only;
 *   the end state is the same static list either way.
 * - `QueueItem.extra`: anything drawn after the chip (a quantum ring).
 */

export interface QueueItem {
  pid: number;
  /** Remaining burst, shown beside the chip. */
  remaining?: number;
  /** Any other text for the chip, e.g. "I/O until t = 9". */
  detail?: string;
  /** Drawn after the chip and its detail, e.g. a quantum ring. */
  extra?: ReactNode;
}

export interface ReadyQueue {
  id: string;
  /** e.g. "Ready queue" or "Q1 (q = 4)". */
  label: string;
  items: readonly QueueItem[];
}

export interface QueueViewProps {
  running: QueueItem | null;
  queues: readonly ReadyQueue[];
  /** The I/O waiting list. Omit to hide it (a workload with no I/O). */
  waiting?: readonly QueueItem[];
  className?: string;
  /** Linked highlighting: ring this process's chip. */
  highlightPid?: number | null;
  /** The process under the pointer, or `null` when it leaves. */
  onPidHover?: (pid: number | null) => void;
  /** Finished processes, shown in a "Done" tray. Omit to hide the tray. */
  done?: readonly QueueItem[];
  /** Glide and pulse chips on a forward step. */
  animate?: boolean;
}

function itemDetail(item: QueueItem): string | undefined {
  const parts: string[] = [];
  if (item.remaining !== undefined) parts.push(`${item.remaining} left`);
  if (item.detail) parts.push(item.detail);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

interface ChipOptions {
  highlightPid?: number | null;
  onPidHover?: (pid: number | null) => void;
}

function Chip({
  item,
  highlightPid,
  onPidHover,
  done,
}: ChipOptions & { item: QueueItem; done?: boolean }) {
  const highlighted =
    highlightPid !== null && highlightPid !== undefined && item.pid === highlightPid;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md',
        highlighted && 'outline-accent outline-2 outline-offset-2',
      )}
      data-pid={item.pid}
      data-highlight={highlighted ? '' : undefined}
      onMouseEnter={onPidHover ? () => onPidHover(item.pid) : undefined}
      onMouseLeave={onPidHover ? () => onPidHover(null) : undefined}
    >
      <ProcessChip pid={item.pid} detail={itemDetail(item)} />
      {done ? (
        <Check role="img" aria-label="finished" className="text-state-ok size-4" />
      ) : null}
      {item.extra}
    </span>
  );
}

function Items({
  label,
  items,
  ...options
}: ChipOptions & { label: string; items: readonly QueueItem[] }) {
  if (items.length === 0) {
    return <p className="text-fg-muted text-small">Empty</p>;
  }
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-2">
      {items.map((item, i) => (
        <li key={item.pid} className="flex items-center gap-1">
          <Chip item={item} {...options} />
          {i === 0 ? (
            <span className="text-caption text-fg-muted font-semibold">(next)</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** A lane whose chips glide when the order changes, and pulse when they join. */
function AnimatedItems({
  label,
  items,
  joined,
  done,
  showNext = true,
  empty = 'Empty',
  ...options
}: ChipOptions & {
  label: string;
  items: readonly QueueItem[];
  joined: (pid: number) => boolean;
  done?: boolean;
  showNext?: boolean;
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-fg-muted text-small">{empty}</p>;
  }
  return (
    <div role="list" aria-label={label}>
      <Flip className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <div key={item.pid} role="listitem" className="flex items-center gap-1">
            <Flash trigger={`${label}:${item.pid}`} active={joined(item.pid)}>
              <Chip item={item} done={done} {...options} />
            </Flash>
            {showNext && i === 0 ? (
              <span className="text-caption text-fg-muted font-semibold">(next)</span>
            ) : null}
          </div>
        ))}
      </Flip>
    </div>
  );
}

/** Which PIDs were in each lane on the previous render, to spot the ones that joined. */
function useJoined(lanes: Record<string, readonly QueueItem[]>, active: boolean) {
  const previous = useRef<Record<string, Set<number>> | null>(null);
  // Read during render on purpose: "joined" means "not here last time this drew".
  const before = previous.current;
  useEffect(() => {
    if (!active) return;
    previous.current = Object.fromEntries(
      Object.entries(lanes).map(([id, items]) => [id, new Set(items.map((i) => i.pid))]),
    );
  });
  return (lane: string) => (pid: number) =>
    before !== null && !(before[lane]?.has(pid) ?? false);
}

export function QueueView({
  running,
  queues,
  waiting,
  className,
  highlightPid,
  onPidHover,
  done,
  animate = false,
}: QueueViewProps) {
  const options = { highlightPid, onPidHover };
  const lanes: Record<string, readonly QueueItem[]> = {
    running: running ? [running] : [],
    waiting: waiting ?? [],
    done: done ?? [],
  };
  for (const queue of queues) lanes[`q:${queue.id}`] = queue.items;
  const joined = useJoined(lanes, animate);

  const lane = (key: string, label: string, items: readonly QueueItem[]) =>
    animate ? (
      <AnimatedItems label={label} items={items} joined={joined(key)} {...options} />
    ) : (
      <Items label={label} items={items} {...options} />
    );

  return (
    <div
      className={cn(
        'border-border bg-surface-raised flex flex-col gap-3 rounded-lg border p-4',
        className,
      )}
    >
      <div>
        <h3 className="text-small text-fg-muted font-semibold">Running</h3>
        <div
          className={cn(
            'mt-1',
            animate && 'min-h-10 rounded-md border border-dashed p-1',
            animate && (running ? 'border-accent border-solid' : 'border-border'),
          )}
          data-testid="queue-running"
        >
          {running ? (
            animate ? (
              <Flash
                trigger={`running:${running.pid}`}
                active={joined('running')(running.pid)}
              >
                <Chip item={running} {...options} />
              </Flash>
            ) : (
              <Chip item={running} {...options} />
            )
          ) : (
            <span className="text-small">Idle: nothing is ready</span>
          )}
        </div>
      </div>
      {queues.map((queue) => (
        <div key={queue.id}>
          <h3 className="text-small text-fg-muted font-semibold">{queue.label}</h3>
          <div className="mt-1">{lane(`q:${queue.id}`, queue.label, queue.items)}</div>
        </div>
      ))}
      {waiting ? (
        <div>
          <h3 className="text-small text-fg-muted font-semibold">Waiting on I/O</h3>
          <div className="mt-1">{lane('waiting', 'Waiting on I/O', waiting)}</div>
        </div>
      ) : null}
      {done ? (
        <div>
          <h3 className="text-small text-fg-muted font-semibold">Done</h3>
          <div className="mt-1">
            {animate ? (
              <AnimatedItems
                label="Done"
                items={done}
                joined={joined('done')}
                done
                showNext={false}
                empty="None yet"
                {...options}
              />
            ) : done.length === 0 ? (
              <p className="text-fg-muted text-small">None yet</p>
            ) : (
              <ul aria-label="Done" className="flex flex-wrap items-center gap-2">
                {done.map((item) => (
                  <li key={item.pid}>
                    <Chip item={item} done {...options} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
