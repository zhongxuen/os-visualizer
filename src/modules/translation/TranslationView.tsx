'use client';

import dynamic from 'next/dynamic';
import { ChevronDown, Pencil } from 'lucide-react';
import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';

import type { NumberBase } from '@/components/blocks/BitField';
import { Term } from '@/components/glossary';
import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { ruleUsed, StepInspector } from '@/components/inspector/StepInspector';
import { Ticker } from '@/components/motion';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useLessonAutoLoad } from '@/components/lesson/autoLoad';
import { LESSON_PRESET, presetSelect } from '@/components/lesson/presetOption';
import { useShareState } from '@/components/state/useShareState';
import { isTypingTarget } from '@/components/timeline/keymap';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
import { Tabs } from '@/components/ui';
import { createRegistry } from '@/core/citations/registry';
import { vmCitations } from '@/core/vm/citations';
import { geometry, type VmInput } from '@/core/vm/config';
import type { VmCounters, VmEvent, VmStep } from '@/core/vm/events';
import { DEFAULT_PRESET, VM_PRESETS, regionsFor, type VmPreset } from '@/core/vm/presets';
import { VM_RULES } from '@/core/vm/rules';
import type { SizingInput } from '@/core/vm/sizing';
import { VM_SHARE } from '@/core/vm/share';
import { runVm } from '@/core/vm/translate';
import { cn } from '@/lib/cn';

import { AccessList } from './AccessList';
import { AddressView } from './AddressView';
import { BaseSwitch, nextBase } from './BaseSwitch';
import {
  countersAt,
  eventAt,
  hitRate,
  inputSummary,
  pdeFocus,
  pteFocus,
  ruleIdFor,
  tlbFocus,
} from './adapters';
import { resultSentence, tryNextFor } from './endOfRun';
import { Panel, SelectField } from './fields';
import { replacementHandoff, type ReplacementHandoff } from './handoff';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { PageTableView, type PageTableFault } from './PageTableView';
import { Pipeline } from './Pipeline';
import { stageStates } from './stages';
import { isBaseKey, MODULE_SHORTCUTS } from './shortcuts';

import { TlbView } from './TlbView';
import { useStepRun } from './useStepRun';

import { walkAt, WalkPath } from './WalkPath';

/** Guided mode's lesson: client-only, its own chunk, out of first-load JS. */
const GuidedLesson = dynamic(() => import('./GuidedLesson'), {
  ssr: false,
  loading: () => <p className="text-fg-muted text-small">Loading the lesson…</p>,
});

const CITATIONS = createRegistry([vmCitations]);

/*
 * Loaded when first needed, to keep the route inside its JS budget: the editor when
 * "Edit this input" opens it (G10), the size calculator when its tab opens (T4).
 */
const VmEditor = lazy(() => import('./VmEditor').then((m) => ({ default: m.VmEditor })));
const SizingTab = lazy(() =>
  import('./SizingTab').then((m) => ({ default: m.SizingTab })),
);

function Loading() {
  return <p className="text-small text-fg-muted">Loading…</p>;
}

export const STEP_NAMES: Record<VmStep, string> = {
  1: 'split the address',
  2: 'TLB lookup',
  3: 'page-table walk',
  4: 'protection check',
  5: 'TLB fill',
  6: 'physical address',
  7: 'memory access',
};

type RunInput = VmInput & { sizing: SizingInput };
type View = 'translation' | 'sizing';

/** A counter: rolls with `Ticker`, and is read once, from plain text, by tests and AT. */
function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="border-border rounded-md border px-3 py-2">
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className="font-mono text-lg font-semibold">
        <span className="sr-only" data-testid={id}>
          {value}
        </span>
        <span aria-hidden="true">
          <Ticker value={value} />
        </span>
      </dd>
    </div>
  );
}

function tlbAction(event: VmEvent | undefined): 'hit' | 'fill' | 'check' | undefined {
  if (!event) return undefined;
  if (event.kind === 'vm.tlbHit') return 'hit';
  if (event.kind === 'vm.tlbInsert') return 'fill';
  return 'check';
}

function faultOf(event: VmEvent | undefined): PageTableFault | null {
  if (event?.kind !== 'vm.fault' || !event.fault) return null;
  return { kind: event.fault, table: event.table, vpn: event.vpn };
}

/**
 * Where a fault leads: the OS's side of the story is the Page Replacement module. An
 * invalid-page fault carries this run's pages over (T5), so that module opens on them.
 */
