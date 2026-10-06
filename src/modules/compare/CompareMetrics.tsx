'use client';

import { ArrowDown, ArrowUp, Equal, Star } from 'lucide-react';
import type { ReactNode } from 'react';

import { Term } from '@/components/glossary/Term';
import { Flash } from '@/components/motion/Flash';
import { DURATION } from '@/components/motion/tokens';
import type { CompareRow, CompareRowId } from '@/core/sched/compare';
import { cn } from '@/lib/cn';
import { MetricDefinitions } from '@/modules/scheduling';

import { formatValue, type Mark, ROW_UNITS, rowMarks } from './summary';
import { EASE_SNAP, FADE, POP, useArrival } from './useArrival';

/**
 * Compare's results (docs/UIUX.md C1-C3, §7.2.2): the "Why?" sentence as the headline,
 * then the metrics side by side, as a table on wider screens and as one card per metric
 * (rows = policies) on a phone.
 *
 * Every row says which way is good, and the best and tie markers are an icon *and* a
 * word. They are given once every run has finished: halfway through, a run that has
 * ended is being measured against runs that have not, and averages over "finished
 * processes so far" would crown the wrong policy. Reached by playing, the markers pop in
 * row by row (60 ms apart) and the headline types in; reached by a jump, both are simply
 * there.
 */

/** Stagger between rows' markers (§7.2.2). */
const ROW_STAGGER = 60;
/** The whole headline types in within this, word by word. */
const TYPE_TOKEN = 600;

export function Direction({ better }: { better: 'lower' | 'higher' }) {
  const Icon = better === 'lower' ? ArrowDown : ArrowUp;
  return (
    <span className="text-caption text-fg-muted inline-flex items-center gap-0.5 font-sans font-normal whitespace-nowrap">
      <Icon aria-hidden="true" className="size-3" />
      {better} is better
    </span>
  );
}

function Marker({ mark, row }: { mark: Exclude<Mark, null>; row: number }) {
  const ref = useArrival<HTMLSpanElement>(POP, {
    token: DURATION.highlight,
    delayToken: row * ROW_STAGGER,
    easing: EASE_SNAP,
  });
  return mark === 'best' ? (
    <span
      ref={ref}
      data-marker="best"
      className="text-state-ok text-caption ml-1 inline-flex items-center gap-0.5 font-sans font-semibold"
    >
      <Star aria-hidden="true" className="size-3" />
      best
    </span>
  ) : (
    <span
      ref={ref}
      data-marker="tie"
      className="text-fg-secondary text-caption ml-1 inline-flex items-center gap-0.5 font-sans font-semibold"
    >
      <Equal aria-hidden="true" className="size-3" />
      tie
    </span>
  );
}

function Word({ text, delay }: { text: string; delay: number }) {
  const ref = useArrival<HTMLSpanElement>(FADE, {
    token: DURATION.highlight,
    delayToken: delay,
  });
  return (
    <span ref={ref} className="inline-block">
      {text}
    </span>
  );
}

