'use client';

import { useMemo, useState } from 'react';

import { GanttChart } from '@/components/blocks/GanttChart';
import { formatMetric, MetricsTable } from '@/components/blocks/MetricsTable';
import { QueueView } from '@/components/blocks/QueueView';
import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { matchExample } from '@/components/lesson/examples';
import { Walkthrough } from '@/components/lesson/Walkthrough';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { StepInspector } from '@/components/inspector/StepInspector';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useProgress } from '@/components/state/useProgress';
import { useShareState } from '@/components/state/useShareState';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
import SchedulingLesson from '@/content/lessons/scheduling.mdx';
import { createRegistry } from '@/core/citations/registry';
import { schedCitations } from '@/core/sched/citations';
import { METRIC_DEFINITIONS, metricsFrom } from '@/core/sched/metrics';
import { SCHED_PRESETS } from '@/core/sched/presets';
import { rulesFor } from '@/core/sched/rules';
import { schedule } from '@/core/sched/schedule';
import { SCHED_SHARE_STATE } from '@/core/sched/state';
import {
  policyName,
  validatePolicy,
  validateWorkload,
  type Policy,
  type Workload,
} from '@/core/sched/workload';

import {
  eventsAt,
  finalSegments,
  ganttLanes,
  percent,
  primaryEvent,
  PROCESS_COLUMNS,
  processRows,
  queueState,
  snapshotAt,
  toGanttSegments,
} from './adapters';
import { Panel, SelectField } from './fields';
import { LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { PolicyPicker } from './PolicyPicker';
import { useTickRun } from './useTickRun';
import { WorkloadEditor } from './WorkloadEditor';

const CITATIONS = createRegistry([schedCitations]);
const SAVE_KEY = 'sched';

interface SavedRun {
  workload: Workload;
  policy: Policy;
}

function asSaved(value: unknown): SavedRun | null {
  if (typeof value !== 'object' || value === null) return null;
  const { workload, policy } = value as Record<string, unknown>;
  const w = validateWorkload(workload);
  const p = validatePolicy(policy);
  return w.ok && p.ok ? { workload: w.value, policy: p.value } : null;
}

export function MetricDefinitions() {
  return (
    <dl className="text-caption text-fg-muted grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {METRIC_DEFINITIONS.map((d) => (
        <div key={d.id} className="contents">
          <dt className="text-fg-secondary font-semibold">{d.term}</dt>
          <dd>{d.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="border-border rounded-md border px-3 py-2">
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className="font-mono text-lg font-semibold" data-testid={id}>
        {value}
      </dd>
    </div>
  );
}

export function SchedulingView() {
  const share = useShareState(SCHED_SHARE_STATE);
  const { state, setState, ready } = share;
  const { workload, policy } = state.input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(SCHED_PRESETS[1]!.id);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');
  const progress = useProgress();

  const run = useMemo(() => schedule(workload, policy), [workload, policy]);
  const { store, tick, total, moment, phaseIndex } = useTickRun(run, share);

  const segments = useMemo(() => toGanttSegments(finalSegments(run)), [run]);
  const lanes = ganttLanes(policy);
  const events = eventsAt(run, tick);
  const snapshot = snapshotAt(run, tick);
  const queues = queueState(snapshot, policy, workload);
  const metrics = useMemo(() => {
    const visible = (snapshot?.segments ?? [])
      .filter((s) => s.start < tick)
      .map((s) => ({ ...s, end: Math.min(s.end, tick) }));
    return metricsFrom(workload, visible, snapshot?.done ?? [], tick);
  }, [snapshot, workload, tick]);
  const finished = metrics.processes.filter((p) => p.completion !== null).length;
  const limited = run.events.some((e) => e.kind === 'sched.limit');
  const name = policyName(policy);

  const setInput = (input: SavedRun) => {
    setState((s) => ({ ...s, step: 0, input }));
  };
  const load = (input: SavedRun, message: string) => {
    setInput(input);
    setLoads((n) => n + 1);
    setStatus(message);
  };

  const activeExample = useMemo(
    () => matchExample(LESSON_EXAMPLES, { workload, policy }),
    [workload, policy],
  );

  const saved = progress
    .savedFor(SAVE_KEY)
    .map((value, index) => ({ value: asSaved(value), index }))
    .filter((entry): entry is { value: SavedRun; index: number } => entry.value !== null);

  const inputs = (
    <div className="flex flex-col gap-4">
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={presetId}
          options={SCHED_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          onChange={setPresetId}
        />
        <p className="text-caption text-fg-muted">
          {SCHED_PRESETS.find((p) => p.id === presetId)?.summary}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const preset = SCHED_PRESETS.find((p) => p.id === presetId)!;
            load(
              { workload: preset.workload, policy: preset.policy },
              `Loaded preset: ${preset.title}`,
            );
          }}
        >
          Load preset
        </Button>
      </Panel>
      <Panel title="Policy">
        <PolicyPicker
          key={`policy-${loads}-${ready ? 1 : 0}`}
          policy={policy}
          onChange={(next) => setInput({ workload, policy: next })}
        />
      </Panel>
      <Panel title="Workload">
        <WorkloadEditor
          key={`workload-${loads}-${ready ? 1 : 0}`}
          workload={workload}
          showPriority={policy.kind === 'priority'}
          onChange={(next) => setInput({ workload: next, policy })}
        />
      </Panel>
      <Panel title="Save and share">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              progress.saveInput(SAVE_KEY, { workload, policy });
              setStatus('Workload saved in this browser.');
            }}
          >
            Save workload
          </Button>
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
        </div>
        <p role="status" className="text-caption text-fg-muted min-h-4">
          {status}
        </p>
        {saved.length > 0 ? (
          <ul aria-label="Saved workloads" className="flex flex-col gap-2">
            {saved.map(({ value, index }, n) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <span className="text-small min-w-0 flex-1">
                  {n + 1}. {value.workload.processes.length} processes,{' '}
                  {policyName(value.policy)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => load(value, `Loaded saved workload ${n + 1}.`)}
                >
                  Load<span className="sr-only"> saved workload {n + 1}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => progress.removeSaved(SAVE_KEY, index)}
                >
                  Delete<span className="sr-only"> saved workload {n + 1}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector heading={`At t = ${tick}`} event={primaryEvent(events)}>
        {events.length > 1 ? (
          <ol
            aria-label={`Everything at t = ${tick}`}
            className="text-small text-fg-secondary flex list-decimal flex-col gap-1 pl-5"
          >
            {events.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ol>
        ) : null}
      </StepInspector>
      <RulesPanel rules={rulesFor(policy.kind)} />
      <div>
        <h2 className="text-small text-fg-muted mb-2 font-semibold">Phases</h2>
        <PhaseStepper
          phases={run.phases}
          currentIndex={phaseIndex}
          onSeek={(time) => store.getState().seek(time)}
          unit="tick"
        />
      </div>
    </div>
  );

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="CPU Scheduling"
        intro="Build a set of processes, pick a policy, and watch the Gantt chart form one tick at a time, with the reason for every decision."
        mode={mode}
        onModeChange={setMode}
        inputs={inputs}
        inspector={inspector}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="tick" />}
      >
        <div className="flex flex-col gap-6">
          {mode === 'walkthrough' ? (
            <Walkthrough
              lesson={LESSON}
              Content={SchedulingLesson}
              store={store}
              unit="tick"
              examples={LESSON_EXAMPLES}
              activeExample={activeExample}
              onLoadExample={(id) => {
                const example = LESSON_EXAMPLES.find((e) => e.id === id)!;
                load(example.input, `Loaded example: ${example.title}`);
              }}
              checkpoints={LESSON_CHECKPOINTS}
            />
          ) : null}
          {mode === 'walkthrough' ? (
            <StepCaption
              phases={run.phases}
              currentIndex={phaseIndex}
              moment={moment}
              question={`${name}: which process runs first, and why?`}
              className="border-border bg-surface-raised min-h-24 rounded-lg border p-4"
            />
          ) : null}
          {limited ? (
            <p role="alert" className="text-state-error text-small">
              This workload hit the {total}-tick limit; the run stops there.
            </p>
          ) : null}

          <section aria-labelledby="gantt-heading" className="flex flex-col gap-2">
            <h2 id="gantt-heading" className="text-lead font-semibold">
              {name}
            </h2>
            <GanttChart
              segments={segments}
              tick={tick}
              endTick={total}
              lanes={lanes}
              title={`Gantt chart, ${name}`}
            />
          </section>

          <section aria-labelledby="queues-heading" className="flex flex-col gap-2">
            <h2 id="queues-heading" className="text-lead font-semibold">
              Queues at t = {tick}
            </h2>
            <QueueView
              running={queues.running}
              queues={queues.queues}
              waiting={queues.waiting}
            />
          </section>

          <section aria-labelledby="metrics-heading" className="flex flex-col gap-3">
            <h2 id="metrics-heading" className="text-lead font-semibold">
              Metrics at t = {tick}
            </h2>
            <p className="text-caption text-fg-muted">
              {finished} of {workload.processes.length} processes finished. Averages are
              over finished processes.
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat
                id="avg-waiting"
                label="Average waiting"
                value={formatMetric(metrics.avgWaiting)}
              />
              <Stat
                id="avg-turnaround"
                label="Average turnaround"
                value={formatMetric(metrics.avgTurnaround)}
              />
              <Stat
                id="avg-response"
                label="Average response"
                value={formatMetric(metrics.avgResponse)}
              />
              <Stat
                id="utilisation"
                label="CPU utilisation"
                value={percent(metrics.utilisation)}
              />
              <Stat
                id="throughput"
                label="Throughput (per tick)"
                value={formatMetric(metrics.throughput)}
              />
              <Stat
                id="cs-count"
                label="Context switches"
                value={String(metrics.contextSwitches)}
              />
            </dl>
            <div className="overflow-x-auto">
              <MetricsTable
                caption={`Per process at t = ${tick} (— = not yet)`}
                columns={PROCESS_COLUMNS}
                rows={processRows(metrics)}
                average="Average"
              />
            </div>
            <MetricDefinitions />
          </section>
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
