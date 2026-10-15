'use client';

import {
  EdgeText,
  getStraightPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge as FlowEdge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import './GraphCanvas.css';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { DrawPath } from '@/components/motion/DrawPath';
import { DURATION } from '@/components/motion/tokens';
import {
  StepTransitionProvider,
  useStepTransition,
} from '@/components/motion/useStepTransition';
import type { DlEventKind, DlSnapshot } from '@/core/deadlock/events';
import { processName, resourceName, type EdgeKind } from '@/core/deadlock/model';
import { STEP_MS } from '@/core/events/builder';
import { cn } from '@/lib/cn';

import { useCoarsePointer } from './touch';

/**
 * The graph drawn with React Flow: an extra view of the same state the form edits.
 * Drag from a thread's lower right handle to a resource to add a request edge, or from a
 * resource's upper left handle to a thread to add an assignment edge; drag a node to move
 * it. Every edit goes through the same validated path as the form.
 *
 * **On a touch screen it is view-only** (D4): drag pans, pinch zooms, and nothing can be
 * moved or connected, so a finger never fights a tiny handle. The form is the editor
 * there, and the page says so.
 *
 * Motion (§7.2.5), every piece ending in a static picture that says the same thing:
 *
 * - Request edges are dashed and **flow** toward the resource (the `idle-cycle`
 *   keyframe, a dash-offset loop); assignment edges are solid. Reduced motion stops the
 *   flow; the dashes stay.
 * - During cycle detection the DFS path is drawn in **edge by edge** (`<DrawPath>` as a
 *   mask, so a dashed edge stays dashed), in the accent colour.
 * - When the cycle closes, its edges draw in **in sequence round the loop** and stay
 *   thick, red and labelled "cycle".
 * - An edge added from the form draws in; an edge that goes (an edit, a recovery) fades
 *   out. Edits count as a step forward for this canvas only (`motionStep`), so they
 *   animate under the same rules as playback, and not at all under reduced motion.
 * - A terminated thread fades to its dashed, dimmed resting state.
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
  /** The step's event, to know when the DFS takes an edge or the cycle closes. */
  kind?: DlEventKind;
  /**
   * Grows by one on each forward step and on each edit: the canvas's own step counter,
   * so an edit draws its new edge in like a step would.
   */
  motionStep?: number;
  /** Add one instance's edge; the parent validates it. */
  onConnect?: (kind: EdgeKind, t: number, r: number) => void;
  className?: string;
}

type Mark = 'cycle' | 'current' | 'deadlocked' | 'terminated' | 'finished' | 'stack';

interface ThreadData extends Record<string, unknown> {
  label: string;
  marks: Mark[];
  /** False on a touch screen: the handles take no drag. */
  connectable: boolean;
}

interface ResourceData extends Record<string, unknown> {
  label: string;
  connectable: boolean;
  total: number;
  free: number;
  marks: Mark[];
}

type Tone = 'plain' | 'path' | 'cycle';

interface DlEdgeData extends Record<string, unknown> {
  kind: 'request' | 'assignment';
  n: number;
  tone: Tone;
  /** Draw this edge in on this step. */
  draw: boolean;
  /** Restarts the draw. */
  drawKey: string;
  /** Where in a sequence it starts: 0 for the first edge, up to 1. */
  order: number;
  /** A removed edge on its way out. */
  ghost?: 'start' | 'faded';
  fadeMs?: number;
}

type DlFlowEdge = FlowEdge<DlEdgeData, 'dl'>;

const GAP = 120;
const RESOURCE_Y = 190;
const REQUEST_DASH = '6 4';

function ThreadNode({ data }: NodeProps<Node<ThreadData>>) {
  const { marks } = data;
  const { scale } = useStepTransition();
  return (
    <div
      data-thread={data.label}
      data-marks={marks.join(' ')}
      style={{
        transitionProperty: 'opacity',
        transitionDuration: `${scale(DURATION.enter)}ms`,
      }}
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
      <Handle
        type="source"
        id="out"
        position={Position.Bottom}
        style={{ left: '65%' }}
        isConnectable={data.connectable}
      />
    </div>
  );
}

