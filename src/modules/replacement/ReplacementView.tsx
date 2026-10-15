'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';

import { FrameStrip } from '@/components/blocks/FrameStrip';
import { MetricsTable } from '@/components/blocks/MetricsTable';
import { Term } from '@/components/glossary/Term';
import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { ruleUsed, StepInspector } from '@/components/inspector/StepInspector';
import { Flash } from '@/components/motion/Flash';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useShareState } from '@/components/state/useShareState';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
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
import {
  BELADY_STRING,
  DEFAULT_PRESET,
  presetById,
  REPL_PRESETS,
} from '@/core/replace/presets';
import { countFaults, runReplace } from '@/core/replace/replace';
import { REPL_RULES } from '@/core/replace/rules';
import { REPLACE_SHARE_STATE } from '@/core/replace/state';

import {
  countersAt,
  eventAt,
  hitRate,
  metricsRows,
  referencesDone,
  resultSentence,
  ruleIdFor,
  stepHeading,
  stripColumns,
  tryNextFor,
} from './adapters';
import { BeladyPanel } from './BeladyPanel';
import { ClockRing } from './ClockRing';
import { CurvePanel } from './CurvePanel';
import { FaultSplit } from './FaultSplit';
import { Disclosure, Panel, SelectField } from './fields';
import { InputPanel } from './InputPanel';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { PolicyState } from './PolicyState';
import { PolicyTabs } from './PolicyTabs';
import { useStepRun } from './useStepRun';

/** Guided mode's lesson: client-only, its own chunk, out of first-load JS. */
const GuidedLesson = dynamic(() => import('./GuidedLesson'), {
  ssr: false,
  loading: () => <p className="text-fg-muted text-small">Loading the lesson…</p>,
});

const CITATIONS = createRegistry([replaceCitations]);

