'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/timeline/ui/Button';
import {
  LIMITS,
  processName,
  resourceName,
  withEdge,
  withInstances,
  withoutEdge,
  withoutProcess,
  withoutResource,
  withProcess,
  withResource,
  type EdgeKind,
  type Graph,
  type Validation,
} from '@/core/deadlock/model';
import { EMPTY_GRAPH } from '@/core/deadlock/presets';

import { Messages, Panel, SelectField } from './fields';

/**
 * The primary graph editor: every change is a form action ("T2 requests 1 of R1"),
 * validated by the core's schema, so the whole graph can be built from the keyboard. The
 * canvas is an extra view of the same graph.
 */

export interface GraphEditorFormProps {
  graph: Graph;
  onChange: (graph: Graph) => void;
  /** A short sentence for the page's status line after each change. */
  onStatus?: (message: string) => void;
}

const COUNT_OPTIONS = Array.from({ length: LIMITS.maxInstances }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const VERBS: readonly { value: EdgeKind; label: string }[] = [
  { value: 'assignments', label: 'holds' },
  { value: 'requests', label: 'requests' },
];

function edgeText(kind: EdgeKind, t: number, r: number, n: number): string {
  return `${processName(t)} ${kind === 'assignments' ? 'holds' : 'requests'} ${n} of ${resourceName(r)}`;
}

export function GraphEditorForm({ graph, onChange, onStatus }: GraphEditorFormProps) {
  const [t, setT] = useState('0');
  const [kind, setKind] = useState<EdgeKind>('assignments');
  const [n, setN] = useState('1');
  const [r, setR] = useState('0');
  const [newInstances, setNewInstances] = useState('1');
  const [removeT, setRemoveT] = useState('0');
  const [errors, setErrors] = useState<string[]>([]);

  // Keep the selects in range when the graph shrinks.
  const tIndex = Math.min(Number(t), graph.processes - 1);
  const rIndex = Math.min(Number(r), graph.instances.length - 1);
  const removeIndex = Math.min(Number(removeT), graph.processes - 1);

  const apply = (result: Validation<Graph>, done: string) => {
    if (result.ok) {
      setErrors([]);
      onChange(result.value);
      onStatus?.(done);
    } else {
      const messages = [...new Set(result.issues.map((i) => i.message))];
      setErrors(messages);
      onStatus?.(`Not changed: ${messages[0]}`);
    }
  };

  const threadOptions = Array.from({ length: graph.processes }, (_, i) => ({
    value: String(i),
    label: processName(i),
  }));
  const resourceOptions = graph.instances.map((_, i) => ({
    value: String(i),
    label: resourceName(i),
  }));

  const edges = [
    ...graph.assignments.map((e) => ({ kind: 'assignments' as const, ...e })),
    ...graph.requests.map((e) => ({ kind: 'requests' as const, ...e })),
  ].sort((a, b) => a.t - b.t || a.r - b.r || (a.kind < b.kind ? -1 : 1));

  return (
    <>
      <Panel title="Edges">
        <form
          aria-label="Add an edge"
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply(
              withEdge(graph, kind, tIndex, rIndex, Number(n)),
              `Added: ${edgeText(kind, tIndex, rIndex, Number(n))}.`,
            );
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Thread"
              value={String(tIndex)}
              options={threadOptions}
              onChange={setT}
            />
            <SelectField label="Edge" value={kind} options={VERBS} onChange={setKind} />
            <SelectField
              label="Count"
              value={n}
              options={COUNT_OPTIONS}
              onChange={setN}
            />
            <SelectField
              label="Resource"
              value={String(rIndex)}
              options={resourceOptions}
              onChange={setR}
            />
          </div>
          <p className="text-caption text-fg-muted">
            {edgeText(kind, tIndex, rIndex, Number(n))}.
          </p>
          <Button type="submit" variant="primary" size="sm">
            <Plus aria-hidden="true" className="size-4" />
            Add edge
          </Button>
          <div aria-live="polite">
            <Messages id="graph-edge-errors" messages={errors} />
          </div>
        </form>
        {edges.length === 0 ? (
          <p className="text-caption text-fg-muted">No edges yet.</p>
        ) : (
          <ul aria-label="Edges in the graph" className="flex flex-col gap-1">
            {edges.map((e) => {
              const text = edgeText(e.kind, e.t, e.r, e.n);
              return (
                <li
                  key={`${e.kind}-${e.t}-${e.r}`}
                  className="text-small flex items-center justify-between gap-2"
                >
                  <span className="font-mono">{text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove: ${text}`}
                    onClick={() => {
                      setErrors([]);
                      onChange(withoutEdge(graph, e.kind, e.t, e.r));
                      onStatus?.(`Removed: ${text}.`);
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Threads and resources">
        <p className="text-small">
          {graph.processes} {graph.processes === 1 ? 'thread' : 'threads'}:{' '}
          <span className="font-mono">
            {threadOptions.map((o) => o.label).join(', ')}
          </span>
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={graph.processes >= LIMITS.maxProcesses}
            onClick={() =>
              apply(withProcess(graph), `Added thread ${processName(graph.processes)}.`)
            }
          >
            Add thread
          </Button>
          <SelectField
            label="Thread to remove"
            value={String(removeIndex)}
            options={threadOptions}
            onChange={setRemoveT}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={graph.processes <= LIMITS.minProcesses}
            onClick={() =>
              apply(
                withoutProcess(graph, removeIndex),
                `Removed ${processName(removeIndex)} and its edges; later threads were renumbered.`,
              )
            }
          >
            Remove thread
          </Button>
        </div>

        <ul aria-label="Resource types" className="flex flex-col gap-2">
          {graph.instances.map((count, i) => (
            <li key={i} className="flex items-end gap-2">
              <SelectField
                className="flex-1"
                label={`${resourceName(i)} instances`}
                value={String(count)}
                options={COUNT_OPTIONS}
                onChange={(value) =>
                  apply(
                    withInstances(graph, i, Number(value)),
                    `${resourceName(i)} now has ${value} ${value === '1' ? 'instance' : 'instances'}.`,
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${resourceName(i)}`}
                disabled={graph.instances.length <= LIMITS.minResources}
                onClick={() =>
                  apply(
                    withoutResource(graph, i),
                    `Removed ${resourceName(i)} and its edges; later resources were renumbered.`,
                  )
                }
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <SelectField
            className="flex-1"
            label="New resource instances"
            value={newInstances}
            options={COUNT_OPTIONS}
            onChange={setNewInstances}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={graph.instances.length >= LIMITS.maxResources}
            onClick={() =>
              apply(
                withResource(graph, Number(newInstances)),
                `Added ${resourceName(graph.instances.length)} with ${newInstances} ${
                  newInstances === '1' ? 'instance' : 'instances'
                }.`,
              )
            }
          >
            Add resource
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setErrors([]);
            onChange(EMPTY_GRAPH);
            onStatus?.(
              'Cleared: two threads and two single-instance resources, no edges.',
            );
          }}
        >
          Clear graph
        </Button>
      </Panel>
    </>
  );
}
