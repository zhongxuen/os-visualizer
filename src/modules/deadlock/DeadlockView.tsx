'use client';

import { ChevronDown, Pencil } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { Term } from '@/components/glossary/Term';
import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { ruleUsed, StepInspector } from '@/components/inspector/StepInspector';
import { Walkthrough } from '@/components/lesson/Walkthrough';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useShareState } from '@/components/state/useShareState';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
import DeadlockLesson from '@/content/lessons/deadlock.mdx';
import { createRegistry } from '@/core/citations/registry';
import { allocate, runRequest, runSafety } from '@/core/deadlock/bankers';
import { deadlockCitations } from '@/core/deadlock/citations';
import {
  withEdge,
  type BankersState,
  type EdgeKind,
  type Graph,
  type Recovery,
} from '@/core/deadlock/model';
import {
  BANKERS_PRESETS,
  DEFAULT_BANKERS_PRESET,
  DEFAULT_GRAPH_PRESET,
  GRAPH_PRESETS,
  type BankersQuery,
} from '@/core/deadlock/presets';
import { METHOD_NAMES, METHODS, runGraph, type Method } from '@/core/deadlock/recover';
import { DL_RULES } from '@/core/deadlock/rules';
import { DEADLOCK_SHARE_STATE, type DlInput, type DlView } from '@/core/deadlock/state';
import { cn } from '@/lib/cn';

import {
  coffmanAt,
  endOfRunText,
  endsDeadlocked,
  eventAt,
  finalResult,
  graphSummary,
  isPretending,
  requestChecklist,
  ruleIdFor,
  stepHeading,
  tryNextFor,
} from './adapters';
import { BankersEditor, BankersQueryForm, BankersStep } from './BankersView';
import { CoffmanPanel } from './CoffmanPanel';
import { DetectView } from './DetectView';
import { Panel, SelectField } from './fields';
import { GraphEditorForm } from './GraphEditorForm';
import { RecoveryPanel } from './RecoveryPanel';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { useCoarsePointer } from './touch';
import { useStepRun } from './useStepRun';
import { PANEL_ID, tabId, ViewTabs } from './ViewTabs';

const CITATIONS = createRegistry([deadlockCitations]);

// React Flow is only ever loaded here, after the page is interactive.
const GraphCanvas = dynamic(() => import('./GraphCanvas'), {
  ssr: false,
  loading: () => (
    <div className="border-border bg-surface text-fg-muted text-small flex h-80 items-center justify-center rounded-lg border">
      Loading the graph…
    </div>
  ),
});

/** D1: what each tab is for, in one line. */
export const VIEW_INTROS: Record<DlView, ReactNode> = {
  graph: (
    <>
      <span className="font-semibold">Detection: what’s happening now.</span> Who holds
      what, who waits for what, and is anyone stuck for good?
    </>
  ),
  bankers: (
    <>
      <span className="font-semibold">
        Avoidance: what might happen, given every thread’s maximum.
      </span>{' '}
      A request is granted only if every thread could still finish.
    </>
  ),
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lead font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A button that shows or hides a block of controls (G10: presets first, Edit reveals). */
function Disclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="justify-between"
      >
        <span className="inline-flex items-center gap-1.5">
          <Pencil aria-hidden="true" className="size-4" />
          {label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </Button>
      <div id={id} hidden={!open} className="flex flex-col gap-4">
        {open ? children : null}
      </div>
    </div>
  );
}

