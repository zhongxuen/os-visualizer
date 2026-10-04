'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BitField } from '@/components/blocks/BitField';
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
import TranslationLesson from '@/content/lessons/translation.mdx';
import { createRegistry } from '@/core/citations/registry';
import { vmCitations } from '@/core/vm/citations';
import { geometry, type VmInput } from '@/core/vm/config';
import type { VmEvent, VmStep } from '@/core/vm/events';
import { DEFAULT_PRESET, VM_PRESETS, regionsFor } from '@/core/vm/presets';
import { VM_RULES } from '@/core/vm/rules';
import type { SizingInput } from '@/core/vm/sizing';
import { VM_SHARE_STATE } from '@/core/vm/state';
import { runVm } from '@/core/vm/translate';

import { AccessList } from './AccessList';
import {
  countersAt,
  eventAt,
  hitRate,
  inputSummary,
  paParts,
  pdeFocus,
  pteFocus,
  tlbFocus,
  vaHighlight,
  vaParts,
} from './adapters';
import { Panel, SelectField } from './fields';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { PageTableView } from './PageTableView';
import { SizingPanel } from './SizingPanel';
import { TlbView } from './TlbView';
import { useStepRun } from './useStepRun';
import { VmEditor } from './VmEditor';

const CITATIONS = createRegistry([vmCitations]);

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

function tlbAction(event: VmEvent | undefined): 'hit' | 'fill' | 'check' | undefined {
  if (!event) return undefined;
  if (event.kind === 'vm.tlbHit') return 'hit';
  if (event.kind === 'vm.tlbInsert') return 'fill';
  return 'check';
}

/** Where a fault leads: the OS's side of the story is the Page Replacement module. */
export function FaultNext({ event }: { event: VmEvent }) {
  return (
    <p className="text-small border-state-error rounded-md border-l-4 py-1 pl-3">
      {event.fault === 'protection'
        ? 'The OS gets a protection fault and usually ends the process. '
        : 'The OS gets a page fault: it may bring the page in from disk, evicting another to make room. '}
      <Link
        href="/replacement"
        prefetch={false}
        className="text-accent font-semibold underline underline-offset-2"
      >
        What happens next? → Page Replacement
      </Link>
    </p>
  );
}

export function TranslationView() {
  const share = useShareState(VM_SHARE_STATE);
  const { state, setState, ready } = share;
  const input = state.input as RunInput;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');

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

  const setRunInput = (next: VmInput) =>
    setState((s) => ({
      ...s,
      step: 0,
      input: { ...next, sizing: (s.input as RunInput).sizing },
    }));
  const setSizing = (sizing: SizingInput) =>
    setState((s) => ({ ...s, input: { ...(s.input as RunInput), sizing } }));

  const preset = VM_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET;
  const editorKey = `${loads}-${ready ? 1 : 0}`;

  const inputs = (
    <div className="flex flex-col gap-4">
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={presetId}
          options={VM_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          onChange={setPresetId}
        />
        <p className="text-caption text-fg-muted">{preset.summary}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setState((s) => ({
              ...s,
              step: 0,
              input: { ...preset.input, sizing: preset.sizing },
            }));
            setLoads((n) => n + 1);
            setStatus(`Loaded preset: ${preset.title}`);
          }}
        >
          Load preset
        </Button>
      </Panel>
      <VmEditor key={`editor-${editorKey}`} input={input} onChange={setRunInput} />
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
      <StepInspector
        heading={
          event
            ? `Access ${event.access + 1}, step ${event.step}: ${STEP_NAMES[event.step]}`
            : 'This step'
        }
        event={event}
      >
        {event?.kind === 'vm.fault' ? <FaultNext event={event} /> : null}
      </StepInspector>
      <RulesPanel rules={VM_RULES} />
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

  const pa = event?.pa;

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Address Translation"
        intro="Split a virtual address, look it up in the TLB, walk the page table and land on a physical frame, one step at a time."
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
              Content={TranslationLesson}
              store={store}
              unit="step"
              examples={LESSON_EXAMPLES}
              activeExample={activeExample(input)}
              onLoadExample={(id) => {
                const example = LESSON_EXAMPLES.find((e) => e.id === id)!;
                setState((s) => ({
                  ...s,
                  step: 0,
                  input: { ...example.input, sizing: example.sizing },
                }));
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
              question="Where in physical memory does this virtual address land, and what does it cost to find out?"
              className="border-border bg-surface-raised min-h-24 rounded-lg border p-4"
            />
          ) : null}

          <section aria-labelledby="counters-heading" className="flex flex-col gap-2">
            <h2 id="counters-heading" className="text-lead font-semibold">
              So far
            </h2>
            <p className="text-caption text-fg-muted">
              {inputSummary(input)}. Step {Math.min(position + 1, total)} of {total}.
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat id="tlb-hits" label="TLB hits" value={String(counters.hits)} />
              <Stat id="tlb-misses" label="TLB misses" value={String(counters.misses)} />
              <Stat id="hit-rate" label="TLB hit rate" value={hitRate(counters)} />
              <Stat
                id="mem-refs"
                label="Memory references"
                value={String(counters.memRefs)}
              />
              <Stat id="faults" label="Faults" value={String(counters.faults)} />
              <Stat
                id="accesses-done"
                label="Accesses done"
                value={`${counters.accesses} / ${input.accesses.length}`}
              />
            </dl>
          </section>

          <section aria-labelledby="address-heading" className="flex flex-col gap-3">
            <h2 id="address-heading" className="text-lead font-semibold">
              The address
            </h2>
            {event ? (
              <BitField
                label="Virtual address"
                value={event.va}
                fields={vaParts(g)}
                highlight={vaHighlight(event, g)}
              />
            ) : null}
            {pa !== undefined ? (
              <BitField
                label="Physical address"
                value={pa}
                fields={paParts(g)}
                highlight={event?.kind === 'vm.physical' ? 'pfn' : undefined}
              />
            ) : (
              <p className="text-small text-fg-muted">
                The physical address is formed at step 6, once the translation is known.
              </p>
            )}
          </section>

          <section aria-labelledby="tlb-heading" className="flex flex-col gap-2">
            <h2 id="tlb-heading" className="text-lead font-semibold">
              TLB
            </h2>
            <TlbView
              slots={snapshot?.tlb ?? []}
              policy={input.config.tlbPolicy}
              focus={tlbFocus(event)}
              action={tlbAction(event)}
              evicted={event?.evicted}
            />
          </section>

          <section aria-labelledby="pt-heading" className="flex flex-col gap-2">
            <h2 id="pt-heading" className="text-lead font-semibold">
              Page table in memory
            </h2>
            <PageTableView
              g={g}
              ptbr={input.config.ptbr}
              ptes={snapshot?.ptes ?? []}
              directory={snapshot?.directory ?? []}
              pteFocus={pteFocus(event)}
              pdeFocus={pdeFocus(event, g)}
              marked={event?.kind === 'vm.physical' ? event.vpn : null}
            />
          </section>

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

          <section aria-labelledby="sizing-heading" className="flex flex-col gap-2">
            <h2 id="sizing-heading" className="text-lead font-semibold">
              Why two levels? Page-table size
            </h2>
            <SizingPanel
              key={`sizing-${editorKey}`}
              sizing={input.sizing}
              onChange={setSizing}
              fromTable={fromTable}
            />
          </section>
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
