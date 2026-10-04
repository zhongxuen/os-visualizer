'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { StepInspector } from '@/components/inspector/StepInspector';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useShareState } from '@/components/state/useShareState';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
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
import { createRegistry } from '@/core/citations/registry';

import {
  coffmanAt,
  endsDeadlocked,
  eventAt,
  finalResult,
  graphSummary,
  stepHeading,
} from './adapters';
import { BankersEditor, BankersQueryForm, BankersStep } from './BankersView';
import { CoffmanPanel } from './CoffmanPanel';
import { DetectView } from './DetectView';
import { Panel, SelectField } from './fields';
import { GraphEditorForm } from './GraphEditorForm';
import { RecoveryPanel } from './RecoveryPanel';
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

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
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

/** A request (and the thread) resized to fit a Banker's state. */
function fitQuery(query: BankersQuery, state: BankersState): BankersQuery {
  const m = state.available.length;
  return {
    ...query,
    t: Math.min(query.t, state.max.length - 1),
    request: Array.from({ length: m }, (_, r) => query.request[r] ?? 0),
  };
}

export function DeadlockView() {
  const share = useShareState(DEADLOCK_SHARE_STATE);
  const { state, setState, ready } = share;
  const input = state.input as DlInput;
  const { view } = input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [graphPresetId, setGraphPresetId] = useState(DEFAULT_GRAPH_PRESET.id);
  const [bankersPresetId, setBankersPresetId] = useState(DEFAULT_BANKERS_PRESET.id);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');

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

  const setInput = (next: Partial<DlInput>) =>
    setState((s) => ({ ...s, step: 0, input: { ...(s.input as DlInput), ...next } }));

  const editorKey = `${loads}-${ready ? 1 : 0}`;

  const setGraph = (next: Graph) => setInput({ graph: next, recovery: [] });
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

  const graphPreset = GRAPH_PRESETS.find((p) => p.id === graphPresetId)!;
  const bankersPreset = BANKERS_PRESETS.find((p) => p.id === bankersPresetId)!;
  const granted = view === 'bankers' && finalResult(bankersRun)?.kind === 'granted';

  const shareButton = (
    <Panel title="Share">
      <Button
        variant="secondary"
        size="sm"
        disabled={!share.shareable}
        onClick={async () => {
          const url = share.link();
          if (!url) return;
          try {
            await navigator.clipboard.writeText(url);
            setStatus('Link copied.');
          } catch {
            setStatus('The link is in the address bar.');
          }
        }}
      >
        Copy link
      </Button>
      <p role="status" className="text-caption text-fg-muted min-h-4">
        {status}
      </p>
    </Panel>
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
          onClick={() => {
            setInput({
              graph: graphPreset.graph,
              method: graphPreset.method,
              recovery: [],
            });
            setLoads((n) => n + 1);
            setStatus(`Loaded preset: ${graphPreset.title}`);
          }}
        >
          Load preset
        </Button>
      </Panel>
      <Panel title="Method">
        <SelectField<Method>
          label="Look for deadlock with"
          value={method}
          options={METHODS.map((m) => ({ value: m, label: METHOD_NAMES[m] }))}
          onChange={(next) => setInput({ method: next })}
        />
        <p className="text-caption text-fg-muted">
          Cycle detection decides only when every resource has one instance; otherwise it
          hands over to the detection algorithm.
        </p>
      </Panel>
      <GraphEditorForm
        key={`graph-${editorKey}`}
        graph={graph}
        onChange={setGraph}
        onStatus={setStatus}
      />
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
          onClick={() => {
            setInput({ bankers: bankersPreset.state, query: bankersPreset.query });
            setLoads((n) => n + 1);
            setStatus(`Loaded preset: ${bankersPreset.title}`);
          }}
        >
          Load preset
        </Button>
      </Panel>
      <BankersQueryForm
        key={`query-${editorKey}-${bankers.max.length}x${bankers.available.length}`}
        state={bankers}
        query={query}
        onRun={(next) => {
          setInput({ query: fitQuery(next, bankers) });
          setStatus(
            next.run === 'safety'
              ? 'Running the safety algorithm.'
              : `Running T${next.t}’s request for (${next.request.join(', ')}).`,
          );
        }}
      />
    </>
  );

  const inputs = (
    <div className="flex flex-col gap-4">
      <ViewTabs
        view={view}
        onChange={(next: DlView) => {
          if (next !== view) setInput({ view: next });
        }}
      />
      {view === 'graph' ? graphInputs : bankersInputs}
      {shareButton}
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector heading={stepHeading(event, run)} event={event} />
      <RulesPanel rules={DL_RULES} />
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
            onConnect={recovery.length === 0 ? connect : undefined}
          />
          <figcaption className="text-caption text-fg-muted">
            Circles are threads, boxes are resource types with one dot per instance
            (filled when held). Solid arrows R → T are assignments; dashed arrows T → R
            are requests. Drag from a thread’s lower right handle to a resource to add a
            request, or from a resource’s upper left handle to a thread to assign it. The
            form does the same from the keyboard.
          </figcaption>
        </figure>
      </Section>
      <Section id="step-heading" title="This step">
        <DetectView state={snapshot} />
      </Section>
      <Section id="coffman-heading" title="Coffman conditions">
        <CoffmanPanel conditions={coffmanAt(snapshot)} />
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

  const bankersMain = (
    <>
      <Section id="bankers-state-heading" title="State">
        <BankersEditor
          key={`bankers-${editorKey}`}
          state={bankers}
          onChange={(next) => setInput({ bankers: next, query: fitQuery(query, next) })}
        />
      </Section>
      {snapshot ? (
        <Section
          id="bankers-step-heading"
          title={query.run === 'safety' ? 'Safety algorithm' : `T${query.t}’s request`}
        >
          <BankersStep state={snapshot} />
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
      ) : null}
    </>
  );

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Deadlock"
        intro="Build a resource-allocation graph and watch the system decide whether it is deadlocked, then recover. Or run Banker’s algorithm and watch it grant or refuse a request."
        mode={mode}
        onModeChange={setMode}
        inputs={inputs}
        inspector={inspector}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="step" />}
      >
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={tabId(view)}
          className="flex flex-col gap-6"
        >
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
