'use client';

import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge as FlowEdge,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import './GraphCanvas.css';
import { useMemo, useState } from 'react';

import type { DlSnapshot } from '@/core/deadlock/events';
import { processName, resourceName, type EdgeKind } from '@/core/deadlock/model';
import { cn } from '@/lib/cn';

/**
 * The graph drawn with React Flow: an extra view of the same state the form edits.
 * Drag from a thread's lower right handle to a resource to add a request edge, or from a
 * resource's upper left handle to a thread to add an assignment edge; drag a node to move
 * it. Every edit goes through the same validated path as the form.
 *
 * The layout is deterministic (threads in a top row, resource types below, instances as
 * dots), so a shared link looks the same for everyone. Moved nodes are this viewer's
 * own and reset when the graph's shape changes.
 *
 * Loaded with `next/dynamic` only on `/deadlock`; `@xyflow/react` may not be imported
 * anywhere else (boundary rule 5). Nodes are not in the tab order: the form is the
 * keyboard way to do everything this does.
 */

export interface GraphCanvasProps {
  state: DlSnapshot;
  /** Add one instance's edge; the parent validates it. */
  onConnect?: (kind: EdgeKind, t: number, r: number) => void;
  className?: string;
}

type Mark = 'cycle' | 'current' | 'deadlocked' | 'terminated' | 'finished' | 'stack';

interface ThreadData extends Record<string, unknown> {
  label: string;
  marks: Mark[];
}

interface ResourceData extends Record<string, unknown> {
  label: string;
  total: number;
  free: number;
  marks: Mark[];
}

const GAP = 120;
const RESOURCE_Y = 190;

function ThreadNode({ data }: NodeProps<Node<ThreadData>>) {
  const { marks } = data;
  return (
    <div
      className={cn(
        'border-border-strong bg-surface text-fg flex size-14 items-center justify-center rounded-full border-2 font-mono text-sm font-semibold',
        marks.includes('finished') && 'border-state-ok',
        marks.includes('stack') && 'border-accent',
        marks.includes('current') && 'outline-accent outline-2 outline-offset-2',
        (marks.includes('cycle') || marks.includes('deadlocked')) &&
          'border-state-error bg-surface-overlay',
        marks.includes('terminated') && 'border-dashed opacity-60',
      )}
    >
      <Handle
        type="target"
        id="in"
        position={Position.Bottom}
        style={{ left: '35%' }}
        isConnectable={false}
      />
      {data.label}
      <Handle type="source" id="out" position={Position.Bottom} style={{ left: '65%' }} />
    </div>
  );
}

function ResourceNode({ data }: NodeProps<Node<ResourceData>>) {
  return (
    <div
      className={cn(
        'border-border-strong bg-surface-raised text-fg flex min-w-16 flex-col items-center gap-1 rounded-md border-2 px-2 py-1.5 font-mono text-sm font-semibold',
        data.marks.includes('cycle') && 'border-state-error',
      )}
    >
      <Handle type="source" id="out" position={Position.Top} style={{ left: '35%' }} />
      <span>{data.label}</span>
      <span className="flex flex-wrap justify-center gap-1" aria-hidden="true">
        {Array.from({ length: data.total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'border-fg-muted size-2 rounded-full border',
              i < data.total - data.free && 'bg-fg-muted',
            )}
          />
        ))}
      </span>
      <Handle
        type="target"
        id="in"
        position={Position.Top}
        style={{ left: '65%' }}
        isConnectable={false}
      />
    </div>
  );
}

const NODE_TYPES = { thread: ThreadNode, resource: ResourceNode };

/** Where each node goes before anyone drags it. */
export function layout(processes: number, resources: number) {
  const width = Math.max(processes, resources) - 1;
  const offset = (count: number) => ((width - (count - 1)) * GAP) / 2;
  return {
    thread: (t: number) => ({ x: offset(processes) + t * GAP, y: 0 }),
    resource: (r: number) => ({ x: offset(resources) + r * GAP, y: RESOURCE_Y }),
  };
}

/** Consecutive node pairs of the cycle, as edge ids. */
function cycleEdges(cycle: readonly string[] | null): Set<string> {
  const ids = new Set<string>();
  if (!cycle) return ids;
  for (let i = 1; i < cycle.length; i += 1) ids.add(`${cycle[i - 1]}-${cycle[i]}`);
  return ids;
}

