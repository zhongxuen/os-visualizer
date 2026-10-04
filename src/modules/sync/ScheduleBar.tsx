'use client';

import { useId } from 'react';

import { Button } from '@/components/timeline/ui/Button';
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

/**
 * Who decides which thread runs each tick: you (manual, keys 1, 2, 3), round robin with
 * a quantum, or a seeded random scheduler whose seed is shown and kept in the link.
 *
 * Switching to manual from another schedule keeps the run so far up to the tick on
 * screen, so a round-robin run can be taken over by hand at any point.
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

export function ScheduleBar({
  schedule,
  threads,
  trace,
  onChange,
  onTakeOver,
}: ScheduleBarProps) {
  const name = useId();
  const keys = Array.from({ length: threads }, (_, t) => String(t + 1)).join(', ');

  return (
    <div className="flex flex-col gap-3">
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
          onChange={(quantum) => onChange({ kind: 'rr', quantum })}
        />
      ) : null}

      {schedule.kind === 'random' ? (
        <div className="flex items-end gap-2">
          <IntField
            label="Seed"
            value={schedule.seed}
            min={0}
            max={MAX_SEED}
            onChange={(seed) => onChange({ kind: 'random', seed })}
            className="flex-1"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onChange({ kind: 'random', seed: (schedule.seed + 1) % (MAX_SEED + 1) })
            }
          >
            Next seed
          </Button>
        </div>
      ) : null}

      {schedule.kind === 'manual' ? (
        <>
          <p className="text-caption text-fg-muted">
            Press {keys} (or a thread’s Run button) to run that thread’s next op. Here
            these keys pick threads instead of setting the speed. Picking after stepping
            back replaces the rest of the run.
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
          {trace.length === 0 ? 'nothing yet' : trace.map(threadName).join(' ')}
        </p>
      </div>
    </div>
  );
}
