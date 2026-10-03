import { Star } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Rows of numbers against columns, with a "best" marker and an averages row.
 *
 * Two uses, one component:
 * - Compare: rows are metrics, columns are runs (FCFS, SJF, RR). A row with `better` set
 *   marks its best column(s) with a star **and the word "best"**, never colour alone.
 * - Scheduling: rows are processes, columns are metrics (waiting, turnaround, response),
 *   and `average` adds the column means underneath.
 *
 * Ties: every column that equals the best value is marked. A row with no numbers marks
 * nothing.
 */

export interface MetricsColumn {
  id: string;
  label: string;
}

export interface MetricsRow {
  id: string;
  label: string;
  /** One per column; `null` is "not applicable" and is never best. */
  values: readonly (number | null)[];
  /** Mark the lowest or highest value in the row as best. */
  better?: 'lower' | 'higher';
}

export interface MetricsTableProps {
  caption: string;
  columns: readonly MetricsColumn[];
  rows: readonly MetricsRow[];
  /** Add a row of column means, labelled with this text (e.g. "Average"). */
  average?: string;
  /** Best marking for the averages row. */
  averageBetter?: 'lower' | 'higher';
  format?: (value: number) => string;
  className?: string;
}

/** Up to two decimals, no trailing zeros. */
export function formatMetric(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Column indexes holding the best value. Ties all count. */
export function bestColumns(
  values: readonly (number | null)[],
  better: 'lower' | 'higher',
): number[] {
  const numbers = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (numbers.length === 0) return [];
  const best = better === 'lower' ? Math.min(...numbers) : Math.max(...numbers);
  return values.flatMap((v, i) => (v === best ? [i] : []));
}

/** The mean of each column over the rows, ignoring `null`s; `null` if a column has none. */
export function columnMeans(
  rows: readonly MetricsRow[],
  columnCount: number,
): (number | null)[] {
  return Array.from({ length: columnCount }, (_, c) => {
    const numbers = rows
      .map((row) => row.values[c])
      .filter((v): v is number => v !== null && v !== undefined);
    return numbers.length === 0
      ? null
      : numbers.reduce((sum, v) => sum + v, 0) / numbers.length;
  });
}

function Row({
  row,
  format,
  emphasis,
}: {
  row: MetricsRow;
  format: (value: number) => string;
  emphasis?: boolean;
}) {
  const best = row.better ? bestColumns(row.values, row.better) : [];
  return (
    <tr className={cn('border-border border-t', emphasis && 'border-t-2 font-semibold')}>
      <th scope="row" className="px-2 py-1 text-left font-medium">
        {row.label}
      </th>
      {row.values.map((value, c) => {
        const isBest = best.includes(c);
        return (
          <td key={c} data-best={isBest || undefined} className="px-2 py-1 font-mono">
            {value === null ? <span className="text-fg-muted">—</span> : format(value)}
            {isBest ? (
              <span className="text-state-ok text-caption ml-1 inline-flex items-center gap-0.5 font-sans font-semibold">
                <Star aria-hidden="true" className="size-3" />
                best
              </span>
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}

export function MetricsTable({
  caption,
  columns,
  rows,
  average,
  averageBetter,
  format = formatMetric,
  className,
}: MetricsTableProps) {
  const means = average ? columnMeans(rows, columns.length) : null;
  return (
    <table className={cn('text-small w-full border-collapse text-right', className)}>
      <caption className="mb-1 text-left font-semibold">{caption}</caption>
      <thead>
        <tr>
          <td />
          {columns.map((column) => (
            <th
              key={column.id}
              scope="col"
              className="text-fg-muted px-2 py-1 font-medium"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Row key={row.id} row={row} format={format} />
        ))}
      </tbody>
      {means && average ? (
        <tfoot>
          <Row
            row={{ id: 'average', label: average, values: means, better: averageBetter }}
            format={format}
            emphasis
          />
        </tfoot>
      ) : null}
    </table>
  );
}
