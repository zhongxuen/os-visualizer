'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';

import { MatrixTable } from '@/components/blocks/MatrixTable';
import { Term } from '@/components/glossary/Term';
import { Flash } from '@/components/motion/Flash';
import { Button } from '@/components/timeline/ui/Button';
import type { DlEventKind, DlSnapshot } from '@/core/deadlock/events';
import {
  LIMITS,
  needOf,
  processName,
  resizeBankers,
  validateBankers,
  type BankersState,
} from '@/core/deadlock/model';
import type { BankersQuery } from '@/core/deadlock/presets';
import { cn } from '@/lib/cn';

import { processLabels, releasedAt, resourceLabels, type RequestCheck } from './adapters';
import { CompareStrip } from './CompareStrip';
import { Messages, Panel, parseNumber, SelectField, TextField } from './fields';
import { ResultBanner, rowLabelsWithFinish, WorkFinish } from './StepState';

/**
 * The Banker's tab: an editor for Max, Allocation and Available (Need is computed, never
 * edited), the request form, and the step view of the safety or request algorithm.
 */

/** G11: one human message for a matrix cell that is not a number in range. */
const CELL_MESSAGE = `Enter a whole number from 0 to ${LIMITS.maxBankerValue}.`;

const THREAD_COUNTS = Array.from({ length: LIMITS.maxProcesses }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));
const RESOURCE_COUNTS = Array.from({ length: LIMITS.maxResources }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

function setCell(matrix: readonly number[][], row: number, col: number, value: number) {
  return matrix.map((r, i) => (i === row ? r.map((v, j) => (j === col ? value : v)) : r));
}

export interface BankersEditorProps {
  state: BankersState;
  /** Called with every valid state. Remount (change `key`) to load another. */
  onChange: (state: BankersState) => void;
}

/** Editable Max, Allocation and Available. Only a valid state leaves the editor. */
export function BankersEditor({ state, onChange }: BankersEditorProps) {
  const [draft, setDraft] = useState(state);
  const result = validateBankers(draft);
  const messages = result.ok ? [] : [...new Set(result.issues.map((i) => i.message))];
  const threads = processLabels(draft.max.length);
  const resources = resourceLabels(draft.available.length);

  const update = (next: BankersState) => {
    setDraft(next);
    if (validateBankers(next).ok) onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <SelectField
          label="Threads"
          value={String(draft.max.length)}
          options={THREAD_COUNTS}
          onChange={(n) =>
            update(resizeBankers(draft, Number(n), draft.available.length))
          }
        />
        <SelectField
          label="Resource types"
          value={String(draft.available.length)}
          options={RESOURCE_COUNTS}
          onChange={(m) => update(resizeBankers(draft, draft.max.length, Number(m)))}
        />
      </div>
      <p className="text-caption text-fg-muted">
        Max and Allocation are yours to edit. <Term id="need" /> is computed from them,
        never typed.
      </p>
      <div className="flex flex-col gap-4">
        <MatrixTable
          className="overflow-x-auto"
          invalidMessage={CELL_MESSAGE}
          caption="Max"
          rowLabels={threads}
          columnLabels={resources}
          values={draft.max}
          editable
          max={LIMITS.maxBankerValue}
          onChange={(row, col, value) =>
            update({ ...draft, max: setCell(draft.max, row, col, value) })
          }
        />
        <MatrixTable
          className="overflow-x-auto"
          invalidMessage={CELL_MESSAGE}
          caption="Allocation"
          rowLabels={threads}
          columnLabels={resources}
          values={draft.allocation}
          editable
          max={LIMITS.maxBankerValue}
          onChange={(row, col, value) =>
            update({ ...draft, allocation: setCell(draft.allocation, row, col, value) })
          }
        />
        <MatrixTable
          className="overflow-x-auto"
          invalidMessage={CELL_MESSAGE}
          caption="Available"
          rowLabels={['Free']}
          columnLabels={resources}
          values={[draft.available]}
          editable
          max={LIMITS.maxBankerValue}
          onChange={(_row, col, value) =>
            update({
              ...draft,
              available: draft.available.map((v, j) => (j === col ? value : v)),
            })
          }
        />
        {result.ok ? (
          <div
            data-derived=""
            className="border-border bg-surface-overlay flex flex-col gap-1 rounded-md border p-2"
          >
            <p className="text-caption text-fg-secondary font-semibold">
              Computed, not edited
            </p>
            <MatrixTable
              className="overflow-x-auto"
              caption="Need = Max − Allocation"
              rowLabels={threads}
              columnLabels={resources}
              values={needOf(draft)}
            />
          </div>
        ) : null}
      </div>
      <div aria-live="polite">
        <Messages id="bankers-errors" messages={messages} />
      </div>
    </div>
  );
}

export interface BankersQueryFormProps {
  state: BankersState;
  query: BankersQuery;
  onRun: (query: BankersQuery) => void;
}

/** Run the safety algorithm, or a request from one thread. */
export function BankersQueryForm({ state, query, onRun }: BankersQueryFormProps) {
  const n = state.max.length;
  const m = state.available.length;
  const [t, setT] = useState(String(Math.min(query.t, n - 1)));
  const [values, setValues] = useState(() =>
    Array.from({ length: m }, (_, r) => String(query.request[r] ?? 0)),
  );
  const thread = Math.min(Number(t), n - 1);
  const cells = Array.from({ length: m }, (_, r) => values[r] ?? '0');
  const parsed = cells.map(parseNumber);
  const bad = parsed.some((v) => Number.isNaN(v) || v > LIMITS.maxBankerValue);
  const request = parsed.map((v) => (Number.isNaN(v) ? 0 : v));

  return (
    <>
      <Panel title="Safety algorithm">
        <p className="text-caption text-fg-muted">
          Is the state safe? Look for an order in which every thread can get its full
          Need.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRun({ run: 'safety', t: thread, request })}
        >
          <Play aria-hidden="true" className="size-4" />
          Run safety algorithm
        </Button>
      </Panel>
      <Panel title="Request">
        <form
          aria-label="Make a request"
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!bad) onRun({ run: 'request', t: thread, request });
          }}
        >
          <SelectField
            label="Requesting thread"
            value={String(thread)}
            options={processLabels(n).map((label, i) => ({ value: String(i), label }))}
            onChange={setT}
          />
          <div className="grid grid-cols-3 gap-2">
            {resourceLabels(m).map((label, r) => (
              <TextField
                key={label}
                label={`Request ${label}`}
                value={cells[r]!}
                messages={
                  Number.isNaN(parsed[r]!) || parsed[r]! > LIMITS.maxBankerValue
                    ? [CELL_MESSAGE]
                    : []
                }
                onChange={(text) =>
                  setValues(cells.map((value, i) => (i === r ? text : value)))
                }
              />
            ))}
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={bad}>
            <Play aria-hidden="true" className="size-4" />
            Run request
          </Button>
          <p className="text-caption text-fg-muted">
            {processName(thread)} asks for ({request.join(', ')}).
          </p>
        </form>
      </Panel>
    </>
  );
}