function Stat({
  id,
  label,
  value,
  changed = false,
}: {
  id: string;
  label: ReactNode;
  value: string;
  /** Pulses once when the value changed on this step. */
  changed?: boolean;
}) {
  return (
    <div className="border-border rounded-md border px-3 py-2">
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className="font-mono text-lg font-semibold" data-testid={id}>
        <Flash trigger={value} active={changed}>
          {value}
        </Flash>
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
  const before = countersAt(position > 0 ? eventAt(run, position - 1) : undefined);
  const done = referencesDone(event);
  const columns = stripColumns(run, refString, event, policy);
  const current = event?.state.index ?? 0;
  const ruleId = ruleIdFor(event, policy);

  const setInput = (next: ReplInput) => setState((s) => ({ ...s, step: 0, input: next }));

  const preset = REPL_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET;
  const editorKey = `${loads}-${ready ? 1 : 0}`;

  const loadPreset = (id: string) => {
    const chosen = presetById(id) ?? DEFAULT_PRESET;
    setPresetId(chosen.id);
    setInput(chosen.input);
    setGenerator(chosen.generator);
    setLoads((n) => n + 1);
    setStatus(`Loaded preset: ${chosen.title}`);
  };

  const next = tryNextFor(policy, refString, BELADY_STRING);
  const endOfRun = {
    result: resultSentence(policy, frames, totals[policy], refString.length),
    tryNext: {
      label: next.label,
      why: next.why,
      onSelect: () => {
        if (next.presetId) loadPreset(next.presetId);
        else if (next.policy) {
          setInput({ ...input, policy: next.policy });
          setStatus(`Switched to ${POLICY_NAMES[next.policy]} on the same string.`);
        }
      },
    },
  };

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
        <Button variant="primary" size="sm" onClick={() => loadPreset(presetId)}>
          Load preset
        </Button>
        <p role="status" className="text-caption text-fg-muted min-h-4">
          {status}
        </p>
      </Panel>
      <Disclosure summary="Edit the string and frames">
        <InputPanel
          key={`input-${editorKey}`}
          input={input}
          generator={generator}
          onChange={setInput}
          onGenerated={(options) => setStatus(`Generated ${options.length} references.`)}
        />
      </Disclosure>
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector
        heading={stepHeading(event, refString)}
        event={event}
        rule={ruleUsed(REPL_RULES, ruleId)}
      />
      <RulesPanel rules={REPL_RULES} currentRuleId={ruleId} />
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

  const results = (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="metrics-heading" className="flex flex-col gap-2">
        <h2 id="metrics-heading" className="text-lead font-semibold">
          Every policy on this string
        </h2>
        <MetricsTable
          caption={`Whole string, ${frames} ${frames === 1 ? 'frame' : 'frames'}`}
          columns={POLICIES.map((p) => ({ id: p, label: POLICY_NAMES[p] }))}
          rows={metricsRows(totals, refString.length)}
        />
        <div
          role="group"
          aria-label="Cold and capacity faults per policy"
          className="flex flex-col gap-2 sm:max-w-md"
        >
          {POLICIES.map((p) => (
            <FaultSplit
              key={p}
              label={POLICY_NAMES[p]}
              cold={totals[p].cold}
              capacity={totals[p].faults - totals[p].cold}
            />
          ))}
          <p className="text-caption text-fg-muted">
            Cold faults are the same for every policy: only the capacity part can be won
            or lost.
          </p>
        </div>
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
  );

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Page Replacement"
        intro={
          <>
            Serve a <Term id="reference-string">reference string</Term> with a few{' '}
            <Term id="frame">frames</Term> of memory under FIFO, LRU, OPT or Clock, one
            reference at a time, with the reason for every <Term id="victim">victim</Term>{' '}
            chosen.
          </>
        }
        mode={mode}
        onModeChange={setMode}
        inputs={inputs}
        inspector={inspector}
        results={results}
        endOfRun={endOfRun}
        share={{ link: share.link, shareable: share.shareable }}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="step" />}
      >
        <div className="flex flex-col gap-6">
          {mode === 'walkthrough' ? (
            <GuidedLesson
              lesson={LESSON}
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
              <Stat
                id="faults"
                label={<Term id="page-fault">Page faults</Term>}
                value={String(counters.faults)}
                changed={counters.faults !== before.faults}
              />
              <Stat
                id="hits"
                label="Hits"
                value={String(counters.hits)}
                changed={counters.hits !== before.hits}
              />
              <Stat id="hit-rate" label="Hit rate" value={hitRate(counters.hits, done)} />
              <Stat
                id="cold"
                label={
                  <>
                    <Term id="cold-fault">Cold</Term> (compulsory)
                  </>
                }
                value={String(counters.cold)}
                changed={counters.cold !== before.cold}
              />
              <Stat
                id="capacity"
                label={<Term id="capacity-fault">Capacity</Term>}
                value={String(counters.faults - counters.cold)}
                changed={counters.faults - counters.cold !== before.faults - before.cold}
              />
              <Stat
                id="refs-done"
                label="References done"
                value={`${done} / ${refString.length}`}
              />
            </dl>
            <FaultSplit cold={counters.cold} capacity={counters.faults - counters.cold} />
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
              onChange={(chosen) => setInput({ ...input, policy: chosen })}
            >
              {policy === 'clock' && event ? (
                <div className="flex flex-col gap-1">
                  <p className="text-small">
                    Each frame has a <Term id="use-bit">use bit</Term>. The hand sweeps
                    round the ring looking for a 0.
                  </p>
                  <ClockRing state={event.state} focus={event.frame} />
                </div>
              ) : null}
              <FrameStrip
                columns={columns}
                step={current}
                mode={policy === 'clock' ? 'clock' : 'plain'}
                caption={`${POLICY_NAMES[policy]}: frames after each reference`}
                animate
                fit
                refMarks
              />
              {event ? <PolicyState event={event} policy={policy} /> : null}
            </PolicyTabs>
          </section>
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
