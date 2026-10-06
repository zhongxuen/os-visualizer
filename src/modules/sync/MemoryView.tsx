'use client';

import { Term } from '@/components/glossary';
import { Flip, Ticker } from '@/components/motion';
import { ProcessChip } from '@/components/shell/ProcessChip';
import type { SyncSnapshot } from '@/core/sync/events';
import { threadName, type Program } from '@/core/sync/program';

import type { LostUpdate } from './adapters';

/**
 * Shared memory at the tick on screen: the variables (with the value a correct run ends
 * with, and any range they must stay in), who holds each lock, and each semaphore's value
 * and queue of sleepers. Plain tables, so they read the same to a screen reader.
 *
 * Motion (docs/UIUX.md §7.2.6), all of it on forward steps only:
 * - values roll to their new number (`Ticker`);
 * - a lost update strikes through the value that was overwritten, labelled "lost
 *   update" (Y2). The strike is static, so it stays on a paused frame and at the end,
 *   until the next store to that variable;
 * - a lock's chip glides to the seat of the thread that took it (`Flip`), and a
 *   semaphore's sleepers queue up as chips.
 *
 * Each rolling number is drawn `aria-hidden` and read from a plain copy beside it, which
 * is also what the tests read.
 */

const TABLE = 'w-full text-small';
const TH = 'text-fg-muted text-caption px-2 py-1 text-left font-medium';
const TD = 'border-border border-t px-2 py-1 font-mono align-top';

export interface MemoryViewProps {
  program: Program;
  snapshot: SyncSnapshot;
  /** Variables whose latest store lost an update (`lostUpdatesAt`). */
  lost?: Readonly<Record<string, LostUpdate>>;
}

/** A number that rolls on screen and reads as plain text. */
function Value({ value, testId }: { value: number; testId?: string }) {
  return (
    <>
      <span aria-hidden="true">
        <Ticker value={value} />
      </span>
      <span className="sr-only" data-testid={testId}>
        {value}
      </span>
    </>
  );
}

function LostMark({ update }: { update: LostUpdate }) {
  const victim = update.victim === null ? 'another thread' : threadName(update.victim);
  return (
    <span
      className="text-caption mt-0.5 flex flex-wrap items-baseline gap-x-1.5 font-sans"
      data-testid={`lost-${update.var}`}
    >
      <del
        className="text-fg-secondary decoration-state-error font-mono decoration-2"
        data-lost-value={update.lost}
      >
        <span className="sr-only">overwritten value </span>
        {update.lost}
      </del>
      <span className="text-state-error font-semibold">lost update:</span>
      <span className="text-fg-secondary">
        {victim}’s store of {update.lost} was overwritten by {threadName(update.by)}’s
        stale {update.value}
      </span>
    </span>
  );
}

/**
 * The lock as a chip in a row of seats, "free" and one per thread: the chip sits in its
 * holder's seat and glides to the next one when the lock changes hands.
 */
function LockSeats({
  name,
  holder,
  threads,
}: {
  name: string;
  holder: number | null;
  threads: number;
}) {
  const seats = [
    { key: 'free', label: 'free', here: holder === null },
    ...Array.from({ length: threads }, (_, t) => ({
      key: `t${t}`,
      label: threadName(t),
      here: holder === t,
    })),
  ];
  const items = seats.flatMap((seat) => [
    <span key={`seat-${seat.key}`} className="text-fg-muted text-caption font-sans">
      {seat.label}
    </span>,
    ...(seat.here
      ? [
          <span
            key="chip"
            data-lock-chip={name}
            className="border-accent text-fg bg-surface-overlay text-caption rounded border px-1.5 font-mono font-semibold"
          >
            {name}
          </span>,
        ]
      : []),
  ]);
  return (
    <Flip className="flex flex-wrap items-center gap-1.5" itemClassName="inline-flex">
      {items}
    </Flip>
  );
}

export function MemoryView({ program, snapshot, lost = {} }: MemoryViewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <table className={TABLE}>
        <caption className="text-small mb-1 text-left font-semibold">
          Shared variables
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Name
            </th>
            <th scope="col" className={TH}>
              Value
            </th>
            <th scope="col" className={TH}>
              Correct end value
            </th>
          </tr>
        </thead>
        <tbody>
          {program.vars.map((v) => {
            const expected = program.expect.find((e) => e.var === v.name);
            const bound = program.bounds.find((b) => b.var === v.name);
            const lostUpdate = lost[v.name];
            return (
              <tr key={v.name} data-lost={lostUpdate ? '' : undefined}>
                <th scope="row" className={`${TD} text-left font-normal`}>
                  {v.name}
                </th>
                <td className={TD}>
                  <Value value={snapshot.vars[v.name] ?? 0} testId={`var-${v.name}`} />
                  {lostUpdate ? <LostMark update={lostUpdate} /> : null}
                </td>
                <td className={TD}>
                  {expected ? expected.value : '—'}
                  {bound ? (
                    <span className="text-fg-muted font-sans">
                      {' '}
                      (stays {bound.min}..{bound.max})
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {program.locks.length > 0 || program.sems.length > 0 ? (
        <table className={TABLE}>
          <caption className="text-small mb-1 text-left font-semibold">
            Locks and semaphores
          </caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Name
              </th>
              <th scope="col" className={TH}>
                State
              </th>
              <th scope="col" className={TH}>
                Asleep (first to wake first)
              </th>
            </tr>
          </thead>
          <tbody>
            {program.locks.map((m, i) => {
              const holder = snapshot.locks[m] ?? null;
              return (
                <tr key={m}>
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {m}{' '}
                    <span className="text-fg-muted font-sans">
                      ({i === 0 ? <Term id="mutex">lock</Term> : 'lock'})
                    </span>
                  </th>
                  <td className={TD}>
                    <span data-testid={`lock-${m}`} className="sr-only">
                      {holder === null ? 'free' : `held by ${threadName(holder)}`}
                    </span>
                    <span aria-hidden="true">
                      <LockSeats
                        name={m}
                        holder={holder}
                        threads={program.threads.length}
                      />
                    </span>
                  </td>
                  <td className={TD}>—</td>
                </tr>
              );
            })}
            {program.sems.map((s, i) => {
              const sem = snapshot.sems[s.name];
              const queue = sem?.queue ?? [];
              return (
                <tr key={s.name}>
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {s.name}{' '}
                    <span className="text-fg-muted font-sans">
                      ({i === 0 ? <Term id="semaphore">semaphore</Term> : 'semaphore'})
                    </span>
                  </th>
                  <td className={TD}>
                    <span aria-hidden="true">
                      value <Ticker value={sem?.value ?? 0} />
                    </span>
                    <span className="sr-only" data-testid={`sem-${s.name}`}>
                      value {sem?.value}
                    </span>
                  </td>
                  <td className={TD}>
                    {queue.length > 0 ? (
                      <>
                        <span className="sr-only" data-testid={`queue-${s.name}`}>
                          {queue.map(threadName).join(', ')}
                        </span>
                        <span aria-hidden="true">
                          <Flip
                            className="flex flex-wrap gap-1"
                            itemClassName="inline-flex"
                          >
                            {queue.map((t) => (
                              <ProcessChip key={t} pid={t} label={threadName(t)} />
                            ))}
                          </Flip>
                        </span>
                      </>
                    ) : (
                      'nobody'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
