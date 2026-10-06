'use client';

import { Check, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';

import { GanttChart, type GanttLane } from '@/components/blocks/GanttChart';
import { Term } from '@/components/glossary/Term';
import { DURATION } from '@/components/motion/tokens';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useShareState } from '@/components/state/useShareState';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { Button } from '@/components/timeline/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { compare, COMPARE_PRESETS, type CompareRow, whyLine } from '@/core/sched/compare';
import { metricsFrom, type RunMetrics } from '@/core/sched/metrics';
import { COMPARE_SHARE_STATE } from '@/core/sched/state';
import type { Policy, Workload } from '@/core/sched/workload';
import { cn } from '@/lib/cn';
import {
  finalSegments,
  ganttLanes,
  Panel,
  runTicks,
  SelectField,
  toGanttSegments,
  useTickRun,
  WorkloadEditor,
} from '@/modules/scheduling';

import { CompareMetrics } from './CompareMetrics';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { PolicyColumns } from './PolicyColumns';
import { PolicyMiniMap } from './PolicyMiniMap';
import { resultSentence, tryNextFor } from './summary';
import { DROP, useArrival } from './useArrival';

/**
 * Compare: one workload, 2-4 policies, one Gantt chart each on a shared time axis
 * following one cursor, and the metrics side by side at the cursor, with the "Why?"
 * sentence as their headline (docs/UIUX.md C1-C4, §7.2.2).
 *
 * Every chart is drawn on the same axis (the longest run) and the same gutter, so the
 * charts' cursors line up into one line down the page. On a phone only one policy is on
 * screen at a time: a segmented control (or a swipe) picks it, and a mini-map shows all
 * of them.
 */

/** Guided mode's lesson: client-only, its own chunk, out of first-load JS. */
const GuidedLesson = dynamic(() => import('./GuidedLesson'), {
  ssr: false,
  loading: () => <p className="text-fg-muted text-small">Loading the lesson…</p>,
});

/** A sideways swipe of at least this many pixels changes the policy shown. */
const SWIPE_PX = 48;

type Input = { workload: Workload; policies: Policy[] };

/** The metrics table rows at the cursor, from each run's clipped segments. */
export function tableAt(
  rows: readonly CompareRow[],
  metrics: readonly RunMetrics[],
): CompareRow[] {
  return rows.map((row) => ({
    ...row,
    values: metrics.map((m) => {
      switch (row.id) {
        case 'waiting':
          return m.avgWaiting;
        case 'turnaround':
          return m.avgTurnaround;
        case 'response':
          return m.avgResponse;
        case 'utilisation':
          return m.utilisation;
        case 'throughput':
          return m.throughput;
        case 'contextSwitches':
          return m.contextSwitches;
      }
    }),
  }));
}

/**
 * Every chart's lanes, with the labels padded to the longest so every chart gets the
 * same gutter, and so the same x for every tick: one cursor line through all of them.
 * SVG collapses the padding, so the labels read as written. Without MLFQ every chart
 * already has the one "CPU" lane and nothing is padded.
 */
export function alignedLanes(policies: readonly Policy[]): (GanttLane[] | undefined)[] {
  const lanes = policies.map((policy) => ganttLanes(policy));
  if (lanes.every((l) => l === undefined)) return lanes;
  const all = lanes.map((l) => l ?? [{ id: 0, label: 'CPU' }]);
  const width = Math.max(...all.flat().map((lane) => lane.label.length));
  return all.map((l) =>
    l.map((lane) => ({ ...lane, label: lane.label.padStart(width) })),
  );
}

function DoneFlag({ ticks }: { ticks: number }) {
  const ref = useArrival<HTMLSpanElement>(DROP, { token: DURATION.enter });
  return (
    <span
      ref={ref}
      data-done-flag={ticks}
      className="border-state-ok text-state-ok text-caption inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium"
    >
      <Check aria-hidden="true" className="size-3" />
      done at t = {ticks}
    </span>
  );
}