/** The sentence, word by word, so it can type in. The text is whole in the DOM. */
function Typed({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  const words = parts.filter((part) => part.trim() !== '').length;
  let n = 0;
  return (
    <>
      {parts.map((part, i) => {
        if (part.trim() === '') return part;
        const delay = (n++ * TYPE_TOKEN) / Math.max(1, words);
        return <Word key={i} text={part} delay={delay} />;
      })}
    </>
  );
}

/** Each row's label, with its glossary definition (literal ids, for the glossary scan). */
const ROW_LABELS: Record<CompareRowId, ReactNode> = {
  waiting: <Term id="waiting-time">Average waiting</Term>,
  turnaround: <Term id="turnaround-time">Average turnaround</Term>,
  response: <Term id="response-time">Average response</Term>,
  utilisation: <Term id="utilisation">CPU utilisation</Term>,
  throughput: <Term id="throughput">Throughput</Term>,
  contextSwitches: <Term id="context-switch">Context switches</Term>,
};

function RowLabel({ row }: { row: CompareRow }) {
  const unit = ROW_UNITS[row.id];
  return (
    <span className="inline-flex flex-col items-start">
      <span>
        {ROW_LABELS[row.id]}
        {unit ? <span className="text-fg-muted font-normal"> ({unit})</span> : null}
      </span>
      <Direction better={row.better} />
    </span>
  );
}

export interface CompareMetricsProps {
  /** The metrics at the cursor, one value per column. */
  table: readonly CompareRow[];
  names: readonly string[];
  tick: number;
  /** Every run has finished: the markers and the headline are given. */
  ended: boolean;
  durationTicks: number;
  /** The "Why?" sentence for `table`. */
  why: string;
}

export function CompareMetrics({
  table,
  names,
  tick,
  ended,
  durationTicks,
  why,
}: CompareMetricsProps) {
  const marks = table.map((row) => (ended ? rowMarks(row) : row.values.map(() => null)));

  return (
    <section aria-labelledby="compare-metrics-heading" className="flex flex-col gap-3">
      <h2 id="compare-metrics-heading" className="text-lead font-semibold">
        Metrics at t = {tick}
      </h2>

      <div className="border-accent bg-surface-raised rounded-lg border-l-4 px-4 py-3">
        <p className="text-fg-muted text-caption font-semibold tracking-wide uppercase">
          Why?
        </p>
        <div aria-live="polite">
          <p
            key={ended ? 'end' : 'running'}
            data-testid="why-line"
            className={cn('text-fg', ended ? 'text-lead font-semibold' : 'text-small')}
          >
            {ended ? (
              <Typed text={why} />
            ) : (
              <>
                Who wins each metric is settled when every run has finished, at t ={' '}
                {durationTicks}. Play to the end, or press End.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Tablet and desktop: one table, rows = metrics, columns = policies. */}
      <div className="overflow-x-auto max-sm:hidden">
        <table className="text-small w-full border-collapse text-right">
          <caption className="mb-1 text-left font-semibold">
            Side by side (averages over finished processes)
          </caption>
          <thead>
            <tr>
              <td />
              {names.map((name, c) => (
                <th
                  key={c}
                  scope="col"
                  className="text-fg-muted px-2 py-1 align-bottom font-medium"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row, r) => (
              <tr key={row.id} data-row={row.id} className="border-border border-t">
                <th scope="row" className="px-2 py-1.5 text-left font-medium">
                  <RowLabel row={row} />
                </th>
                {row.values.map((value, c) => {
                  const mark = marks[r]![c];
                  return (
                    <td
                      key={c}
                      data-mark={mark ?? undefined}
                      className="px-2 py-1.5 font-mono whitespace-nowrap"
                    >
                      <Flash trigger={`${row.id}:${c}:${value}`}>
                        {formatValue(row.id, value)}
                      </Flash>
                      {mark ? <Marker mark={mark} row={r} /> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one card per metric, rows = policies (C1). */}
      <div className="flex flex-col gap-2 sm:hidden" data-testid="metric-cards">
        {table.map((row, r) => (
          <section
            key={row.id}
            aria-label={row.label}
            data-card={row.id}
            className="border-border rounded-md border px-3 py-2"
          >
            <h3 className="text-small font-semibold">
              <RowLabel row={row} />
            </h3>
            <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
              {row.values.map((value, c) => {
                const mark = marks[r]![c];
                return (
                  <div key={c} className="contents" data-mark={mark ?? undefined}>
                    <dt className="text-small text-fg-secondary">{names[c]}</dt>
                    <dd className="text-small text-right font-mono whitespace-nowrap">
                      {formatValue(row.id, value)}
                      {mark ? <Marker mark={mark} row={r} /> : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <p className="text-caption text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <Star aria-hidden="true" className="text-state-ok size-3" />
          <span>
            <strong className="text-fg-secondary">best</strong>: the only policy with the
            best value in its row
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Equal aria-hidden="true" className="size-3" />
          <span>
            <strong className="text-fg-secondary">tie</strong>: shares the best value
          </span>
        </span>
        {ended ? null : <span>Markers appear when every run has finished.</span>}
      </p>

      <MetricDefinitions />
    </section>
  );
}
