'use client';

import { useId, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * A process × resource matrix (Max, Allocation, Need, Request) with an optional vector
 * row under it (Available, Work).
 *
 * Read-only, it can mark the row the step is about, a changed cell, and a comparison:
 * `compare` checks the highlighted row against the vector cell by cell (Need ≤ Work) and
 * says the result in words, per cell and for the row. Editable, every cell is a labelled
 * number input; a value is committed only when it is a whole number in range, so a
 * half-typed cell never reaches the algorithm.
 */

export interface MatrixCell {
  row: number;
  col: number;
}

export interface MatrixVector {
  /** e.g. "Work" or "Available". */
  label: string;
  values: readonly number[];
}

export interface MatrixTableProps {
  /** Names the matrix, e.g. "Need". */
  caption: string;
  rowLabels: readonly string[];
  columnLabels: readonly string[];
  values: readonly (readonly number[])[];
  /** A vector shown under the matrix. */
  vector?: MatrixVector;
  /** Row the current step is about. */
  highlightRow?: number;
  /** Compare `highlightRow` with `vector`, cell by cell: `row[c] ≤ vector[c]`. */
  compare?: boolean;
  /** Cells the current step changed. */
  changed?: readonly MatrixCell[];
  /** Number inputs instead of text. Requires `onChange`. */
  editable?: boolean;
  onChange?: (row: number, col: number, value: number) => void;
  min?: number;
  max?: number;
  /**
   * Optional. Show every row but `highlightRow` in muted text (still AA contrast), so
   * the row being compared is the one at full strength. Off by default.
   */
  dimOthers?: boolean;
  /**
   * Optional. Editable only: the message shown under a cell, and announced, while what
   * is typed there is not a whole number in range ("Enter a whole number from 0 to 9").
   * Without it, an invalid cell is marked by its border and `aria-invalid` alone.
   */
  invalidMessage?: string;
  className?: string;
}

/** `row ≤ vector` cell by cell, and whether every cell passes. */
export function compareRow(
  row: readonly number[],
  vector: readonly number[],
): { cells: boolean[]; all: boolean } {
  const cells = row.map((value, c) => value <= (vector[c] ?? 0));
  return { cells, all: cells.every(Boolean) };
}

/** A whole number in `[min, max]`, or `null`. */
export function parseCell(text: string, min: number, max: number): number | null {
  if (!/^\s*-?\d+\s*$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

function CellInput({
  value,
  label,
  min,
  max,
  onCommit,
  invalidMessage,
}: {
  value: number;
  label: string;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  invalidMessage?: string;
}) {
  // What is typed, until it parses; `null` shows the committed value.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseCell(draft, min, max) === null;
  const messageId = useId();
  const showMessage = invalid && invalidMessage !== undefined;
  const input = (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={showMessage ? messageId : undefined}
      value={draft ?? String(value)}
      onChange={(event) => {
        const text = event.target.value;
        const parsed = parseCell(text, min, max);
        if (parsed === null) {
          setDraft(text);
        } else {
          setDraft(null);
          onCommit(parsed);
        }
      }}
      onBlur={() => setDraft(null)}
      className={cn(
        'border-border bg-surface w-14 rounded border px-1 py-0.5 text-center font-mono',
        invalid && 'border-state-error border-2',
      )}
    />
  );
  if (invalidMessage === undefined) return input;
  return (
    <>
      {input}
      {showMessage ? (
        <span
          id={messageId}
          role="alert"
          className="text-caption text-state-error mt-0.5 block max-w-24 text-left font-sans"
        >
          {invalidMessage}
        </span>
      ) : null}
    </>
  );
}

export function MatrixTable({
  caption,
  rowLabels,
  columnLabels,
  values,
  vector,
  highlightRow,
  compare = false,
  changed = [],
  editable = false,
  onChange,
  min = 0,
  max = 99,
  dimOthers = false,
  invalidMessage,
  className,
}: MatrixTableProps) {
  const comparing =
    compare && vector !== undefined && highlightRow !== undefined && values[highlightRow];
  const result = comparing ? compareRow(values[highlightRow]!, vector.values) : null;
  const isChanged = (row: number, col: number) =>
    changed.some((cell) => cell.row === row && cell.col === col);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <table className="text-small border-collapse text-center">
        <caption className="mb-1 text-left font-semibold">{caption}</caption>
        <thead>
          <tr>
            <td />
            {columnLabels.map((label) => (
              <th key={label} scope="col" className="text-fg-muted px-2 py-1 font-mono">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rowLabel, r) => {
            const active = r === highlightRow;
            return (
              <tr
                key={rowLabel}
                data-active={active || undefined}
                className={cn(
                  'border-border border-t',
                  dimOthers && highlightRow !== undefined && !active && 'text-fg-muted',
                  active &&
                    'bg-surface-overlay outline-accent outline-2 -outline-offset-2',
                )}
              >
                <th scope="row" className="px-2 py-1 text-left font-mono">
                  {rowLabel}
                  {active ? <span className="sr-only"> (this step)</span> : null}
                </th>
                {columnLabels.map((colLabel, c) => {
                  const value = values[r]?.[c] ?? 0;
                  const changedHere = isChanged(r, c);
                  const pass = active && result ? result.cells[c] : undefined;
                  return (
                    <td
                      key={colLabel}
                      data-changed={changedHere || undefined}
                      className={cn(
                        'px-2 py-1 font-mono',
                        changedHere && 'text-accent font-semibold',
                      )}
                    >
                      {editable && onChange ? (
                        <CellInput
                          value={value}
                          label={`${caption}, ${rowLabel}, ${colLabel}`}
                          min={min}
                          max={max}
                          onCommit={(next) => onChange(r, c, next)}
                          {...(invalidMessage !== undefined ? { invalidMessage } : {})}
                        />
                      ) : (
                        value
                      )}
                      {changedHere ? (
                        <span className="text-caption ml-1 font-sans">(changed)</span>
                      ) : null}
                      {pass !== undefined ? (
                        <span
                          className={cn(
                            'text-caption ml-1 font-sans',
                            pass ? 'text-state-ok' : 'text-state-error',
                          )}
                        >
                          {pass ? '≤ ✓' : '> ✗'}
                          <span className="sr-only">
                            {pass
                              ? ` fits ${vector!.label}`
                              : ` exceeds ${vector!.label}`}
                          </span>
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        {vector ? (
          <tfoot>
            <tr className="border-border-strong border-t-2">
              <th scope="row" className="px-2 py-1 text-left font-semibold">
                {vector.label}
              </th>
              {columnLabels.map((label, c) => (
                <td key={label} className="px-2 py-1 font-mono">
                  {vector.values[c] ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
      {result && highlightRow !== undefined ? (
        <p className="text-small" data-testid="matrix-compare">
          {caption}[{rowLabels[highlightRow]}] ≤ {vector!.label}:{' '}
          <span
            className={cn(
              'font-semibold',
              result.all ? 'text-state-ok' : 'text-state-error',
            )}
          >
            {result.all
              ? 'yes, every resource fits'
              : 'no, at least one resource does not fit'}
          </span>
        </p>
      ) : null}
    </div>
  );
}