function Legend() {
  return (
    <ul
      aria-label="Gantt chart legend"
      className="text-caption text-fg-secondary flex flex-col gap-1"
    >
      <li className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="pattern-cs mt-0.5 inline-block h-3 w-6 shrink-0 rounded-sm"
        />
        <span>
          <strong>CS</strong>: a <Term id="context-switch">context switch</Term>, neither
          busy nor idle.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="pattern-idle mt-0.5 inline-block h-3 w-6 shrink-0 rounded-sm"
        />
        <span>
          <strong>idle</strong>: no process is ready.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span aria-hidden="true" className="w-6 shrink-0" />
        <span>
          Every chart shares one time axis and one cursor, so a column of the page is the
          same tick in every run.
        </span>
      </li>
    </ul>
  );
}

export function CompareView() {
  const share = useShareState(COMPARE_SHARE_STATE);
  const { state, setState, ready } = share;
  const { workload, policies } = state.input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(COMPARE_PRESETS[0]!.id);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(false);
  const [shownWanted, setShown] = useState(0);
  const shown = Math.min(shownWanted, policies.length - 1);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const result = useMemo(() => compare(workload, policies), [workload, policies]);
  const { store, tick } = useTickRun(result.timeline, share);

  const setInput = (input: Input) => setState((s) => ({ ...s, step: 0, input }));
  const load = (input: Input, message: string) => {
    setInput(input);
    setLoads((n) => n + 1);
    setStatus(message);
  };

  const charts = useMemo(
    () =>
      result.runs.map((run) => ({
        segments: toGanttSegments(finalSegments(run)),
        snapshotSegments: finalSegments(run),
        ticks: runTicks(run),
        done: run.events[run.events.length - 1]?.state.done ?? [],
      })),
    [result],
  );
  const lanes = useMemo(() => alignedLanes(policies), [policies]);

  // Each run's metrics at the shared cursor; a run already finished shows its totals.
  const metricsNow = charts.map((chart) => {
    const at = Math.min(tick, chart.ticks);
    const visible = chart.snapshotSegments
      .filter((s) => s.start < at)
      .map((s) => ({ ...s, end: Math.min(s.end, at) }));
    const done = chart.done.filter((pid) => {
      const runs = chart.snapshotSegments.filter((s) => s.pid === pid);
      return runs[runs.length - 1]!.end <= at;
    });
    return metricsFrom(workload, visible, done, at);
  });
  const table = tableAt(result.table, metricsNow);
  const ended = tick >= result.durationTicks;
  const why = whyLine(table, result.names);
  const next = tryNextFor({ workload, policies });

  const inputs = (
    <div className="flex flex-col gap-4">
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={presetId}
          options={COMPARE_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          onChange={setPresetId}
        />
        <p className="text-caption text-fg-muted">
          {COMPARE_PRESETS.find((p) => p.id === presetId)?.summary}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const preset = COMPARE_PRESETS.find((p) => p.id === presetId)!;
            load(
              { workload: preset.workload, policies: preset.policies },
              `Loaded preset: ${preset.title}`,
            );
          }}
        >
          Load preset
        </Button>
        <p role="status" className="text-caption text-fg-muted min-h-4">
          {status}
        </p>
      </Panel>

      <button
        type="button"
        aria-expanded={editing}
        aria-controls="compare-editor"
        onClick={() => setEditing((on) => !on)}
        className="border-border bg-surface-raised text-small hover:bg-surface-overlay focus-visible:outline-focus flex items-center justify-between rounded-lg border px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Edit the policies and workload
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', editing && 'rotate-180')}
        />
      </button>

      <div id="compare-editor" hidden={!editing} className="flex flex-col gap-4">
        <Panel title="Policies">
          <p className="text-caption text-fg-muted">
            Each column runs the same workload under its own policy. Round robin gives
            each process a <Term id="quantum">quantum</Term> of CPU time; a preemptive
            policy can <Term id="preempt">preempt</Term> the running process.
          </p>
          <PolicyColumns
            key={`policies-${loads}-${ready ? 1 : 0}`}
            policies={policies}
            names={result.names}
            onChange={(nextPolicies) => setInput({ workload, policies: nextPolicies })}
          />
        </Panel>
        <Panel title="Workload">
          <p className="text-caption text-fg-muted">
            Each process has an <Term id="arrival">arrival</Term> time and a list of
            bursts: <Term id="cpu-burst">CPU bursts</Term> (solid) alternating with{' '}
            <Term id="io-burst">I/O bursts</Term> (dashed).
          </p>
          <WorkloadEditor
            key={`workload-${loads}-${ready ? 1 : 0}`}
            workload={workload}
            showPriority={policies.some((p) => p.kind === 'priority')}
            burstBuilder
            disclose
            onChange={(nextWorkload) => setInput({ workload: nextWorkload, policies })}
          />
        </Panel>
      </div>
    </div>
  );

  const results = (
    <CompareMetrics
      table={table}
      names={result.names}
      tick={tick}
      ended={ended}
      durationTicks={result.durationTicks}
      why={why}
    />
  );

  return (
    <ModuleLayout
      title="Compare schedulers"
      intro={
        <>
          One set of <Term id="process">processes</Term> under two to four policies at
          once: one Gantt chart each on a shared time axis, one cursor moving a{' '}
          <Term id="tick">tick</Term> at a time, and the metrics side by side.
        </>
      }
      mode={mode}
      onModeChange={setMode}
      inputs={inputs}
      results={results}
      share={{ link: share.link, shareable: share.shareable }}
      endOfRun={{
        result: resultSentence(result.names, result.durationTicks, why),
        tryNext: {
          label: next.preset.title,
          why: next.why,
          onSelect: () =>
            load(
              { workload: next.preset.workload, policies: next.preset.policies },
              `Loaded preset: ${next.preset.title}`,
            ),
        },
      }}
      timeline={<PlaybackBar store={store} phases={result.timeline.phases} unit="tick" />}
    >
      <div className="flex flex-col gap-6">
        {mode === 'walkthrough' ? (
          <GuidedLesson
            lesson={LESSON}
            store={store}
            unit="tick"
            examples={LESSON_EXAMPLES}
            activeExample={activeExample({ workload, policies })}
            onLoadExample={(id) => {
              const example = LESSON_EXAMPLES.find((e) => e.id === id)!;
              load(example.input, `Loaded example: ${example.title}`);
            }}
            checkpoints={LESSON_CHECKPOINTS}
          />
        ) : null}
        <section aria-labelledby="charts-heading" className="flex flex-col gap-4">
          <h2 id="charts-heading" className="text-lead font-semibold">
            Gantt charts at t = {tick}
          </h2>

          {/* Phone: one policy at a time, picked here or by swiping the chart (C1). */}
          <div className="flex flex-col gap-2 sm:hidden">
            <SegmentedControl
              label="Policy shown"
              size="sm"
              options={result.names.map((name, i) => ({ value: String(i), label: name }))}
              value={String(shown)}
              onValueChange={(value) => setShown(Number(value))}
            />
            <PolicyMiniMap
              runs={charts.map((chart, i) => ({
                name: result.names[i]!,
                segments: chart.segments,
                ticks: chart.ticks,
              }))}
              tick={tick}
              endTick={result.durationTicks}
              shown={shown}
              onShow={setShown}
            />
          </div>

          <div
            className="flex flex-col gap-4"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              swipe.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
            }}
            onTouchEnd={(event) => {
              const start = swipe.current;
              const touch = event.changedTouches[0];
              swipe.current = null;
              if (!start || !touch) return;
              const dx = touch.clientX - start.x;
              const dy = touch.clientY - start.y;
              if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
              const to = shown + (dx < 0 ? 1 : -1);
              if (to >= 0 && to < policies.length) setShown(to);
            }}
          >
            {charts.map((chart, i) => (
              <div
                key={i}
                data-chart={i}
                className={cn('flex flex-col gap-1', i !== shown && 'max-sm:hidden')}
              >
                <h3 className="text-small flex flex-wrap items-center gap-2 font-semibold">
                  {result.names[i]}
                  {tick >= chart.ticks ? <DoneFlag ticks={chart.ticks} /> : null}
                </h3>
                <GanttChart
                  segments={chart.segments}
                  tick={Math.min(tick, chart.ticks)}
                  endTick={result.durationTicks}
                  lanes={lanes[i]}
                  title={`Gantt chart, ${result.names[i]}`}
                  zoom="fit"
                  animate
                />
              </div>
            ))}
          </div>
          <Legend />
        </section>
      </div>
    </ModuleLayout>
  );
}
