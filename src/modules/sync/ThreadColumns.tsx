'use client';

import { Lock } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import { DURATION, Ticker, useStepTransition } from '@/components/motion';
import { ProcessChip } from '@/components/shell/ProcessChip';
import { Button } from '@/components/timeline/ui/Button';
import { Kbd } from '@/components/timeline/ui/Kbd';
import type { SyncSnapshot } from '@/core/sync/events';
import { formatOp, threadName, type Program } from '@/core/sync/program';
import { cn } from '@/lib/cn';

import { threadStatusText } from './adapters';
import { threadKey } from './shortcuts';

/**
 * One column per thread: its ops with the program counter, its registers and its state.
 * A thread that can't run is greyed out, shows a lock icon and says why in words
 * ("Asleep on full"), so the state never rests on the shading alone.
 *
 * Motion (docs/UIUX.md §7.2.6): the program-counter arrow steps down to the next op on a
 * forward step and is simply in place after any other change; a waiting thread's lock
 * icon pulses slowly (the shared idle pulse, which reduced motion stills). Registers
 * roll (`Ticker`).
 *
 * With a manual schedule, each column has a "Run" button (key A, B or C, `shortcuts.ts`)
 * for the thread, enabled only when that thread can make progress.
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

/**
 * The ▶ beside the next op: one element per thread, moved with `transform` to the row it
 * points at. Its place is measured from the row, so wrapped op text never misplaces it;
 * the row itself also carries the ring and `aria-current`, so nothing rests on the
 * arrow alone.
 */
function usePcArrow(pc: number, visible: boolean) {
  const listRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const { scale } = useStepTransition();
  const duration = scale(DURATION.move);

  useLayoutEffect(() => {
    const list = listRef.current;
    const arrow = arrowRef.current;
    if (!list || !arrow) return;
    const place = (ms: number) => {
      const row = list.querySelector<HTMLElement>(`[data-op="${pc}"]`);
      if (!row || !visible) {
        arrow.style.opacity = '0';
        return;
      }
      arrow.style.transitionDuration = `${ms}ms`;
      arrow.style.transform = `translateY(${row.offsetTop}px)`;
      arrow.style.height = `${row.offsetHeight}px`;
      arrow.style.opacity = '1';
    };
    place(duration);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => place(0));
    observer.observe(list);
    return () => observer.disconnect();
  }, [pc, visible, duration]);

  return { listRef, arrowRef };
}

function ThreadColumn({
  program,
  snapshot,
  t,
  onPick,
}: ThreadColumnsProps & { t: number }) {
  const thread = program.threads[t]!;
  const name = threadName(t);
  const pc = snapshot.pcs[t] ?? 0;
  const status = snapshot.status[t];
  const waiting = status === 'blocked' || status === 'spinning';
  const idle = waiting || status === 'done';
  const canPick = snapshot.next.includes(t);
  const regs = Object.entries(snapshot.regs[t] ?? {});
  const ranNow = snapshot.last?.thread === t ? snapshot.last.op : null;
  const key = threadKey(t);
  const { listRef, arrowRef } = usePcArrow(pc, status !== 'done');

  return (
    <li
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
          className={cn(
            'text-caption inline-flex items-center gap-1',
            idle ? 'text-fg-muted' : 'text-fg',
          )}
        >
          {waiting ? (
            <Lock
              aria-hidden="true"
              data-waiting=""
              className="motion-safe:animate-idle-pulse size-3.5 shrink-0"
            />
          ) : null}
          <span data-testid={`thread-status-${t}`}>{threadStatusText(snapshot, t)}</span>
        </span>
      </div>
      <div ref={listRef} className="relative">
        <span
          ref={arrowRef}
          aria-hidden="true"
          data-pc-arrow=""
          className="text-accent text-small pointer-events-none absolute top-0 left-1.5 flex w-4 items-center justify-center font-mono opacity-0 transition-transform ease-(--ease-out)"
        >
          ▶
        </span>
        <ol
          aria-label={`${name} ops`}
          className={cn(
            'text-small flex flex-col font-mono',
            idle && 'text-fg-secondary',
          )}
        >
          {thread.ops.map((op, i) => {
            const next = i === pc && status !== 'done';
            const done = i < pc;
            return (
              <li
                key={i}
                data-op={i}
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
                  {done ? '✓' : ''}
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
      </div>
      {regs.length > 0 ? (
        <p className="text-caption text-fg-secondary font-mono">
          <span className="sr-only">
            {name} registers: {regs.map(([reg, value]) => `${reg} = ${value}`).join(', ')}
          </span>
          <span aria-hidden="true">
            {regs.map(([reg, value], i) => (
              <span key={reg}>
                {i > 0 ? ', ' : ''}
                {reg} = <Ticker value={value} />
              </span>
            ))}
          </span>
        </p>
      ) : null}
      {onPick ? (
        <Button
          size="sm"
          variant={canPick ? 'primary' : 'secondary'}
          disabled={!canPick}
          aria-keyshortcuts={key}
          onClick={() => onPick(t)}
          className="gap-2"
        >
          <span>
            Run {name} <span className="sr-only">next op</span>
          </span>
          {key ? <Kbd aria-hidden="true">{key}</Kbd> : null}
        </Button>
      ) : null}
    </li>
  );
}

export function ThreadColumns({ program, snapshot, onPick }: ThreadColumnsProps) {
  return (
    <ol
      aria-label="Threads"
      className={cn('grid gap-3', COLUMNS[program.threads.length])}
    >
      {program.threads.map((_, t) => (
        <ThreadColumn
          key={t}
          program={program}
          snapshot={snapshot}
          t={t}
          onPick={onPick}
        />
      ))}
    </ol>
  );
}
