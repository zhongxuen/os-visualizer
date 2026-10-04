'use client';

import { useMemo, useState } from 'react';

import { FrameStrip } from '@/components/blocks/FrameStrip';
import { MetricsTable } from '@/components/blocks/MetricsTable';
import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { Walkthrough } from '@/components/lesson/Walkthrough';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { StepInspector } from '@/components/inspector/StepInspector';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useShareState } from '@/components/state/useShareState';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
import ReplacementLesson from '@/content/lessons/replacement.mdx';
import { createRegistry } from '@/core/citations/registry';
import { replaceCitations } from '@/core/replace/citations';
import { allCurves } from '@/core/replace/curve';
import type { GenerateOptions } from '@/core/replace/generate';
import {
  POLICIES,
  POLICY_NAMES,
  type Policy,
  type ReplInput,
} from '@/core/replace/input';
import { DEFAULT_PRESET, REPL_PRESETS } from '@/core/replace/presets';
import { countFaults, runReplace } from '@/core/replace/replace';
import { REPL_RULES } from '@/core/replace/rules';
import { REPLACE_SHARE_STATE } from '@/core/replace/state';

import {
  columnsAt,
  countersAt,
  eventAt,
  hitRate,
  metricsRows,
  referencesDone,
  stepHeading,
} from './adapters';
import { BeladyPanel } from './BeladyPanel';
import { CurvePanel } from './CurvePanel';
import { Panel, SelectField } from './fields';
import { InputPanel } from './InputPanel';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { PolicyState } from './PolicyState';
import { PolicyTabs } from './PolicyTabs';
import { useStepRun } from './useStepRun';

const CITATIONS = createRegistry([replaceCitations]);

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

export function ReplacementView() {
  const share = useShareState(REPLACE_SHARE_STATE);
  const { state, setState, ready } = share;
  const input = state.input as ReplInput;
  const { refString, frames, policy } = input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [generator, setGenerator] = useState<GenerateOptions | undefined>(
    DEFAULT_PRESET.generator,
  );
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');

  const run = useMemo(() => runReplace(input), [input]);
  const curves = useMemo(() => allCurves(refString), [refString]);
  const totals = useMemo(
    () =>
      Object.fromEntries(
        POLICIES.map((p) => [p, countFaults(refString, frames, p)]),
      ) as Record<Policy, ReturnType<typeof countFaults>>,
    [refString, frames],
  );
  const { store, position, total, moment, phaseIndex } = useStepRun(run, share);

  const event = eventAt(run, position);
  const counters = countersAt(event);
  const done = referencesDone(event);
  const columns = columnsAt(run, refString, event);
  const current = event?.state.index ?? 0;

  const setInput = (next: ReplInput) => setState((s) => ({ ...s, step: 0, input: next }));

  const preset = REPL_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET;
  const editorKey = `${loads}-${ready ? 1 : 0}`;

  const inputs = (
    <div className="flex flex-col gap-4">
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={presetId}
          options={REPL_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          onChange={setPresetId}
        />
        <p className="text-caption text-fg-muted">{preset.summary}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setInput(preset.input);
            setGenerator(preset.generator);
            setLoads((n) => n + 1);
            setStatus(`Loaded preset: ${preset.title}`);
          }}
        >
          Load preset
        </Button>
      </Panel>
      <InputPanel
        key={`input-${editorKey}`}
        input={input}
        generator={generator}
        onChange={setInput}
        onGenerated={(options) => setStatus(`Generated ${options.length} references.`)}
      />
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
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector heading={stepHeading(event, refString)} event={event} />
      <RulesPanel rules={REPL_RULES} />
      <div>
        <h2 className="text-small text-fg-muted mb-2 font-semibold">References</h2>
        <PhaseStepper
          phases={run.phases}
          currentIndex={phaseIndex}
          onSeek={(time) => store.getState().seek(time)}
          unit="step"
        />
      </div>
    </div>
  );

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Page Replacement"
        intro="Serve a reference string with a few frames of memory under FIFO, LRU, OPT or Clock, one reference at a time, with the reason for every eviction."
        mode={mode}
        onModeChange={setMode}
        inputs={inputs}
        inspector={inspector}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="step" />}
      >
        <div className="flex flex-col gap-6">
          {mode === 'walkthrough' ? (
            <Walkthrough
              lesson={LESSON}
              Content={ReplacementLesson}
              store={store}
              unit="step"
              examples={LESSON_EXAMPLES}
              activeExample={activeExample(input)}
              onLoadExample={(id) => {
                const example = LESSON_EXAMPLES.find((e) => e.id === id)!;
                setInput(example.input);
                setGenerator(undefined);
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
              question="Is the page already in memory? If not, which page should make room?"
              className="border-border bg-surface-raised min-h-24 rounded-lg border p-4"
            />
          ) : null}

          <section aria-labelledby="counters-heading" className="flex flex-col gap-2">
            <h2 id="counters-heading" className="text-lead font-semibold">
              So far
            </h2>
            <p className="text-caption text-fg-muted">
              {POLICY_NAMES[policy]}, {frames} {frames === 1 ? 'frame' : 'frames'},{' '}
              {refString.length} references. Step {Math.min(position + 1, total)} of{' '}
              {total}.
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat id="faults" label="Page faults" value={String(counters.faults)} />
              <Stat id="hits" label="Hits" value={String(counters.hits)} />
              <Stat id="hit-rate" label="Hit rate" value={hitRate(counters.hits, done)} />
              <Stat id="cold" label="Cold (compulsory)" value={String(counters.cold)} />
              <Stat
                id="capacity"
                label="Capacity"
                value={String(counters.faults - counters.cold)}
              />
              <Stat
                id="refs-done"
                label="References done"
                value={`${done} / ${refString.length}`}
              />
            </dl>
          </section>

          <section aria-labelledby="frames-heading" className="flex flex-col gap-3">
            <h2 id="frames-heading" className="text-lead font-semibold">
              Frames
            </h2>
            <PolicyTabs
              policy={policy}
              faults={
                Object.fromEntries(POLICIES.map((p) => [p, totals[p].faults])) as Record<
                  Policy,
                  number
                >
              }
              onChange={(next) => setInput({ ...input, policy: next })}
            >
              <FrameStrip
                columns={columns}
                step={current}
                mode={policy === 'clock' ? 'clock' : 'plain'}
                caption={`${POLICY_NAMES[policy]}: frames after each reference`}
              />
              {event ? <PolicyState event={event} policy={policy} /> : null}
            </PolicyTabs>
          </section>

          <section aria-labelledby="metrics-heading" className="flex flex-col gap-2">
            <h2 id="metrics-heading" className="text-lead font-semibold">
              Every policy on this string
            </h2>
            <MetricsTable
              caption={`Whole string, ${frames} ${frames === 1 ? 'frame' : 'frames'}`}
              columns={POLICIES.map((p) => ({ id: p, label: POLICY_NAMES[p] }))}
              rows={metricsRows(totals, refString.length)}
            />
          </section>

          <section aria-labelledby="curve-heading" className="flex flex-col gap-2">
            <h2 id="curve-heading" className="text-lead font-semibold">
              Faults vs frames
            </h2>
            <CurvePanel curves={curves} frames={frames} />
          </section>

          <section aria-labelledby="belady-heading" className="flex flex-col gap-2">
            <h2 id="belady-heading" className="text-lead font-semibold">
              Belady’s anomaly: one frame more
            </h2>
            <BeladyPanel
              key={`belady-${editorKey}-${refString.join('.')}-${frames}`}
              refString={refString}
              frames={frames}
              policy="fifo"
            />
          </section>
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
