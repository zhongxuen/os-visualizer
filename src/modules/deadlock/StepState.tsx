'use client';

import { MatrixTable } from '@/components/blocks/MatrixTable';
import type { DlResult, DlSnapshot } from '@/core/deadlock/events';
import { processName, resourceName } from '@/core/deadlock/model';
import { cn } from '@/lib/cn';

import { isBad, processLabels, resourceLabels, resultText } from './adapters';

/**
 * The parts of a step both tabs show: Work and Finish, the result banner, and the wait-for
 * graph with the DFS state for cycle detection.
 */

export function ResultBanner({ result, id }: { result: DlResult | null; id?: string }) {
  if (!result) return null;
  const bad = isBad(result);
  return (
    <p
      data-testid={id ?? 'dl-result'}
      className={cn(
        'text-small rounded-md border-2 px-3 py-2 font-semibold',
        bad ? 'border-state-error text-state-error' : 'border-state-ok text-state-ok',
      )}
    >
      {resultText(result)}
    </p>
  );
}

/** Work, Finish and the order so far, as a table. */
export function WorkFinish({ state }: { state: DlSnapshot }) {
  if (!state.work || !state.finish) return null;
  const threads = processLabels(state.finish.length);
  const resources = resourceLabels(state.work.length);
  return (
    <div className="flex flex-wrap gap-6">
      <table className="text-small border-collapse text-center">
        <caption className="mb-1 text-left font-semibold">Work</caption>
        <thead>
          <tr>
            {resources.map((label) => (
              <th key={label} scope="col" className="text-fg-muted px-2 py-1 font-mono">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-border border-t" data-testid="work">
            {state.work.map((value, r) => (
              <td key={r} className="px-2 py-1 font-mono">
                {value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <table className="text-small border-collapse text-center">
        <caption className="mb-1 text-left font-semibold">Finish</caption>
        <thead>
          <tr>
            {threads.map((label) => (
              <th key={label} scope="col" className="text-fg-muted px-2 py-1 font-mono">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-border border-t" data-testid="finish">
            {state.finish.map((done, t) => (
              <td
                key={t}
                className={cn(
                  'px-2 py-1 font-mono',
                  done ? 'text-state-ok' : 'text-fg-muted',
                  state.row === t && 'outline-accent outline-2 -outline-offset-2',
                )}
              >
                {done ? 'true' : 'false'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="text-small self-end">
        Finished so far:{' '}
        <span className="font-mono" data-testid="order">
          {state.order.length === 0
            ? 'none'
            : `⟨${state.order.map(processName).join(', ')}⟩`}
        </span>
      </p>
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

/** Allocation and Request with Available or Work under them: the detection algorithm. */
export function DetectionMatrices({ state }: { state: DlSnapshot }) {
  const threads = processLabels(state.allocation.length);
  const resources = resourceLabels(state.total.length);
  const compare = state.compare;
  const changed = state.changed.map(([row, col]) => ({ row, col }));
  return (
    <div className="flex flex-wrap gap-6">
      <MatrixTable
        caption="Allocation"
        rowLabels={threads}
        columnLabels={resources}
        values={state.allocation}
        vector={{ label: 'Available', values: state.available }}
        changed={changed}
        {...(state.row !== null ? { highlightRow: state.row } : {})}
      />
      {state.request ? (
        <MatrixTable
          caption="Request"
          rowLabels={threads}
          columnLabels={resources}
          values={state.request}
          {...(state.work ? { vector: { label: 'Work', values: state.work } } : {})}
          {...(state.row !== null ? { highlightRow: state.row } : {})}
          compare={compare?.matrix === 'request'}
        />
      ) : null}
    </div>
  );
}