function ResourceNode({ data }: NodeProps<Node<ResourceData>>) {
  return (
    <div
      data-resource={data.label}
      className={cn(
        'border-border-strong bg-surface-raised text-fg flex min-w-16 flex-col items-center gap-1 rounded-md border-2 px-2 py-1.5 font-mono text-sm font-semibold',
        data.marks.includes('cycle') && 'border-state-error',
      )}
    >
      <Handle
        type="source"
        id="out"
        position={Position.Top}
        style={{ left: '35%' }}
        isConnectable={data.connectable}
      />
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

/**
 * Where an edge's label sits: this far along the edge from its source, not at the middle.
 * Two edges that cross (the two-locks preset's requests, T0 → R1 and T1 → R0) cross at
 * their middles, so labels there land on top of each other; a quarter of the way from
 * each edge's own source puts them apart, and clear of the arrowhead at the target.
 */
export const LABEL_AT = 0.25;

export function edgeLabelPoint(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): [number, number] {
  return [
    sourceX + (targetX - sourceX) * LABEL_AT,
    sourceY + (targetY - sourceY) * LABEL_AT,
  ];
}

const TONE_COLOUR: Record<Tone, string> = {
  plain: 'var(--color-fg-muted)',
  path: 'var(--color-accent)',
  cycle: 'var(--color-state-error)',
};

/** An edge: the line, a draw-in mask on the step it appears, and its label. */
function DlEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps<DlFlowEdge>) {
  const { scale } = useStepTransition();
  const [d] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const [labelX, labelY] = edgeLabelPoint(sourceX, sourceY, targetX, targetY);
  if (!data) return null;
  const request = data.kind === 'request';
  const drawing = data.draw && scale(DURATION.enter) > 0;
  // The whole sequence fits in one highlight's length after the first edge starts.
  const delay = Math.round(data.order * scale(DURATION.highlight));
  const maskId = `dl-draw-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const label = [data.tone === 'cycle' ? 'cycle' : null, data.n > 1 ? `×${data.n}` : null]
    .filter(Boolean)
    .join(' ');
  const ghostStyle: CSSProperties | undefined = data.ghost
    ? {
        opacity: data.ghost === 'faded' ? 0 : 1,
        transitionProperty: 'opacity',
        transitionDuration: `${data.fadeMs ?? 0}ms`,
      }
    : undefined;

  return (
    <g
      data-edge={id}
      data-kind={data.kind}
      data-tone={data.tone}
      data-ghost={data.ghost}
      data-drawing={drawing ? '' : undefined}
      style={ghostStyle}
    >
      {drawing ? (
        <>
          {/* What was there before: the plain edge, under the one drawing in. */}
          {data.tone !== 'plain' ? (
            <path
              d={d}
              fill="none"
              style={{
                stroke: TONE_COLOUR.plain,
                strokeWidth: 1.5,
                strokeDasharray: request ? REQUEST_DASH : undefined,
              }}
            />
          ) : null}
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
          >
            <DrawPath
              d={d}
              trigger={data.drawKey}
              fill="none"
              stroke="white"
              strokeWidth={16}
              strokeLinecap="round"
              style={{ animationDelay: `${delay}ms` }}
            />
          </mask>
        </>
      ) : null}
      <path
        d={d}
        fill="none"
        markerEnd={markerEnd}
        mask={drawing ? `url(#${maskId})` : undefined}
        className={cn(request && !data.ghost && 'animate-idle-cycle')}
        style={
          {
            stroke: TONE_COLOUR[data.tone],
            strokeWidth: data.tone === 'plain' ? 1.5 : 3,
            strokeDasharray: request ? REQUEST_DASH : undefined,
            '--idle-dashoffset': '-10',
          } as CSSProperties
        }
      />
      {label ? (
        <EdgeText
          x={labelX}
          y={labelY}
          label={label}
          labelStyle={{
            fill: data.tone === 'cycle' ? 'var(--color-state-error)' : 'var(--color-fg)',
            fontWeight: data.tone === 'cycle' ? 600 : 400,
          }}
          labelShowBg
          labelBgStyle={{ fill: 'var(--color-surface)' }}
        />
      ) : null}
    </g>
  );
}

const NODE_TYPES = { thread: ThreadNode, resource: ResourceNode };
const EDGE_TYPES = { dl: DlEdge };

/** Where each node goes before anyone drags it. */
export function layout(processes: number, resources: number) {
  const width = Math.max(processes, resources) - 1;
  const offset = (count: number) => ((width - (count - 1)) * GAP) / 2;
  return {
    thread: (t: number) => ({ x: offset(processes) + t * GAP, y: 0 }),
    resource: (r: number) => ({ x: offset(resources) + r * GAP, y: RESOURCE_Y }),
  };
}

/** Consecutive node pairs of the cycle, as edge ids, in order round the loop. */
export function cycleEdgeIds(cycle: readonly string[] | null): string[] {
  if (!cycle) return [];
  return cycle.slice(1).map((node, i) => `${cycle[i]}-${node}`);
}

/**
 * The graph edges under the DFS: for each wait-for edge Ti → Tj on the path (and the one
 * being looked at), the request Ti → R and the assignment R → Tj it stands for.
 */
export function dfsEdgeIds(state: DlSnapshot): {
  path: Set<string>;
  current: Set<string>;
} {
  const path = new Set<string>();
  const current = new Set<string>();
  const { dfs, waitFor } = state;
  if (!dfs || !waitFor) return { path, current };
  const add = (set: Set<string>, from: number, to: number, r: number | undefined) => {
    if (r === undefined) return;
    set.add(`${processName(from)}-${resourceName(r)}`);
    set.add(`${resourceName(r)}-${processName(to)}`);
  };
  for (let i = 1; i < dfs.stack.length; i += 1) {
    const from = dfs.stack[i - 1]!;
    const to = dfs.stack[i]!;
    add(path, from, to, waitFor.find((e) => e.from === from && e.to === to)?.resource);
  }
  if (dfs.edge) add(current, dfs.edge.from, dfs.edge.to, dfs.edge.resource);
  return { path, current };
}

/** The edges on screen at the last change of the edge set, and which ones were new. */
interface EdgeHistory {
  key: string;
  ids: readonly string[];
  /** Edges that appeared at that change, and the canvas step it happened on. */
  added: readonly string[];
  at: number;
}

interface Ghosts {
  seq: number;
  edges: DlFlowEdge[];
  faded: boolean;
  fadeMs: number;
}

function Canvas({ state, kind, motionStep = 0, onConnect, className }: GraphCanvasProps) {
  const processes = state.allocation.length;
  const resources = state.total.length;
  const touch = useCoarsePointer();
  const editable = !touch && onConnect !== undefined;
  const { scale } = useStepTransition();
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
        data: { label: id, marks, connectable: editable },
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
          connectable: editable,
          total: state.total[r]!,
          free: state.available[r]!,
          marks: inCycle.has(id) ? ['cycle'] : [],
        },
      };
    }),
  ];

  // Which edges exist, and which of them just appeared or just went.
  const liveIds = [
    ...state.allocation.flatMap((row, t) =>
      row.flatMap((n, r) => (n > 0 ? [`${resourceName(r)}-${processName(t)}`] : [])),
    ),
    ...request.flatMap((row, t) =>
      row.flatMap((n, r) => (n > 0 ? [`${processName(t)}-${resourceName(r)}`] : [])),
    ),
  ];
  const liveKey = liveIds.join(' ');
  const fadeMs = scale(DURATION.enter);
  const [history, setHistory] = useState<EdgeHistory>({
    key: liveKey,
    ids: liveIds,
    added: [],
    at: motionStep,
  });
  const [ghosts, setGhosts] = useState<Ghosts | null>(null);
  const [lastEdges, setLastEdges] = useState<DlFlowEdge[]>([]);
  if (history.key !== liveKey) {
    // Adjusting state while rendering (React's "storing information from previous
    // renders"): the next render sees the change.
    setHistory({
      key: liveKey,
      ids: liveIds,
      added: liveIds.filter((id) => !history.ids.includes(id)),
      at: motionStep,
    });
    const removed = lastEdges.filter((e) => !liveIds.includes(e.id));
    setGhosts(
      fadeMs > 0 && removed.length > 0
        ? { seq: (ghosts?.seq ?? 0) + 1, edges: removed, faded: false, fadeMs }
        : null,
    );
  }
  const justAdded = new Set(history.at === motionStep ? history.added : []);

  const cycleIds = cycleEdgeIds(state.cycle);
  const dfs = dfsEdgeIds(state);
  const cycleClosed = kind === 'dl.cycle';

  const edge = (
    source: string,
    target: string,
    n: number,
    edgeKind: 'request' | 'assignment',
  ): DlFlowEdge => {
    const id = `${source}-${target}`;
    const cycleAt = cycleIds.indexOf(id);
    const tone: Tone =
      cycleAt >= 0 ? 'cycle' : dfs.path.has(id) || dfs.current.has(id) ? 'path' : 'plain';
    const draw =
      justAdded.has(id) ||
      (cycleAt >= 0 && cycleClosed) ||
      (kind === 'dl.edge' && dfs.current.has(id));
    return {
      id,
      source,
      target,
      sourceHandle: 'out',
      targetHandle: 'in',
      type: 'dl',
      markerEnd: { type: MarkerType.ArrowClosed, color: TONE_COLOUR[tone] },
      data: {
        kind: edgeKind,
        n,
        tone,
        draw,
        drawKey: `${motionStep}`,
        order:
          cycleAt >= 0 && cycleClosed ? cycleAt / Math.max(1, cycleIds.length - 1) : 0,
      },
    };
  };
  const live: DlFlowEdge[] = [
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
  // The edges as drawn, for the next change to know what went.
  if (lastEdges.map((e) => e.id).join(' ') !== liveKey) setLastEdges(live);

  const ghostSeq = ghosts?.seq ?? 0;
  const ghostFadeMs = ghosts?.fadeMs ?? 0;
  useEffect(() => {
    if (ghostSeq === 0) return;
    const frame = requestAnimationFrame(() =>
      setGhosts((g) => (g && g.seq === ghostSeq ? { ...g, faded: true } : g)),
    );
    const timer = setTimeout(
      () => setGhosts((g) => (g && g.seq === ghostSeq ? null : g)),
      ghostFadeMs + 50,
    );
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [ghostSeq, ghostFadeMs]);

  const edges: DlFlowEdge[] = [
    ...(ghosts?.edges ?? []).map((e): DlFlowEdge => ({
      ...e,
      id: `ghost:${e.id}`,
      data: {
        ...e.data!,
        draw: false,
        ghost: ghosts!.faded ? 'faded' : 'start',
        fadeMs: ghosts!.fadeMs,
      },
    })),
    ...live,
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
      data-touch={touch ? 'view-only' : undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={touch ? undefined : onNodesChange}
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
        nodesConnectable={editable}
        nodesDraggable={!touch}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        zoomOnPinch={touch}
        panOnDrag={touch}
        preventScrolling={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      />
    </div>
  );
}

export default function GraphCanvas(props: GraphCanvasProps) {
  return (
    <StepTransitionProvider step={props.motionStep ?? 0} stepIntervalMs={STEP_MS}>
      <Canvas {...props} />
    </StepTransitionProvider>
  );
}
