'use client';

import { MatrixTable } from '@/components/blocks/MatrixTable';
import { Term } from '@/components/glossary/Term';
import { Flash } from '@/components/motion/Flash';
import type { DlResult, DlSnapshot } from '@/core/deadlock/events';
import { processName, resourceName } from '@/core/deadlock/model';
import { cn } from '@/lib/cn';

import { isBad, processLabels, resourceLabels, resultText } from './adapters';
import { CompareStrip } from './CompareStrip';
import { ThreadChip } from './ThreadChip';
import { WorkBar } from './WorkBar';

/**
 * The parts of a step both tabs show: Work and Finish, the result banner, and the wait-for
 * graph with the DFS state for cycle detection.
 */

export function ResultBanner({ result, id }: { result: DlResult | null; id?: string }) {
  if (!result) return null;
  const bad = isBad(result);
  const stuck =
    result.kind === 'unsafe'
      ? result.stuck
      : result.kind === 'deadlocked'
        ? result.set
        : [];
  const order =
    result.kind === 'safe' || result.kind === 'not-deadlocked' ? result.order : [];
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border-2 px-3 py-2',
        bad ? 'border-state-error' : 'border-state-ok',
      )}
    >
      <p
        data-testid={id ?? 'dl-result'}
        className={cn(
          'text-small font-semibold',
          bad ? 'text-state-error' : 'text-state-ok',
        )}
      >
        {resultText(result)}
      </p>
      {order.length > 0 ? (
        <div className="flex flex-col gap-1">
          <ol aria-label="Order found" className="flex flex-wrap items-center gap-1.5">
            {order.map((t) => (
              <li key={t}>
                <ThreadChip t={t} />
              </li>
            ))}
          </ol>
          <p className="text-caption text-fg-secondary" data-testid="order-note">
            {result.kind === 'safe'
              ? 'One safe order (there may be others).'
              : 'One order they can finish in (there may be others).'}
          </p>
        </div>
      ) : null}
      {stuck.length > 0 ? (
        <ul aria-label="Threads that cannot finish" className="flex flex-wrap gap-2">
          {stuck.map((t) => (
            <li key={t}>
              <ThreadChip t={t} state="stuck" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Work as a bar that grows as threads finish (D2), Finish as one chip per thread, and the
 * order so far, each new thread flashing in as it finishes.
 */
export function WorkFinish({
  state,
  released,
}: {
  state: DlSnapshot;
  /** What the thread that finished on this step gave back. */
  released?: { t: number; values: readonly number[] } | null;
}) {
  if (!state.work || !state.finish) return null;
  return (
    <div className="flex flex-col gap-4">
      <WorkBar
        label="Work"
        values={state.work}
        total={state.total}
        released={released ?? null}
        description={
          <>
            = <Term id="available">Available</Term>, plus what every finished thread gave
            back.
          </>
        }
      />
      <div className="flex flex-col gap-1">
        <p className="text-small font-semibold">Finish</p>
        <ul
          aria-label="Finish"
          data-testid="finish"
          className="flex flex-wrap gap-x-3 gap-y-1"
        >
          {state.finish.map((done, t) => (
            <li
              key={t}
              data-finished={done}
              className={cn(
                'rounded-md',
                state.row === t && 'outline-accent outline-2 outline-offset-2',
              )}
            >
              <ThreadChip t={t} state={done ? 'done' : undefined} />
              {done ? null : <span className="sr-only"> not finished</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="text-small flex flex-wrap items-center gap-2">
        <span>Finished so far:</span>
        <span className="sr-only" data-testid="order">
          {state.order.length === 0
            ? 'none'
            : `⟨${state.order.map(processName).join(', ')}⟩`}
        </span>
        {state.order.length === 0 ? (
          <span aria-hidden="true" className="text-fg-muted">
            none
          </span>
        ) : (
          <ol aria-hidden="true" className="flex flex-wrap gap-1.5">
            {state.order.map((t, i) => (
              <li key={t}>
                <Flash
                  trigger={`${t}-${i}`}
                  active={released != null && i === state.order.length - 1}
                  tone="ok"
                >
                  <ThreadChip t={t} />
                </Flash>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

const COLOUR_NAMES = ['not visited', 'on the path', 'done'] as const;

/** Cycle detection: the wait-for graph's edges and where the DFS is. */
export function WaitForView({ state }: { state: DlSnapshot }) {
  if (!state.waitFor || !state.dfs) return null;
  const { dfs } = state;
  const current = dfs.edge;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-small font-semibold">Wait-for graph</h3>
        {state.waitFor.length === 0 ? (
          <p className="text-small text-fg-muted">No thread waits for another.</p>
        ) : (
          <ul className="text-small flex flex-wrap gap-x-4 gap-y-1 font-mono">
            {state.waitFor.map((e) => {
              const active = current?.from === e.from && current.to === e.to;
              return (
                <li
                  key={`${e.from}-${e.to}`}
                  className={cn(active && 'text-accent font-semibold')}
                >
                  {processName(e.from)} → {processName(e.to)}{' '}
                  <span className="text-fg-muted">({resourceName(e.resource)})</span>
                  {active ? <span className="sr-only"> (this step)</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <table className="text-small border-collapse text-left">
        <caption className="mb-1 text-left font-semibold">Depth-first search</caption>
        <thead>
          <tr>
            <th scope="col" className="text-fg-muted px-2 py-1">
              Thread
            </th>
            <th scope="col" className="text-fg-muted px-2 py-1">
              State
            </th>
          </tr>
        </thead>
        <tbody>
          {dfs.colour.map((colour, t) => (
            <tr
              key={t}
              className={cn(
                'border-border border-t',
                state.row === t &&
                  'bg-surface-overlay outline-accent outline-2 -outline-offset-2',
              )}
            >
              <th scope="row" className="px-2 py-1 font-mono">
                {processName(t)}
              </th>
              <td className="px-2 py-1">{COLOUR_NAMES[colour]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-small">
        Path:{' '}
        <span className="font-mono" data-testid="dfs-path">
          {dfs.stack.length === 0 ? 'empty' : dfs.stack.map(processName).join(' → ')}
        </span>
      </p>
    </div>
  );
}

/** Row labels with a tick on every thread that has finished (§7.2.5). */
export function rowLabelsWithFinish(state: DlSnapshot): string[] {
  return processLabels(state.allocation.length).map((label, t) =>
    state.finish?.[t] ? `${label} ✓` : label,
  );
}

/**
 * Allocation and Request with Available or Work under them: the detection algorithm.
 * Only the row being compared is at full strength (D2); the comparison itself is spelled
 * out column by column under the matrices.
 */
export function DetectionMatrices({ state }: { state: DlSnapshot }) {
  const threads = rowLabelsWithFinish(state);
  const resources = resourceLabels(state.total.length);
  const compare = state.compare;
  const changed = state.changed.map(([row, col]) => ({ row, col }));
  const row = state.row !== null ? { highlightRow: state.row } : {};
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <MatrixTable
          caption="Allocation"
          rowLabels={threads}
          columnLabels={resources}
          values={state.allocation}
          vector={{ label: 'Available', values: state.available }}
          changed={changed}
          dimOthers
          {...row}
        />
        {state.request ? (
          <MatrixTable
            caption="Request"
            rowLabels={threads}
            columnLabels={resources}
            values={state.request}
            {...(state.work ? { vector: { label: 'Work', values: state.work } } : {})}
            {...row}
            dimOthers
            compare={compare?.matrix === 'request'}
          />
        ) : null}
      </div>
      {compare && compare.matrix === 'request' && state.work ? (
        <CompareStrip
          left={`Request[${processName(compare.row)}]`}
          leftValues={compare.values}
          right="Work"
          rightValues={state.work}
          trigger={`${compare.row}-${state.order.length}`}
        />
      ) : null}
    </div>
  );
}
