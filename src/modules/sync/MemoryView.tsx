import type { SyncSnapshot } from '@/core/sync/events';
import { threadName, type Program } from '@/core/sync/program';

/**
 * Shared memory at the tick on screen: the variables (with the value a correct run ends
 * with, and any range they must stay in), who holds each lock, and each semaphore's value
 * and queue of sleepers. Plain tables, so they read the same to a screen reader.
 */

const TABLE = 'w-full text-small';
const TH = 'text-fg-muted text-caption px-2 py-1 text-left font-medium';
const TD = 'border-border border-t px-2 py-1 font-mono';

export function MemoryView({
  program,
  snapshot,
}: {
  program: Program;
  snapshot: SyncSnapshot;
}) {
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
            return (
              <tr key={v.name}>
                <th scope="row" className={`${TD} text-left font-normal`}>
                  {v.name}
                </th>
                <td className={TD} data-testid={`var-${v.name}`}>
                  {snapshot.vars[v.name]}
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
            {program.locks.map((m) => {
              const holder = snapshot.locks[m];
              return (
                <tr key={m}>
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {m} <span className="text-fg-muted font-sans">(lock)</span>
                  </th>
                  <td className={TD} data-testid={`lock-${m}`}>
                    {holder === null || holder === undefined
                      ? 'free'
                      : `held by ${threadName(holder)}`}
                  </td>
                  <td className={TD}>—</td>
                </tr>
              );
            })}
            {program.sems.map((s) => {
              const sem = snapshot.sems[s.name];
              return (
                <tr key={s.name}>
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {s.name} <span className="text-fg-muted font-sans">(semaphore)</span>
                  </th>
                  <td className={TD} data-testid={`sem-${s.name}`}>
                    value {sem?.value}
                  </td>
                  <td className={TD}>
                    {sem && sem.queue.length > 0
                      ? sem.queue.map(threadName).join(', ')
                      : 'nobody'}
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
