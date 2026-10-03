'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { ProcessChip } from '@/components/shell/ProcessChip';
import { Button } from '@/components/timeline/ui/Button';
import {
  LIMITS,
  pidNumber,
  validateWorkload,
  type ValidationIssue,
  type Workload,
} from '@/core/sched/workload';
import { cn } from '@/lib/cn';

import { INPUT } from './fields';

/**
 * The workload editor: one small form per process (arrival, bursts, priority) and the
 * context-switch cost. Every field is a native input, so it is fully keyboard operable.
 *
 * Fields keep what you type; each change is validated with the core's Zod schema, and
 * only a valid workload reaches `onChange`. Until then the schema's messages show next
 * to the field they are about. Remount (change `key`) to load a different workload.
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
  return [...new Set(issues.filter((i) => match(i.path)).map((i) => i.message))];
}

function Messages({ id, messages }: { id: string; messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul id={id} className="text-caption text-state-error flex flex-col gap-0.5">
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

export interface WorkloadEditorProps {
  workload: Workload;
  onChange: (workload: Workload) => void;
  /** Hide the priority field (policies that ignore priority still keep the value). */
  showPriority?: boolean;
  className?: string;
}

export function WorkloadEditor({
  workload,
  onChange,
  showPriority = true,
  className,
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

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ul aria-label="Processes" className="flex flex-col gap-3">
        {draft.rows.map((row, index) => {
          const at = (field: string) =>
            issuesFor(
              issues,
              (p) => p[0] === 'processes' && p[1] === index && p[2] === field,
            );
          return (
            <li key={row.pid}>
              <fieldset className="border-border rounded-md border p-3">
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
                      label={`${row.pid} priority`}
                      value={row.priority}
                      numeric
                      onChange={(priority) => setRow(index, { priority })}
                      messages={at('priority')}
                    />
                  ) : (
                    <span />
                  )}
                  <TextField
                    label={`${row.pid} bursts`}
                    value={row.bursts}
                    wide
                    hint="CPU, I/O, CPU, …: e.g. 5, or 3, 2, 4"
                    onChange={(bursts) => setRow(index, { bursts })}
                    messages={at('bursts')}
                  />
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
      <TextField
        label={`Context-switch cost (0–${LIMITS.maxContextSwitch} ticks)`}
        value={draft.contextSwitch}
        numeric
        onChange={(contextSwitch) => update({ ...draft, contextSwitch })}
        messages={csIssues}
      />
      {issues.length > 0 ? (
        <p role="status" className="text-caption text-state-error">
          The run shows the last valid workload until these are fixed.
        </p>
      ) : null}
    </div>
  );
}
