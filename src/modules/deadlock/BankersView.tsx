'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';

import { MatrixTable } from '@/components/blocks/MatrixTable';
import { Button } from '@/components/timeline/ui/Button';
import type { DlSnapshot } from '@/core/deadlock/events';
import {
  LIMITS,
  needOf,
  processName,
  resizeBankers,
  validateBankers,
  type BankersState,
} from '@/core/deadlock/model';
import type { BankersQuery } from '@/core/deadlock/presets';

import { processLabels, resourceLabels } from './adapters';
import { Messages, Panel, parseNumber, SelectField, TextField } from './fields';
import { ResultBanner, WorkFinish } from './StepState';

/**
 * The Banker's tab: an editor for Max, Allocation and Available (Need is computed, never
 * edited), the request form, and the step view of the safety or request algorithm.
 */

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
      <div className="flex flex-wrap gap-6">
        <MatrixTable
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
          <MatrixTable
            caption="Need = Max − Allocation"
            rowLabels={threads}
            columnLabels={resources}
            values={needOf(draft)}
          />
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
                    ? [`0 to ${LIMITS.maxBankerValue}`]
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

/** The step view: Allocation, Need and Max with Available or Work, Finish, the result. */
export function BankersStep({ state }: { state: DlSnapshot }) {
  const threads = processLabels(state.allocation.length);
  const resources = resourceLabels(state.total.length);
  const compare = state.compare;
  const changed = state.changed.map(([row, col]) => ({ row, col }));
  const requestCheck =
    compare && (compare.against === 'need' || compare.against === 'available');
  const against =
    compare?.against === 'need'
      ? { label: `Need[${processName(compare.row)}]`, values: state.need![compare.row]! }
      : { label: 'Available', values: state.available };

  return (
    <div className="flex flex-col gap-4">
      {requestCheck ? (
        <MatrixTable
          caption="Request"
          rowLabels={[processName(compare.row)]}
          columnLabels={resources}
          values={[compare.values]}
          vector={against}
          highlightRow={0}
          compare
        />
      ) : null}
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
        {state.need ? (
          <MatrixTable
            caption="Need"
            rowLabels={threads}
            columnLabels={resources}
            values={state.need}
            {...(state.work ? { vector: { label: 'Work', values: state.work } } : {})}
            {...(state.row !== null ? { highlightRow: state.row } : {})}
            compare={compare?.matrix === 'need' && compare.against === 'work'}
            changed={changed}
          />
        ) : null}
        {state.max ? (
          <MatrixTable
            caption="Max"
            rowLabels={threads}
            columnLabels={resources}
            values={state.max}
          />
        ) : null}
      </div>
      <WorkFinish state={state} />
      <ResultBanner result={state.result} />
    </div>
  );
}
