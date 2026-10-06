'use client';

import { useId } from 'react';

import { Flash } from '@/components/motion';
import { Button } from '@/components/timeline/ui/Button';
import { Kbd } from '@/components/timeline/ui/Kbd';
import {
  MAX_QUANTUM,
  MAX_SEED,
  SCHEDULE_KINDS,
  SCHEDULE_NAMES,
  threadName,
  type Schedule,
  type ScheduleKind,
} from '@/core/sync/program';
import { cn } from '@/lib/cn';

import { IntField } from './fields';
import { threadKey } from './shortcuts';

/**
 * Who decides which thread runs each tick: you (manual, keys A, B, C), round robin with
 * a quantum, or a seeded random scheduler whose seed is shown and kept in the link.
 *
 * Progressive disclosure (G10): what you use while stepping stays in view (the keys,
 * Undo, Clear, the schedule so far); choosing another scheduler and its quantum or seed
 * sits behind "Change who picks".
 *
 * Switching to manual from another schedule keeps the run so far up to the tick on
 * screen, so a round-robin run can be taken over by hand at any point.
 *
 * "Schedule so far" fills in one thread per tick as the run plays; the newest entry
 * flashes on a forward step.
 */

export interface ScheduleBarProps {
  schedule: Schedule;
  threads: number;
  /** The thread that ran on each tick so far, spins included. */
  trace: readonly number[];
  onChange: (schedule: Schedule) => void;
  /** Take the run so far, up to the tick on screen, as manual picks. */
  onTakeOver: () => void;
}

const DEFAULT_SCHEDULE: Record<ScheduleKind, Schedule> = {
  manual: { kind: 'manual', picks: [] },
  rr: { kind: 'rr', quantum: 2 },
  random: { kind: 'random', seed: 1 },
};

/** G11: one sentence per field, in the words of the page. */
export const FIELD_MESSAGES = {
  quantum: `The quantum is a whole number of ticks, from 1 to ${MAX_QUANTUM}.`,
  seed: `The seed is a whole number from 0 to ${MAX_SEED}.`,
} as const;

export function ScheduleBar({
  schedule,
  threads,
  trace,
  onChange,
  onTakeOver,
}: ScheduleBarProps) {
  const name = useId();
  const keys = Array.from({ length: threads }, (_, t) => threadKey(t)).filter(
    (k): k is string => k !== undefined,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small">
        <span className="text-fg-muted">Who picks: </span>
        <span className="font-semibold" data-testid="schedule-kind">
          {SCHEDULE_NAMES[schedule.kind]}
        </span>
      </p>

      {schedule.kind === 'manual' ? (
        <>
          <p className="text-caption text-fg-secondary">
            Press{' '}
            {keys.map((key, t) => (
              <span key={key}>
                {t > 0 ? (t === keys.length - 1 ? ' or ' : ', ') : ''}
                <Kbd>{key}</Kbd>
              </span>
            ))}{' '}
            (or a thread’s Run button) to run the next op of{' '}
            {keys.map((_, t) => threadName(t)).join(keys.length > 2 ? ', ' : ' or ')}.
            Picking after stepping back replaces the rest of the run.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={schedule.picks.length === 0}
              onClick={() =>
                onChange({ kind: 'manual', picks: schedule.picks.slice(0, -1) })
              }
            >
              Undo last pick
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={schedule.picks.length === 0}
              onClick={() => onChange({ kind: 'manual', picks: [] })}
            >
              Clear picks
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" variant="secondary" onClick={onTakeOver}>
          Pick by hand from this tick
        </Button>
      )}

      <div>
        <p className="text-caption text-fg-muted">Schedule so far</p>
        <p
          className={cn(
            'text-small font-mono break-words',
            trace.length === 0 && 'text-fg-muted',
          )}
          data-testid="trace"
        >
          {trace.length === 0
            ? 'nothing yet'
            : trace.map((t, i) => (
                <span key={i}>
                  {i > 0 ? ' ' : ''}
                  {i === trace.length - 1 ? (
                    <Flash trigger={trace.length}>{threadName(t)}</Flash>
                  ) : (
                    threadName(t)
                  )}
                </span>
              ))}
        </p>
      </div>

      <details
        className="group border-border rounded border-t pt-2"
        data-schedule-edit=""
      >
        <summary className="text-small cursor-pointer font-semibold">
          Change who picks
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <fieldset className="flex flex-col gap-1">
            <legend className="text-caption text-fg-muted mb-1">
              Who picks the next thread
            </legend>
            {SCHEDULE_KINDS.map((kind) => (
              <label
                key={kind}
                className="text-small has-[:focus-visible]:outline-focus inline-flex min-h-8 cursor-pointer items-center gap-2 rounded has-[:focus-visible]:outline-2"
              >
                <input
                  type="radio"
                  name={name}
                  value={kind}
                  checked={schedule.kind === kind}
                  onChange={() =>
                    kind === 'manual' ? onTakeOver() : onChange(DEFAULT_SCHEDULE[kind])
                  }
                />
                {SCHEDULE_NAMES[kind]}
              </label>
            ))}
          </fieldset>

          {schedule.kind === 'rr' ? (
            <IntField
              label="Quantum (ticks)"
              value={schedule.quantum}
              min={1}
              max={MAX_QUANTUM}
              message={FIELD_MESSAGES.quantum}
              onChange={(quantum) => onChange({ kind: 'rr', quantum })}
            />
          ) : null}

          {schedule.kind === 'random' ? (
            <div className="flex items-start gap-2">
              <IntField
                label="Seed"
                value={schedule.seed}
                min={0}
                max={MAX_SEED}
                message={FIELD_MESSAGES.seed}
                onChange={(seed) => onChange({ kind: 'random', seed })}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                className="mt-5"
                onClick={() =>
                  onChange({ kind: 'random', seed: (schedule.seed + 1) % (MAX_SEED + 1) })
                }
              >
                Next seed
              </Button>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
