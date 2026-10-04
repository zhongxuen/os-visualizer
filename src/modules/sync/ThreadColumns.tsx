'use client';

import { ProcessChip } from '@/components/shell/ProcessChip';
import { Button } from '@/components/timeline/ui/Button';
import type { SyncSnapshot } from '@/core/sync/events';
import { formatOp, threadName, type Program } from '@/core/sync/program';
import { cn } from '@/lib/cn';

import { threadStatusText } from './adapters';

/**
 * One column per thread: its ops with the program counter, its registers and its state.
 * A thread that can't run is greyed out and says why in words ("Asleep on full"), so the
 * state never rests on the shading alone.
 *
 * With a manual schedule, each column has a "Run next op" button (key 1, 2 or 3) for the
 * thread, enabled only when that thread can make progress.
 */

/** Side by side once there is room; stacked on a narrow phone. */
const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 min-[22rem]:grid-cols-2',
  3: 'grid-cols-1 min-[22rem]:grid-cols-2 sm:grid-cols-3',
};

export interface ThreadColumnsProps {
  program: Program;
  snapshot: SyncSnapshot;
  /** Set for a manual schedule: pick thread `t` to run the next tick. */
  onPick?: (t: number) => void;
}

export function ThreadColumns({ program, snapshot, onPick }: ThreadColumnsProps) {
  return (
    <ol
      aria-label="Threads"
      className={cn('grid gap-3', COLUMNS[program.threads.length])}
    >
      {program.threads.map((thread, t) => {
        const name = threadName(t);
        const pc = snapshot.pcs[t] ?? 0;
        const status = snapshot.status[t];
        const idle = status === 'blocked' || status === 'spinning' || status === 'done';
        const canPick = snapshot.next.includes(t);
        const regs = Object.entries(snapshot.regs[t] ?? {});
        const ranNow = snapshot.last?.thread === t ? snapshot.last.op : null;
        return (
          <li
            key={t}
            className={cn(
              'border-border bg-surface-raised flex min-w-0 flex-col gap-2 rounded-lg border p-3',
              idle && 'bg-surface border-dashed',
            )}
            data-thread={t}
            data-status={status}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ProcessChip pid={t} label={name} />
              <span
                className={cn('text-caption', idle ? 'text-fg-muted' : 'text-fg')}
                data-testid={`thread-status-${t}`}
              >
                {threadStatusText(snapshot, t)}
              </span>
            </div>
            <ol
              aria-label={`${name} ops`}
              className={cn('text-small flex flex-col font-mono', idle && 'opacity-70')}
            >
              {thread.ops.map((op, i) => {
                const next = i === pc && status !== 'done';
                const done = i < pc;
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex items-baseline gap-2 rounded px-1.5 py-0.5',
                      next && 'bg-surface-overlay ring-accent ring-1',
                      i === ranNow && 'font-semibold',
                    )}
                    aria-current={next ? 'step' : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className="text-fg-muted w-4 shrink-0 text-center"
                    >
                      {next ? '▶' : done ? '✓' : ''}
                    </span>
                    <span className={cn('min-w-0', done && 'text-fg-muted')}>
                      {formatOp(op)}
                    </span>
                    <span className="sr-only">
                      {next ? ' (next)' : done ? ' (done)' : ''}
                      {i === ranNow ? ', just ran' : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
            {regs.length > 0 ? (
              <p className="text-caption text-fg-secondary font-mono">
                <span className="sr-only">{name} registers: </span>
                {regs.map(([reg, value]) => `${reg} = ${value}`).join(', ')}
              </p>
            ) : null}
            {onPick ? (
              <Button
                size="sm"
                variant={canPick ? 'primary' : 'secondary'}
                disabled={!canPick}
                aria-keyshortcuts={t < 9 ? String(t + 1) : undefined}
                onClick={() => onPick(t)}
              >
                Run {name} <span className="sr-only">next op</span>
                <span aria-hidden="true" className="opacity-80">
                  {' '}
                  ({t + 1})
                </span>
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