/** Advanced options, closed by default (G10). */
function MoreOptions({ children }: { children: ReactNode }) {
  return (
    <details className="border-border bg-surface-raised rounded-lg border p-4">
      <summary className="text-small cursor-pointer font-semibold">More options</summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

/** A request (and the thread) resized to fit a Banker's state. */
function fitQuery(query: BankersQuery, state: BankersState): BankersQuery {
  const m = state.available.length;
  return {
    ...query,
    t: Math.min(query.t, state.max.length - 1),
    request: Array.from({ length: m }, (_, r) => query.request[r] ?? 0),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function DeadlockView() {
  const share = useShareState(DEADLOCK_SHARE_STATE);
  const { state, setState, ready } = share;
  const input = state.input as DlInput;
  const { view } = input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [graphPresetId, setGraphPresetId] = useState(DEFAULT_GRAPH_PRESET.id);
  const [bankersPresetId, setBankersPresetId] = useState(DEFAULT_BANKERS_PRESET.id);
  const [loads, setLoads] = useState(0);
  const [edits, setEdits] = useState(0);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('');
  const touch = useCoarsePointer();

  const { graph, method, recovery, bankers, query } = input;
  const graphRun = useMemo(
    () => runGraph(graph, method, recovery),
    [graph, method, recovery],
  );
  const bankersRun = useMemo(
    () =>
      query.run === 'safety'
        ? runSafety(bankers)
        : runRequest(bankers, { t: query.t, request: query.request }),
    [bankers, query],
  );
  const run = view === 'graph' ? graphRun : bankersRun;
  const { store, position, total, moment, phaseIndex } = useStepRun(run, share);

  // After a recovery step is added, jump to it instead of the start of the run.
  const seekPhase = useRef<string | null>(null);
  useEffect(() => {
    const id = seekPhase.current;
    if (id === null) return;
    seekPhase.current = null;
    const phase = run.phases.find((p) => p.id === id);
    if (phase) store.getState().seek(phase.startMs);
  }, [run, store]);

  const event = eventAt(run, position);
  const snapshot = event?.state;
  const previous = position > 0 ? eventAt(run, position - 1)?.state : undefined;
  const ruleId = ruleIdFor(event);

  const setInput = (next: Partial<DlInput>) =>
    setState((s) => ({ ...s, step: 0, input: { ...(s.input as DlInput), ...next } }));

  const editorKey = `${loads}-${ready ? 1 : 0}`;

  const setGraph = (next: Graph) => {
    setInput({ graph: next, recovery: [] });
    setEdits((n) => n + 1);
  };
  const connect = (kind: EdgeKind, t: number, r: number) => {
    const result = withEdge(graph, kind, t, r, 1);
    if (result.ok) {
      setGraph(result.value);
      setStatus(
        `Added: T${t} ${kind === 'assignments' ? 'holds' : 'requests'} 1 of R${r}.`,
      );
    } else {
      setStatus(`Not changed: ${result.issues[0]!.message}`);
    }
  };
  const setRecovery = (next: Recovery[], seek: string | null) => {
    seekPhase.current = seek;
    setInput({ recovery: next });
  };

  const loadGraphPreset = (id: string) => {
    const preset = GRAPH_PRESETS.find((p) => p.id === id)!;
    setGraphPresetId(id);
    setInput({ view: 'graph', graph: preset.graph, method: preset.method, recovery: [] });
    setLoads((n) => n + 1);
    setStatus(`Loaded preset: ${preset.title}`);
  };
  const loadBankersPreset = (id: string) => {
    const preset = BANKERS_PRESETS.find((p) => p.id === id)!;
    setBankersPresetId(id);
    setInput({ view: 'bankers', bankers: preset.state, query: preset.query });
    setLoads((n) => n + 1);
    setStatus(`Loaded preset: ${preset.title}`);
  };

  const graphPreset = GRAPH_PRESETS.find((p) => p.id === graphPresetId)!;
  const bankersPreset = BANKERS_PRESETS.find((p) => p.id === bankersPresetId)!;
  const result = finalResult(run);
  const granted = view === 'bankers' && finalResult(bankersRun)?.kind === 'granted';

  // End of the run (G16): the result in one sentence and a preset that contrasts.
  const loadedBankers = BANKERS_PRESETS.find(
    (p) => same(p.state, bankers) && same(p.query, query),
  );
  const next = tryNextFor({
    view,
    graph,
    result,
    graphPresets: GRAPH_PRESETS,
    bankersPresetId: loadedBankers?.id ?? null,
  });
  const nextPreset = next
    ? next.view === 'graph'
      ? GRAPH_PRESETS.find((p) => p.id === next.presetId)
      : BANKERS_PRESETS.find((p) => p.id === next.presetId)
    : undefined;

  const statusLine = (
    <p role="status" className="text-caption text-fg-muted min-h-4">
      {status}
    </p>
  );

  const graphInputs = (
    <>
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={graphPresetId}
          options={GRAPH_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          onChange={setGraphPresetId}
        />
        <p className="text-caption text-fg-muted">{graphPreset.summary}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => loadGraphPreset(graphPresetId)}
        >
          Load preset
        </Button>
      </Panel>
      <Disclosure
        label="Edit the graph"
        open={editing}
        onToggle={() => setEditing((on) => !on)}
      >
        <GraphEditorForm
          key={`graph-${editorKey}`}
          graph={graph}
          onChange={setGraph}
          onStatus={setStatus}
        />
      </Disclosure>
      <MoreOptions>
        <SelectField<Method>
          label="Look for deadlock with"
          value={method}
          options={METHODS.map((m) => ({ value: m, label: METHOD_NAMES[m] }))}
          onChange={(m) => setInput({ method: m })}
        />
        <p className="text-caption text-fg-muted">
          Cycle detection decides only when every resource has one instance; otherwise it
          hands over to the detection algorithm.
        </p>
      </MoreOptions>
    </>
  );

  const bankersInputs = (
    <>
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={bankersPresetId}
          options={BANKERS_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          onChange={setBankersPresetId}
        />
        <p className="text-caption text-fg-muted">{bankersPreset.summary}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => loadBankersPreset(bankersPresetId)}
        >
          Load preset
        </Button>
      </Panel>
      <BankersQueryForm
        key={`query-${editorKey}-${bankers.max.length}x${bankers.available.length}`}
        state={bankers}
        query={query}
        onRun={(q) => {
          setInput({ query: fitQuery(q, bankers) });
          setStatus(
            q.run === 'safety'
              ? 'Running the safety algorithm.'
              : `Running T${q.t}’s request for (${q.request.join(', ')}).`,
          );
        }}
      />
      <Disclosure
        label="Edit the state"
        open={editing}
        onToggle={() => setEditing((on) => !on)}
      >
        <BankersEditor
          key={`bankers-${editorKey}`}
          state={bankers}
          onChange={(s) => setInput({ bankers: s, query: fitQuery(query, s) })}
        />
      </Disclosure>
    </>
  );

  const inputs = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ViewTabs
          view={view}
          onChange={(v: DlView) => {
            if (v !== view) setInput({ view: v });
          }}
        />
        <p className="text-caption text-fg-secondary">{VIEW_INTROS[view]}</p>
      </div>
      {view === 'graph' ? graphInputs : bankersInputs}
      {statusLine}
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector
        heading={stepHeading(event, run)}
        event={event}
        rule={ruleUsed(DL_RULES, ruleId)}
      />
      <RulesPanel rules={DL_RULES} currentRuleId={ruleId} />
      <div>
        <h2 className="text-small text-fg-muted mb-2 font-semibold">Steps</h2>
        <PhaseStepper
          phases={run.phases}
          currentIndex={phaseIndex}
          onSeek={(time) => store.getState().seek(time)}
          unit="step"
        />
      </div>
    </div>
  );

  const coffman = snapshot ? coffmanAt(snapshot) : [];
  const coffmanBefore = previous ? coffmanAt(previous) : coffman;
  const coffmanChanged = new Set(
    coffman.filter((c, i) => coffmanBefore[i]?.status !== c.status).map((c) => c.id),
  );

  const graphMain = snapshot ? (
    <>
      <Section id="graph-heading" title="Resource-allocation graph">
        <ul
          aria-label="Graph summary"
          data-testid="graph-summary"
          className="text-small flex flex-col gap-0.5"
        >
          {graphSummary(
            {
              allocation: snapshot.allocation,
              request: snapshot.request ?? snapshot.allocation.map((r) => r.map(() => 0)),
            },
            snapshot.terminated,
          ).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <figure className="flex flex-col gap-2">
          <GraphCanvas
            key={`${snapshot.allocation.length}x${snapshot.total.length}-${editorKey}`}
            state={snapshot}
            {...(event ? { kind: event.kind } : {})}
            motionStep={edits + position}
            {...(recovery.length === 0 ? { onConnect: connect } : {})}
          />
          <figcaption className="text-caption text-fg-muted" data-testid="canvas-caption">
            Circles are threads, boxes are resource types with one dot per instance
            (filled when held). Solid arrows R → T are assignments; dashed arrows T → R
            are requests, flowing toward what they wait for.{' '}
            {touch ? (
              <span data-touch-note="">
                On a touch screen the picture is view-only: drag to pan, pinch to zoom. To
                change the graph, use “Edit the graph” in Setup.
              </span>
            ) : (
              <>
                Drag from a thread’s lower right handle to a resource to add a request, or
                from a resource’s upper left handle to a thread to assign it. The form in
                Setup does the same from the keyboard.
              </>
            )}
          </figcaption>
        </figure>
      </Section>
      <Section id="step-heading" title="This step">
        <DetectView state={snapshot} {...(event ? { kind: event.kind } : {})} />
      </Section>
      <Section id="coffman-heading" title="Coffman conditions">
        <CoffmanPanel conditions={coffman} changed={coffmanChanged} />
      </Section>
      <Section id="recovery-heading" title="Recovery">
        <RecoveryPanel
          graph={graph}
          recovery={recovery}
          deadlocked={endsDeadlocked(graphRun)}
          onApply={(action) => {
            setRecovery([...recovery, action], `r${recovery.length + 1}.recover`);
            setStatus(`Recovery added. Detection runs again after it.`);
          }}
          onUndo={() => setRecovery(recovery.slice(0, -1), null)}
          onClear={() => setRecovery([], null)}
        />
      </Section>
    </>
  ) : null;

  const bankersMain = snapshot ? (
    <Section
      id="bankers-step-heading"
      title={query.run === 'safety' ? 'Safety algorithm' : `T${query.t}’s request`}
    >
      <BankersStep
        state={snapshot}
        {...(event ? { kind: event.kind } : {})}
        checks={query.run === 'request' ? requestChecklist(bankersRun, position) : null}
        pretending={query.run === 'request' && isPretending(bankersRun, position)}
      />
      {granted ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => {
            setInput({
              bankers: allocate(bankers, { t: query.t, request: query.request }),
              query: { ...query, run: 'safety' },
            });
            setLoads((n) => n + 1);
            setStatus(`Kept the new state: T${query.t} holds what it asked for.`);
          }}
        >
          Keep the new state
        </Button>
      ) : null}
    </Section>
  ) : null;

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Deadlock"
        intro={
          <>
            Build a <Term id="resource-allocation-graph" /> and watch the system decide
            whether it is <Term id="deadlock">deadlocked</Term>, then recover. Or run
            Banker’s algorithm and watch it keep the system in a <Term id="safe-state" />.{' '}
            <span data-testid="thread-names">
              Silberschatz calls the waiting parties <Term id="thread">threads</Term>, T0,
              T1, …, drawn here as rounded squares: they are not the processes P1, P2, …
              of CPU Scheduling.
            </span>
          </>
        }
        mode={mode}
        onModeChange={setMode}
        share={{ link: share.link, shareable: share.shareable }}
        inputs={inputs}
        inspector={inspector}
        endOfRun={{
          result: endOfRunText(result),
          ...(next && nextPreset
            ? {
                tryNext: {
                  label: nextPreset.title,
                  why: next.why,
                  onSelect: () =>
                    next.view === 'graph'
                      ? loadGraphPreset(next.presetId)
                      : loadBankersPreset(next.presetId),
                },
              }
            : {}),
        }}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="step" />}
      >
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={tabId(view)}
          className="flex flex-col gap-6"
        >
          <p className="text-small text-fg-secondary" data-testid="view-intro">
            {VIEW_INTROS[view]}
          </p>
          {mode === 'walkthrough' ? (
            <Walkthrough
              lesson={LESSON}
              Content={DeadlockLesson}
              store={store}
              unit="step"
              examples={LESSON_EXAMPLES}
              activeExample={activeExample(input)}
              onLoadExample={(id) => {
                const example = LESSON_EXAMPLES.find((e) => e.id === id)!;
                setInput(example.patch);
                setLoads((n) => n + 1);
                setStatus(`Loaded example: ${example.title}`);
              }}
              checkpoints={LESSON_CHECKPOINTS}
            />
          ) : null}
          {mode === 'walkthrough' ? (
            <StepCaption
              phases={run.phases}
              currentIndex={phaseIndex}
              moment={moment}
              question={
                view === 'graph'
                  ? 'Can every thread get what it is waiting for, in some order?'
                  : 'If this thread gets what it asks for, can everyone still finish?'
              }
              className="border-border bg-surface-raised min-h-24 rounded-lg border p-4"
            />
          ) : null}
          <p className="text-caption text-fg-muted">
            Step {Math.min(position + 1, total)} of {total}.
          </p>
          {view === 'graph' ? graphMain : bankersMain}
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
