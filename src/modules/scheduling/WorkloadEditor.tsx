'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { useId, useState, type FocusEvent } from 'react';

import { ProcessChip } from '@/components/shell/ProcessChip';
import { Button } from '@/components/timeline/ui/Button';
import {
  LIMITS,
  pidNumber,
  type ValidationIssue,
  type Workload,
} from '@/core/sched/workload';
import { validateWorkload } from '@/core/sched/workload.schema';
import { cn } from '@/lib/cn';

import { INPUT, MoreOptions, NumberField } from './fields';
import { HUMAN, humanMessage } from './messages';

/**
 * The workload editor: one small form per process (arrival, bursts, priority) and the
 * context-switch cost. Every field is a native input, so it is fully keyboard operable.
 *
 * Fields keep what you type; each change is validated with the core's Zod schema, and
 * only a valid workload reaches `onChange`. Until then a plain-words message (G11) shows
 * next to the field it is about. Remount (change `key`) to load a different workload.
 *
 * Opt-in extras, so Compare's editor is unchanged until it asks for them:
 * - `burstBuilder` (S1): the bursts as a row of blocks, solid for CPU and dashed for I/O,
 *   each with its number, and "+ CPU" / "+ I/O" buttons. The text field stays, folded
 *   under "Type the bursts", for power users.
 * - `disclose` (G10): the context-switch cost goes under "More options".
 * - `highlightPid` / `onPidHover` (S4): linked highlighting from a process's form.
 */

interface RowDraft {
  pid: string;
  arrival: string;
  bursts: string;
  priority: string;
}

interface Draft {
  rows: RowDraft[];
  contextSwitch: string;
}

function toDraft(workload: Workload): Draft {
  return {
    rows: workload.processes.map((p) => ({
      pid: p.pid,
      arrival: String(p.arrival),
      bursts: p.bursts.join(', '),
      priority: String(p.priority),
    })),
    contextSwitch: String(workload.contextSwitch),
  };
}