const CHECK_WORDS: Record<RequestCheck['status'], string> = {
  pending: 'not reached yet',
  current: 'in progress',
  pass: 'passed',
  fail: 'failed',
};

/** The request algorithm as a checklist that ticks (§7.2.5). */
export function RequestChecklist({ checks }: { checks: readonly RequestCheck[] }) {
  return (
    <ol
      aria-label="Request checks"
      className="flex flex-col gap-1"
      data-testid="request-checks"
    >
      {checks.map((check, i) => (
        <li
          key={check.id}
          data-check={check.id}
          data-status={check.status}
          className={cn(
            'text-small flex items-center gap-2',
            check.status === 'pending' && 'text-fg-muted',
          )}
        >
          <Flash
            trigger={check.status}
            active={check.changed}
            tone={check.status === 'fail' ? 'danger' : 'ok'}
          >
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex size-5 items-center justify-center rounded-full border font-mono text-xs',
                check.status === 'pass' && 'border-state-ok text-state-ok',
                check.status === 'fail' && 'border-state-error text-state-error',
                check.status === 'current' && 'border-accent text-accent',
                check.status === 'pending' && 'border-border',
              )}
            >
              {check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : i + 1}
            </span>
          </Flash>
          <span>{check.label}</span>
          <span className="sr-only">: {CHECK_WORDS[check.status]}</span>
        </li>
      ))}
    </ol>
  );
}