export function FaultNext({
  event,
  handoff,
}: {
  event: VmEvent;
  handoff: ReplacementHandoff;
}) {
  const invalid = event.fault !== 'protection';
  const href = invalid ? handoff.href : '/replacement';
  return (
    <div className="text-small border-state-error flex flex-col gap-1 rounded-md border-l-4 py-1 pl-3">
      <p>
        {invalid ? (
          <>
            The OS gets a <Term id="page-fault">page fault</Term>: it may bring page{' '}
            {event.vpn} in from disk, evicting another page to make room.{' '}
          </>
        ) : (
          'The OS gets a protection fault and usually ends the process. '
        )}
        {/*
          A plain link, a full page load: Page Replacement reads its `?s=` as it opens,
          and a client-side navigation would let it read this page's address instead.
        */}
        <a
          href={href}
          data-testid="fault-next"
          className="text-accent font-semibold underline underline-offset-2"
        >
          What happens next? → Page Replacement
        </a>
      </p>
      {invalid && handoff.pages ? (
        <p className="text-caption text-fg-secondary" data-testid="fault-next-pages">
          It opens with this run’s pages as its reference string:{' '}
          <span className="font-mono">
            {handoff.pages.map((page, i) => (
              <span key={i}>
                {i > 0 ? ', ' : ''}
                {page === event.vpn ? <strong>{page}</strong> : page}
              </span>
            ))}
          </span>
          . Page {event.vpn} is the one that faulted.
        </p>
      ) : invalid && handoff.reason ? (
        <p className="text-caption text-fg-secondary">{handoff.reason}</p>
      ) : null}
    </div>
  );
}

function Counters({
  counters,
  total,
  summary,
  position,
  steps,
}: {
  counters: VmCounters;
  total: number;
  summary: string;
  position: number;
  steps: number;
}) {
  return (
    <section aria-labelledby="counters-heading" className="flex flex-col gap-2">
      <h2 id="counters-heading" className="text-lead font-semibold">
        So far
      </h2>
      <p className="text-caption text-fg-muted">
        {summary}. Step {Math.min(position + 1, steps)} of {steps}.
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat id="tlb-hits" label="TLB hits" value={String(counters.hits)} />
        <Stat id="tlb-misses" label="TLB misses" value={String(counters.misses)} />
        <Stat id="hit-rate" label="TLB hit rate" value={hitRate(counters)} />
        <Stat id="mem-refs" label="Memory references" value={String(counters.memRefs)} />
        <Stat id="faults" label="Faults" value={String(counters.faults)} />
        <Stat
          id="accesses-done"
          label="Accesses done"
          value={`${counters.accesses} / ${total}`}
        />
      </dl>
    </section>
  );
}

