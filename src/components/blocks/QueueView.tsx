import { ProcessChip } from '@/components/shell/ProcessChip';
import { cn } from '@/lib/cn';

/**
 * The scheduler's state at one tick: who is running, the ready queue(s) in order, and
 * who is waiting on I/O. One queue for most policies; MLFQ passes one per level.
 *
 * Order is the point, so each queue is an ordered list with its head marked in words
 * ("next"), not by position alone.
 */

export interface QueueItem {
  pid: number;
  /** Remaining burst, shown beside the chip. */
  remaining?: number;
  /** Any other text for the chip, e.g. "I/O until t = 9". */
  detail?: string;
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
}

function itemDetail(item: QueueItem): string | undefined {
  const parts: string[] = [];
  if (item.remaining !== undefined) parts.push(`${item.remaining} left`);
  if (item.detail) parts.push(item.detail);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function Items({ label, items }: { label: string; items: readonly QueueItem[] }) {
  if (items.length === 0) {
    return <p className="text-fg-muted text-small">Empty</p>;
  }
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-2">
      {items.map((item, i) => (
        <li key={item.pid} className="flex items-center gap-1">
          <ProcessChip pid={item.pid} detail={itemDetail(item)} />
          {i === 0 ? (
            <span className="text-caption text-fg-muted font-semibold">(next)</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function QueueView({ running, queues, waiting, className }: QueueViewProps) {
  return (
    <div
      className={cn(
        'border-border bg-surface-raised flex flex-col gap-3 rounded-lg border p-4',
        className,
      )}
    >
      <div>
        <h3 className="text-small text-fg-muted font-semibold">Running</h3>
        <div className="mt-1" data-testid="queue-running">
          {running ? (
            <ProcessChip pid={running.pid} detail={itemDetail(running)} />
          ) : (
            <span className="text-small">Idle: nothing is ready</span>
          )}
        </div>
      </div>
      {queues.map((queue) => (
        <div key={queue.id}>
          <h3 className="text-small text-fg-muted font-semibold">{queue.label}</h3>
          <div className="mt-1">
            <Items label={queue.label} items={queue.items} />
          </div>
        </div>
      ))}
      {waiting ? (
        <div>
          <h3 className="text-small text-fg-muted font-semibold">Waiting on I/O</h3>
          <div className="mt-1">
            <Items label="Waiting on I/O" items={waiting} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