export interface BankersStepProps {
  state: DlSnapshot;
  /** The step's event kind, so a finish shows what the thread gave back. */
  kind?: DlEventKind;
  /** A request run: its checklist so far. */
  checks?: readonly RequestCheck[] | null;
  /** A request run between "pretend" and the decision: the matrices are ghosted. */
  pretending?: boolean;
}

/**
 * The step view: the request checklist, the comparison column by column, Allocation,
 * Need (= Max − Allocation) and Max with Available or Work, Work as a bar, Finish and
 * the result. Only the row being compared is at full strength (D2). Between "pretend
 * to allocate" and the decision the matrices are ghosted (dashed), and a roll-back says
 * so (§7.2.5).
 */
export function BankersStep({
  state,
  kind,
  checks,
  pretending = false,
}: BankersStepProps) {
  const threads = rowLabelsWithFinish(state);
  const resources = resourceLabels(state.total.length);
  const compare = state.compare;
  const changed = state.changed.map(([row, col]) => ({ row, col }));
  const requestCheck =
    compare && (compare.against === 'need' || compare.against === 'available');
  const against =
    compare?.against === 'need'
      ? { label: `Need[${processName(compare.row)}]`, values: state.need![compare.row]! }
      : { label: 'Available', values: state.available };
  const row = state.row !== null ? { highlightRow: state.row } : {};
  const workCompare =
    compare && compare.matrix === 'need' && compare.against === 'work' && state.work
      ? { compare, work: state.work }
      : null;

  return (
    <div className="flex flex-col gap-4">
      {checks ? <RequestChecklist checks={checks} /> : null}
      {requestCheck ? (
        <>
          <MatrixTable
            caption="Request"
            rowLabels={[processName(compare.row)]}
            columnLabels={resources}
            values={[compare.values]}
            vector={against}
            highlightRow={0}
            compare
          />
          <CompareStrip
            left={`Request[${processName(compare.row)}]`}
            leftValues={compare.values}
            right={against.label}
            rightValues={against.values}
            trigger={compare.against}
          />
        </>
      ) : null}
      <div
        data-pretend={pretending || undefined}
        className={cn(
          'flex flex-col gap-3',
          pretending && 'border-border-strong rounded-lg border-2 border-dashed p-3',
        )}
      >
        {pretending ? (
          <p className="text-small text-fg-secondary font-semibold">
            Pretend state, not granted yet: nothing here is final until the safety check
            passes.
          </p>
        ) : null}
        {kind === 'dl.req.rollback' ? (
          <p
            className="text-small text-fg-secondary font-semibold"
            data-testid="rolled-back"
          >
            Rolled back: the matrices are as they were before the request.
          </p>
        ) : null}
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
          {state.need ? (
            <MatrixTable
              caption="Need = Max − Allocation"
              rowLabels={threads}
              columnLabels={resources}
              values={state.need}
              {...(state.work ? { vector: { label: 'Work', values: state.work } } : {})}
              {...row}
              dimOthers
              compare={workCompare !== null}
              changed={changed}
            />
          ) : null}
          {state.max ? (
            <MatrixTable
              caption="Max"
              rowLabels={threads}
              columnLabels={resources}
              values={state.max}
              dimOthers
              {...row}
            />
          ) : null}
        </div>
      </div>
      {workCompare ? (
        <CompareStrip
          left={`Need[${processName(workCompare.compare.row)}]`}
          leftValues={workCompare.compare.values}
          right="Work"
          rightValues={workCompare.work}
          trigger={`${workCompare.compare.row}-${state.order.length}`}
        />
      ) : null}
      <WorkFinish state={state} released={releasedAt(state, kind)} />
      <ResultBanner result={state.result} />
    </div>
  );
}