function num(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

/** `'3, 2 4'` → `[3, 2, 4]`. */
export function parseBursts(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
}

function fromDraft(draft: Draft): unknown {
  return {
    processes: draft.rows.map((row) => ({
      pid: row.pid,
      arrival: num(row.arrival),
      bursts: parseBursts(row.bursts),
      priority: num(row.priority),
    })),
    contextSwitch: num(draft.contextSwitch),
  };
}

function nextPid(rows: readonly RowDraft[]): string | null {
  const used = new Set(rows.map((r) => r.pid));
  for (let n = 1; n <= LIMITS.maxProcesses; n += 1) {
    if (!used.has(`P${n}`)) return `P${n}`;
  }
  return null;
}

function issuesFor(
  issues: readonly ValidationIssue[],
  match: (path: ValidationIssue['path']) => boolean,
): string[] {
  return [...new Set(issues.filter((i) => match(i.path)).map(humanMessage))];
}

function Messages({ id, messages }: { id: string; messages: readonly string[] }) {
  return (
    <ul
      id={id}
      aria-live="polite"
      className="text-caption text-state-error col-span-2 flex flex-col gap-0.5 empty:hidden"
    >
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

function TextField({
  label,
  value,
  onChange,
  messages,
  hint,
  wide,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  messages: readonly string[];
  hint?: string;
  wide?: boolean;
  numeric?: boolean;
}) {
  const id = useId();
  const described = [messages.length > 0 ? `${id}-err` : '', hint ? `${id}-hint` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cn('flex flex-col gap-1', wide && 'col-span-2')}>
      <label htmlFor={id} className="text-caption text-fg-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode={numeric ? 'numeric' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        aria-invalid={messages.length > 0 || undefined}
        aria-describedby={described || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          INPUT,
          'w-full',
          messages.length > 0 && 'border-state-error border-2',
        )}
      />
      {hint ? (
        <span id={`${id}-hint`} className="text-caption text-fg-muted">
          {hint}
        </span>
      ) : null}
      <Messages id={`${id}-err`} messages={messages} />
    </span>
  );
}

/**
 * S1: the bursts as blocks. Solid = CPU, dashed outline = I/O, each with its length in
 * a number field. Only in-range numbers reach the draft (`NumberField`), so a block
 * never vanishes while it is being retyped.
 */
function BurstBuilder({
  pid,
  text,
  onChange,
}: {
  pid: string;
  text: string;
  onChange: (text: string) => void;
}) {
  const bursts = parseBursts(text);
  const set = (next: number[]) => onChange(next.join(', '));
  const endsOnCpu = bursts.length % 2 === 1;
  const full = bursts.length >= LIMITS.maxBursts;
  const counts = { cpu: 0, io: 0 };

  return (
    <div className="col-span-2 flex flex-col gap-2">
      <span className="text-caption text-fg-muted" aria-hidden="true">
        {pid} bursts, in order
      </span>
      <ol
        aria-label={`${pid} bursts, in order`}
        className="flex flex-wrap items-start gap-1.5"
      >
        {bursts.map((value, i) => {
          const isCpu = i % 2 === 0;
          const n = isCpu ? (counts.cpu += 1) : (counts.io += 1);
          const kind = isCpu ? 'CPU' : 'I/O';
          return (
            <li
              key={i}
              data-burst={isCpu ? 'cpu' : 'io'}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-md border-2 px-1.5 pt-1 pb-1',
                isCpu
                  ? 'border-fg-secondary bg-surface-overlay'
                  : 'border-fg-muted border-dashed',
              )}
            >
              <span
                aria-hidden="true"
                className="text-caption text-fg-secondary font-semibold"
              >
                {kind}
              </span>
              <NumberField
                label={`${pid} ${kind} burst ${n} (ticks)`}
                hideLabel
                value={Number.isInteger(value) ? value : LIMITS.minBurst}
                min={LIMITS.minBurst}
                max={LIMITS.maxBurst}
                error={HUMAN.burst}
                onChange={(next) => set(bursts.map((b, j) => (j === i ? next : b)))}
                inputClassName="w-14 text-center"
              />
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={endsOnCpu || full}
          onClick={() => set([...bursts, 3])}
          aria-label={`Add a CPU burst to ${pid}`}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          CPU
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!endsOnCpu || full}
          onClick={() => set([...bursts, 2])}
          aria-label={`Add an I/O burst to ${pid}`}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          I/O
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={bursts.length <= 1}
          onClick={() => set(bursts.slice(0, -1))}
          aria-label={`Remove ${pid}’s last burst`}
        >
          <Minus aria-hidden="true" className="size-3.5" />
          Last
        </Button>
      </div>
    </div>
  );
}

export interface WorkloadEditorProps {
  workload: Workload;
  onChange: (workload: Workload) => void;
  /** Hide the priority field (policies that ignore priority still keep the value). */
  showPriority?: boolean;
  className?: string;
  /** Edit bursts as blocks, with the text field folded away (S1). */
  burstBuilder?: boolean;
  /** Put the context-switch cost under "More options" (G10). */
  disclose?: boolean;
  /** Linked highlighting (S4): the process to ring. */
  highlightPid?: string | null;
  /** The process under the pointer or holding focus, or `null`. */
  onPidHover?: (pid: string | null) => void;
}

export function WorkloadEditor({
  workload,
  onChange,
  showPriority = true,
  className,
  burstBuilder = false,
  disclose = false,
  highlightPid = null,
  onPidHover,
}: WorkloadEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(workload));
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  const update = (next: Draft) => {
    setDraft(next);
    const result = validateWorkload(fromDraft(next));
    if (result.ok) {
      setIssues([]);
      onChange(result.value);
    } else {
      setIssues(result.issues);
    }
  };

  const setRow = (index: number, patch: Partial<RowDraft>) =>
    update({
      ...draft,
      rows: draft.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });

  const add = () => {
    const pid = nextPid(draft.rows);
    if (!pid) return;
    const rows = [...draft.rows, { pid, arrival: '0', bursts: '3', priority: '0' }];
    rows.sort((a, b) => pidNumber(a.pid) - pidNumber(b.pid));
    update({ ...draft, rows });
  };

  const remove = (index: number) =>
    update({ ...draft, rows: draft.rows.filter((_, i) => i !== index) });

  const listIssues = issuesFor(issues, (p) => p[0] === 'processes' && p.length === 1);
  const csIssues = issuesFor(issues, (p) => p[0] === 'contextSwitch');

  const hover = (pid: string) =>
    onPidHover
      ? {
          onMouseEnter: () => onPidHover(pid),
          onMouseLeave: () => onPidHover(null),
          onFocus: () => onPidHover(pid),
          onBlur: (event: FocusEvent<HTMLElement>) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              onPidHover(null);
            }
          },
        }
      : {};

  const contextSwitch = (
    <TextField
      label={`Context-switch cost (0–${LIMITS.maxContextSwitch} ticks)`}
      value={draft.contextSwitch}
      numeric
      onChange={(contextSwitch) => update({ ...draft, contextSwitch })}
      messages={csIssues}
    />
  );

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {showPriority ? (
        <p className="text-caption text-fg-muted">
          Priority: <strong className="text-fg-secondary">0 is the highest</strong>, 9 the
          lowest.
        </p>
      ) : null}
      <ul aria-label="Processes" className="flex flex-col gap-3">
        {draft.rows.map((row, index) => {
          const at = (field: string) =>
            issuesFor(
              issues,
              (p) => p[0] === 'processes' && p[1] === index && p[2] === field,
            );
          const highlighted = highlightPid === row.pid;
          const burstsField = (messages: readonly string[]) => (
            <TextField
              label={`${row.pid} bursts`}
              value={row.bursts}
              wide
              hint="CPU, I/O, CPU, …: e.g. 5, or 3, 2, 4"
              onChange={(bursts) => setRow(index, { bursts })}
              messages={messages}
            />
          );
          return (
            <li key={row.pid}>
              <fieldset
                {...hover(row.pid)}
                data-pid={row.pid}
                data-highlight={highlighted ? '' : undefined}
                className={cn(
                  'border-border rounded-md border p-3',
                  highlighted && 'border-accent shadow-[inset_3px_0_0_var(--accent)]',
                )}
              >
                <legend className="px-1">
                  <ProcessChip pid={pidNumber(row.pid)} />
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label={`${row.pid} arrival`}
                    value={row.arrival}
                    numeric
                    onChange={(arrival) => setRow(index, { arrival })}
                    messages={at('arrival')}
                  />
                  {showPriority ? (
                    <TextField
                      label={`${row.pid} priority (0 = highest)`}
                      value={row.priority}
                      numeric
                      onChange={(priority) => setRow(index, { priority })}
                      messages={at('priority')}
                    />
                  ) : (
                    <span />
                  )}
                  {burstBuilder ? (
                    <>
                      <BurstBuilder
                        pid={row.pid}
                        text={row.bursts}
                        onChange={(bursts) => setRow(index, { bursts })}
                      />
                      <Messages id={`bursts-${row.pid}-errors`} messages={at('bursts')} />
                      <details className="col-span-2">
                        <summary className="text-caption text-fg-muted cursor-pointer">
                          Type the bursts
                        </summary>
                        <div className="mt-2 grid grid-cols-2">{burstsField([])}</div>
                      </details>
                    </>
                  ) : (
                    burstsField(at('bursts'))
                  )}
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    disabled={draft.rows.length <= LIMITS.minProcesses}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    Remove {row.pid}
                  </Button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>
      <Messages id="workload-list-errors" messages={listIssues} />
      <Button
        variant="secondary"
        size="sm"
        onClick={add}
        disabled={draft.rows.length >= LIMITS.maxProcesses}
      >
        <Plus aria-hidden="true" className="size-3.5" />
        Add process
      </Button>
      {disclose ? <MoreOptions>{contextSwitch}</MoreOptions> : contextSwitch}
      {issues.length > 0 ? (
        <p role="status" className="text-caption text-state-error">
          The run shows the last valid workload until these are fixed.
        </p>
      ) : null}
    </div>
  );
}
