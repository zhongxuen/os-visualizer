import { processSlot } from '@/components/shell/processPalette';
import { processName } from '@/core/deadlock/model';
import { cn } from '@/lib/cn';

/**
 * A thread, drawn as a **rounded square** (docs/UIUX.md G13, §5.1): Scheduling's
 * processes are pills, so a student who meets T1 here and P1 there sees two different
 * things. The fill and pattern are the shared process palette (`T{n}` takes slot n), and
 * the name is always printed.
 *
 * `state` adds a mark that never relies on colour alone: `done` a tick, `stuck` a red
 * outline and the words "can't finish".
 */

export interface ThreadChipProps {
  t: number;
  state?: 'done' | 'stuck';
  className?: string;
}

export function ThreadChip({ t, state, className }: ThreadChipProps) {
  return (
    <span
      data-thread-chip={processName(t)}
      data-state={state}
      className={cn('inline-flex items-center gap-1', className)}
    >
      <span
        className={cn(
          'proc-fill text-small inline-flex size-8 items-center justify-center rounded-md font-mono font-semibold',
          state === 'stuck' && 'outline-state-error outline-2 outline-offset-1',
        )}
        data-proc={processSlot(t)}
      >
        <span className="rounded-sm [background-color:var(--proc-fill)] px-0.5">
          {processName(t)}
        </span>
      </span>
      {state === 'done' ? (
        <span className="text-state-ok text-caption font-semibold">
          <span aria-hidden="true">✓</span>
          <span className="sr-only">finished</span>
        </span>
      ) : null}
      {state === 'stuck' ? (
        <span className="text-state-error text-caption font-semibold">can’t finish</span>
      ) : null}
    </span>
  );
}