export function TranslationView() {
  const share = useShareState(VM_SHARE);
  const { state, setState, ready } = share;
  const input = state.input as RunInput;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(false);
  const [base, setBase] = useState<NumberBase>('binary');
  const [view, setView] = useState<View>('translation');
  // Once opened, the sizing tab stays mounted, so its half-typed fields survive.
  const [sizingOpened, setSizingOpened] = useState(false);
  const editorId = useId();

  const run = useMemo(() => runVm(input), [input]);
  const g = useMemo(() => geometry(input.config), [input.config]);
  const { store, position, total, moment, phaseIndex } = useStepRun(run, share);

  const event = eventAt(run, position);
  const snapshot = event?.state;
  const counters = countersAt(event);
  const current = snapshot?.access ?? 0;
  const fromTable = useMemo<SizingInput>(
    () => ({
      vaBits: input.config.vaBits,
      pageSize: Math.max(8, input.config.pageSize),
      regions: regionsFor(input.pages),
    }),
    [input.config.vaBits, input.config.pageSize, input.pages],
  );
  const stages = useMemo(
    () => stageStates(run, position, input.config.tlbSize),
    [run, position, input.config.tlbSize],
  );
  const walk = useMemo(
    () => walkAt(run.events, position, g, input.config.ptbr),
    [run.events, position, g, input.config.ptbr],
  );
  const handoff = useMemo(() => replacementHandoff(input), [input]);
  const ruleId = ruleIdFor(event, input.config);

  // B: the next number base (T1). A module key, listed in the shortcuts sheet.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || !isBaseKey(e)) return;
      e.preventDefault();
      setBase((b) => nextBase(b));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const setRunInput = (next: VmInput) =>
    setState((s) => ({
      ...s,
      step: 0,
      input: { ...next, sizing: (s.input as RunInput).sizing },
    }));
  const setSizing = (sizing: SizingInput) =>
    setState((s) => ({ ...s, input: { ...(s.input as RunInput), sizing } }));

  const loadPreset = (preset: VmPreset, verb = 'preset') => {
    setState((s) => ({
      ...s,
      step: 0,
      input: { ...preset.input, sizing: preset.sizing },
    }));
    setPresetId(preset.id);
    setLoads((n) => n + 1);
    setStatus(`Loaded ${verb}: ${preset.title}`);
  };

  const exampleId = activeExample(input);
  const presets = presetSelect(
    VM_PRESETS.map((p) => ({ value: p.id, label: p.title })),
    presetId,
    exampleId,
    DEFAULT_PRESET.id,
  );
  const lessonExample = presets.lesson
    ? LESSON_EXAMPLES.find((e) => e.id === exampleId)
    : undefined;
  const preset = VM_PRESETS.find((p) => p.id === presets.value) ?? DEFAULT_PRESET;
  const lessonAuto = useLessonAutoLoad({
    ready,
    linked: share.linked,
    defaults: VM_SHARE.defaults,
    input: state.input,
  });
  const loadExample = (id: string) => {
    lessonAuto.lessonLoaded();
    loadPreset(
      LESSON_EXAMPLES.find((e) => e.id === id)!,
      'example',
    );
    setPresetId(LESSON_PRESET);
  };
  const editorKey = `${loads}-${ready ? 1 : 0}`;

  const inputs = (
    <div className="flex flex-col gap-4">
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={presets.value}
          options={presets.options}
          onChange={setPresetId}
        />
        <p className="text-caption text-fg-muted">
          {lessonExample ? `From the lesson: ${lessonExample.title}.` : preset.summary}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            lessonExample ? loadExample(lessonExample.id) : loadPreset(preset)
          }
        >
          Load preset
        </Button>
        <p role="status" className="text-caption text-fg-muted min-h-4">
          {status}
        </p>
      </Panel>
      <div className="flex flex-col gap-4">
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={editing}
          aria-controls={editorId}
          onClick={() => setEditing((on) => !on)}
          className="self-start"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Edit this input
          <ChevronDown
            aria-hidden="true"
            className={cn('size-3.5 transition-transform', editing && 'rotate-180')}
          />
        </Button>
        <div id={editorId} hidden={!editing} className="flex flex-col gap-4">
          {editing ? (
            <Suspense fallback={<Loading />}>
              <VmEditor
                key={`editor-${editorKey}`}
                input={input}
                onChange={setRunInput}
              />
            </Suspense>
          ) : null}
        </div>
      </div>
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector
        heading={
          event
            ? `Access ${event.access + 1}, step ${event.step}: ${STEP_NAMES[event.step]}`
            : 'This step'
        }
        event={event}
        rule={ruleUsed(VM_RULES, ruleId)}
      >
        {event?.kind === 'vm.fault' ? (
          <FaultNext event={event} handoff={handoff} />
        ) : null}
      </StepInspector>
      <RulesPanel rules={VM_RULES} currentRuleId={ruleId} />
      <div>
        <h2 className="text-small text-fg-muted mb-2 font-semibold">Accesses</h2>
        <PhaseStepper
          phases={run.phases}
          currentIndex={phaseIndex}
          onSeek={(time) => store.getState().seek(time)}
          unit="step"
        />
      </div>
    </div>
  );

  const finalCounters = countersAt(run.events.at(-1));
  const next = tryNextFor(input, finalCounters);

  const results = (
    <div className="flex flex-col gap-6">
      <Counters
        counters={counters}
        total={input.accesses.length}
        summary={inputSummary(input)}
        position={position}
        steps={total}
      />
      <section aria-labelledby="accesses-heading" className="flex flex-col gap-2">
        <h2 id="accesses-heading" className="text-lead font-semibold">
          Access list
        </h2>
        <AccessList
          g={g}
          accesses={input.accesses}
          log={snapshot?.log ?? []}
          current={current}
        />
      </section>
    </div>
  );

  const translationTab = (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="address-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="address-heading" className="text-lead font-semibold">
            The address
          </h2>
          <BaseSwitch value={base} onChange={setBase} />
        </div>
        <AddressView event={event} g={g} base={base} position={position} />
      </section>

      <section aria-labelledby="tlb-heading" className="flex flex-col gap-2">
        <h2 id="tlb-heading" className="text-lead font-semibold">
          TLB
        </h2>
        <p className="text-caption text-fg-muted">
          The <Term id="tlb">TLB</Term> caches recent translations. A{' '}
          <Term id="tlb-hit-miss">hit</Term> skips the page-table walk.
        </p>
        <TlbView
          slots={snapshot?.tlb ?? []}
          policy={input.config.tlbPolicy}
          focus={tlbFocus(event)}
          action={tlbAction(event)}
          evicted={event?.evicted}
          lookup={
            event?.kind === 'vm.tlbHit' || event?.kind === 'vm.tlbMiss'
              ? { vpn: event.vpn, hit: event.kind === 'vm.tlbHit' }
              : undefined
          }
          position={position}
        />
      </section>

      <section aria-labelledby="pt-heading" className="flex flex-col gap-2">
        <h2 id="pt-heading" className="text-lead font-semibold">
          Page table in memory
        </h2>
        <p className="text-caption text-fg-muted">
          The <Term id="ptbr">PTBR</Term> says where the table starts. Each{' '}
          <Term id="pte">PTE</Term> holds a <Term id="valid-bit">valid bit</Term>, the
          frame number and the <Term id="protection-bit">protection bits</Term>.
          {g.levels === 2 ? (
            <>
              {' '}
              With two levels, a <Term id="pde">PDE</Term> first says which frame holds
              that part of the table.
            </>
          ) : null}
        </p>
        <WalkPath walk={walk} g={g} position={position} />
        <PageTableView
          g={g}
          ptbr={input.config.ptbr}
          ptes={snapshot?.ptes ?? []}
          directory={snapshot?.directory ?? []}
          pteFocus={pteFocus(event)}
          pdeFocus={pdeFocus(event, g)}
          marked={event?.kind === 'vm.physical' ? event.vpn : null}
          fault={faultOf(event)}
        />
      </section>
    </div>
  );

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Address Translation"
        intro={
          <>
            Split a <Term id="virtual-address">virtual address</Term>, look it up in the
            TLB, walk the page table and land on a physical <Term id="frame">frame</Term>,
            one step at a time.
          </>
        }
        mode={mode}
        onModeChange={setMode}
        inputs={inputs}
        inspector={inspector}
        results={results}
        share={{ link: share.link, shareable: share.shareable }}
        shortcuts={MODULE_SHORTCUTS}
        endOfRun={{
          result: resultSentence(finalCounters),
          tryNext: {
            label: next.preset.title,
            why: next.why,
            onSelect: () => loadPreset(next.preset),
          },
        }}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="step" />}
      >
        <div className="flex flex-col gap-6">
          {mode === 'walkthrough' ? (
            <GuidedLesson
              lesson={LESSON}
              store={store}
              unit="step"
              examples={LESSON_EXAMPLES}
              activeExample={exampleId}
              onLoadExample={loadExample}
              checkpoints={LESSON_CHECKPOINTS}
              autoLoad={lessonAuto.autoLoad}
            />
          ) : null}
          {mode === 'walkthrough' ? (
            <StepCaption
              phases={run.phases}
              currentIndex={phaseIndex}
              moment={moment}
              question="Where in physical memory does this virtual address land, and what does it cost to find out?"
              className="border-border bg-surface-raised min-h-24 rounded-lg border p-4"
            />
          ) : null}

          <section aria-labelledby="pipeline-heading" className="flex flex-col gap-2">
            <h2 id="pipeline-heading" className="text-lead font-semibold">
              {event
                ? `Access ${event.access + 1} of ${input.accesses.length}: where it is`
                : 'Where the access is'}
            </h2>
            {stages ? <Pipeline stages={stages} position={position} /> : null}
          </section>

          <Tabs
            label="Views"
            tabId={view}
            onTabChange={(id) => {
              setView(id as View);
              if (id === 'sizing') setSizingOpened(true);
            }}
            items={[
              { id: 'translation', label: 'Translation', content: translationTab },
              {
                id: 'sizing',
                label: 'Why two levels?',
                content:
                  view === 'sizing' || sizingOpened ? (
                    <Suspense fallback={<Loading />}>
                      <SizingTab
                        key={`sizing-${editorKey}`}
                        g={g}
                        mapped={input.pages.filter((p) => p.valid).length}
                        shown={view === 'sizing'}
                        sizing={input.sizing}
                        onChange={setSizing}
                        fromTable={fromTable}
                      />
                    </Suspense>
                  ) : null,
              },
            ]}
          />
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