export default function GraphCanvas({ state, onConnect, className }: GraphCanvasProps) {
  const processes = state.allocation.length;
  const resources = state.total.length;
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});
  const at = useMemo(() => layout(processes, resources), [processes, resources]);

  const inCycle = new Set(state.cycle ?? []);
  const deadlocked =
    state.result?.kind === 'deadlocked'
      ? new Set(state.result.set)
      : state.result?.kind === 'cycle'
        ? new Set(
            state.result.cycle
              .filter((id) => id.startsWith('T'))
              .map((id) => Number(id.slice(1))),
          )
        : new Set<number>();
  const onStack = new Set(state.dfs?.stack ?? []);
  const request = state.request ?? state.allocation.map((row) => row.map(() => 0));

  const nodes: Node[] = [
    ...Array.from({ length: processes }, (_, t): Node<ThreadData> => {
      const id = processName(t);
      const marks: Mark[] = [];
      if (inCycle.has(id)) marks.push('cycle');
      if (deadlocked.has(t)) marks.push('deadlocked');
      if (state.row === t) marks.push('current');
      if (state.terminated.includes(t)) marks.push('terminated');
      if (state.finish?.[t]) marks.push('finished');
      if (onStack.has(t)) marks.push('stack');
      return {
        id,
        type: 'thread',
        position: moved[id] ?? at.thread(t),
        data: { label: id, marks },
      };
    }),
    ...Array.from({ length: resources }, (_, r): Node<ResourceData> => {
      const id = resourceName(r);
      return {
        id,
        type: 'resource',
        position: moved[id] ?? at.resource(r),
        data: {
          label: id,
          total: state.total[r]!,
          free: state.available[r]!,
          marks: inCycle.has(id) ? ['cycle'] : [],
        },
      };
    }),
  ];

  const highlighted = cycleEdges(state.cycle);
  const edge = (
    source: string,
    target: string,
    n: number,
    kind: 'request' | 'assignment',
  ): FlowEdge => {
    const id = `${source}-${target}`;
    const hot = highlighted.has(id);
    const colour = hot ? 'var(--color-state-error)' : 'var(--color-fg-muted)';
    return {
      id,
      source,
      target,
      sourceHandle: 'out',
      targetHandle: 'in',
      type: 'straight',
      label: n > 1 ? `×${n}` : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: colour },
      style: {
        stroke: colour,
        strokeWidth: hot ? 3 : 1.5,
        strokeDasharray: kind === 'request' ? '6 4' : undefined,
      },
      labelStyle: { fill: 'var(--color-fg)' },
      labelBgStyle: { fill: 'var(--color-surface)' },
    };
  };
  const edges: FlowEdge[] = [
    ...state.allocation.flatMap((row, t) =>
      row.flatMap((n, r) =>
        n > 0 ? [edge(resourceName(r), processName(t), n, 'assignment')] : [],
      ),
    ),
    ...request.flatMap((row, t) =>
      row.flatMap((n, r) =>
        n > 0 ? [edge(processName(t), resourceName(r), n, 'request')] : [],
      ),
    ),
  ];

  const onNodesChange = (changes: NodeChange[]) => {
    const next: Record<string, { x: number; y: number }> = {};
    for (const change of changes) {
      if (change.type === 'position' && change.position)
        next[change.id] = change.position;
    }
    if (Object.keys(next).length > 0) setMoved((current) => ({ ...current, ...next }));
  };

  const valid = (c: Connection | FlowEdge) =>
    (c.source.startsWith('T') && c.target.startsWith('R')) ||
    (c.source.startsWith('R') && c.target.startsWith('T'));

  return (
    <div
      className={cn(
        'deadlock-canvas border-border bg-surface h-80 w-full rounded-lg border',
        className,
      )}
      data-testid="graph-canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onConnect={(c) => {
          if (!onConnect || !valid(c)) return;
          if (c.source.startsWith('T')) {
            onConnect('requests', Number(c.source.slice(1)), Number(c.target.slice(1)));
          } else {
            onConnect(
              'assignments',
              Number(c.target.slice(1)),
              Number(c.source.slice(1)),
            );
          }
        }}
        isValidConnection={valid}
        nodesConnectable={onConnect !== undefined}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        panOnDrag={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      />
    </div>
  );
}
