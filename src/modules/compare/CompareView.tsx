'use client';

import { useMemo, useState } from 'react';

import { GanttChart } from '@/components/blocks/GanttChart';
import { MetricsTable } from '@/components/blocks/MetricsTable';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useShareState } from '@/components/state/useShareState';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { Button } from '@/components/timeline/ui/Button';
import { compare, COMPARE_PRESETS, type CompareRow, whyLine } from '@/core/sched/compare';
import { metricsFrom, type RunMetrics } from '@/core/sched/metrics';
import { COMPARE_SHARE_STATE } from '@/core/sched/state';
import type { Policy, Workload } from '@/core/sched/workload';
import {
  finalSegments,
  ganttLanes,
  MetricDefinitions,
  Panel,
  runTicks,
  SelectField,
  toGanttSegments,
  useTickRun,
  WorkloadEditor,
} from '@/modules/scheduling';

import { PolicyColumns } from './PolicyColumns';

/**
 * Compare: one workload, 2-4 policies, one Gantt chart each on a shared time axis
 * following one cursor, and a side-by-side metrics table at the cursor with the best
 * value in each row marked and a generated "Why?" line.
 */

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

export function CompareView() {
  const share = useShareState(COMPARE_SHARE_STATE);
  const { state, setState, ready } = share;
  const { workload, policies } = state.input;
  const [mode, setMode] = useState<ModuleMode>('free');
  const [presetId, setPresetId] = useState(COMPARE_PRESETS[0]!.id);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');

  const result = useMemo(() => compare(workload, policies), [workload, policies]);
  const { store, tick } = useTickRun(result.timeline, share);

  const setInput = (input: Input) => setState((s) => ({ ...s, step: 0, input }));

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
  const why = whyLine(table, result.names);

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
            setInput({ workload: preset.workload, policies: preset.policies });
            setLoads((n) => n + 1);
            setStatus(`Loaded preset: ${preset.title}`);
          }}
        >
          Load preset
        </Button>
        <p role="status" className="text-caption text-fg-muted min-h-4">
          {status}
        </p>
      </Panel>
      <Panel title="Policies">
        <PolicyColumns
          key={`policies-${loads}-${ready ? 1 : 0}`}
          policies={policies}
          names={result.names}
          onChange={(next) => setInput({ workload, policies: next })}
        />
      </Panel>
      <Panel title="Workload">
        <WorkloadEditor
          key={`workload-${loads}-${ready ? 1 : 0}`}
          workload={workload}
          showPriority={policies.some((p) => p.kind === 'priority')}
          onChange={(next) => setInput({ workload: next, policies })}
        />
      </Panel>
    </div>
  );

  const percentRows = table.map((row) =>
    row.id === 'utilisation'
      ? { ...row, label: 'CPU utilisation (%)', values: row.values.map((v) => v * 100) }
      : row,
  );

  return (
    <ModuleLayout
      title="Compare schedulers"
      intro="One workload under two to four policies at once: one Gantt chart each on a shared time axis, one cursor, and the metrics side by side."
      mode={mode}
      onModeChange={setMode}
      inputs={inputs}
      timeline={<PlaybackBar store={store} phases={result.timeline.phases} unit="tick" />}
    >
      <div className="flex flex-col gap-6">
        {mode === 'walkthrough' ? (
          <p className="border-border bg-surface-raised text-small rounded-lg border p-4">
            Step through with the arrow keys: every chart follows the same cursor. Before
            you reach the end, predict which policy will have the lowest average waiting
            time.
          </p>
        ) : null}
        <section aria-labelledby="charts-heading" className="flex flex-col gap-4">
          <h2 id="charts-heading" className="text-lead font-semibold">
            Gantt charts at t = {tick}
          </h2>
          {charts.map((chart, i) => (
            <div key={i} className="flex flex-col gap-1">
              <h3 className="text-small font-semibold">
                {result.names[i]}
                {tick >= chart.ticks ? (
                  <span className="text-fg-muted font-normal">
                    {' '}
                    (finished at t = {chart.ticks})
                  </span>
                ) : null}
              </h3>
              <GanttChart
                segments={chart.segments}
                tick={Math.min(tick, chart.ticks)}
                endTick={result.durationTicks}
                lanes={ganttLanes(policies[i]!)}
                title={`Gantt chart, ${result.names[i]}`}
              />
            </div>
          ))}
        </section>

        <section
          aria-labelledby="compare-metrics-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="compare-metrics-heading" className="text-lead font-semibold">
            Metrics at t = {tick}
          </h2>
          <div className="overflow-x-auto">
            <MetricsTable
              caption="Side by side (averages over finished processes)"
              columns={result.names.map((label, i) => ({ id: `c${i}`, label }))}
              rows={percentRows.map((row) => ({
                id: row.id,
                label: row.label,
                values: row.values,
                better: row.better,
              }))}
            />
          </div>
          <p className="text-small" data-testid="why-line">
            <strong>Why? </strong>
            {why}
          </p>
          <MetricDefinitions />
        </section>
      </div>
    </ModuleLayout>
  );
}
