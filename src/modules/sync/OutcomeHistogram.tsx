'use client';

import { ChartTableToggle } from '@/components/blocks/ChartTableToggle';
import { Button } from '@/components/timeline/ui/Button';
import type { Exploration } from '@/core/sync/explore';
import { cn } from '@/lib/cn';

import { explorationSummary, histogramRows, type HistogramRow } from './adapters';

/**
 * Every interleaving of the program, run to the end and grouped by how it ends: "20
 * interleavings: 2 give counter = 2, 18 give counter = 1". This is what turns "a race
 * can happen" into a count. Each group can load one of its interleavings (the first in
 * pick order) into the stepper as a manual schedule.
 *
 * The bars carry their verdict in words and their count as text; the table view holds
 * the same numbers.
 */

const VERDICT_STYLE: Record<string, string> = {
  correct: 'border-state-ok',
  wrong: 'border-state-error border-dashed',
  stuck: 'border-state-error border-dotted',
  error: 'border-state-error border-dotted',
  finished: 'border-border',
};

function percent(share: number): string {
  const p = share * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}

export function OutcomeHistogram({
  exploration,
  onLoad,
}: {
  exploration: Exploration;
  onLoad: (row: HistogramRow) => void;
}) {
  if (exploration.tooLarge) {
    return (
      <p className="text-small text-fg-muted">
        This program has too many states to explore every interleaving (more than{' '}
        {exploration.states}). Use the presets, which are all small enough.
      </p>
    );
  }
  const rows = histogramRows(exploration);
  const summary = explorationSummary(exploration);

  const chart = (
    <ul className="flex flex-col gap-2" aria-label="Outcomes">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1" data-outcome={row.verdict}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-small min-w-0">
              <span className="font-semibold">{row.label}</span>{' '}
              <span className="text-fg-muted">({row.verdict})</span>
            </span>
            <span className="text-small font-mono">
              {row.count} of {exploration.total} · {percent(row.share)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="bg-surface-overlay h-4 flex-1 overflow-hidden rounded"
              aria-hidden="true"
            >
              <div
                className={cn(
                  'bg-fg-muted/40 h-full rounded border-2',
                  VERDICT_STYLE[row.verdict],
                )}
                style={{ width: `${Math.max(row.share * 100, 1.5)}%` }}
              />
            </div>
            <Button size="sm" variant="secondary" onClick={() => onLoad(row)}>
              Load one<span className="sr-only">: {row.label}</span>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );

  const table = (
    <table className="text-small w-full">
      <caption className="sr-only">Outcomes of every interleaving</caption>
      <thead>
        <tr>
          <th scope="col" className="text-fg-muted text-caption px-2 py-1 text-left">
            Outcome
          </th>
          <th scope="col" className="text-fg-muted text-caption px-2 py-1 text-left">
            Verdict
          </th>
          <th scope="col" className="text-fg-muted text-caption px-2 py-1 text-right">
            Interleavings
          </th>
          <th scope="col" className="text-fg-muted text-caption px-2 py-1 text-right">
            Share
          </th>
          <th scope="col" className="text-fg-muted text-caption px-2 py-1">
            <span className="sr-only">Load</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th
              scope="row"
              className="border-border border-t px-2 py-1 text-left font-normal"
            >
              {row.label}
            </th>
            <td className="border-border border-t px-2 py-1">{row.verdict}</td>
            <td className="border-border border-t px-2 py-1 text-right font-mono">
              {row.count}
            </td>
            <td className="border-border border-t px-2 py-1 text-right font-mono">
              {percent(row.share)}
            </td>
            <td className="border-border border-t px-2 py-1 text-right">
              <Button size="sm" variant="ghost" onClick={() => onLoad(row)}>
                Load one<span className="sr-only">: {row.label}</span>
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-small" data-testid="outcome-summary">
        {summary}
      </p>
      <ChartTableToggle
        label="Outcomes of every interleaving"
        chart={chart}
        table={table}
      />
    </div>
  );
}
