'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { StepInspector } from '@/components/inspector/StepInspector';
import { Walkthrough } from '@/components/lesson/Walkthrough';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useShareState } from '@/components/state/useShareState';
import { isTypingTarget } from '@/components/timeline/keymap';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
import SyncLesson from '@/content/lessons/sync.mdx';
import { createRegistry } from '@/core/citations/registry';
import { deadlockCitations } from '@/core/deadlock/citations';
import { TICK_MS } from '@/core/events/builder';
import { syncCitations } from '@/core/sync/citations';
import { explore } from '@/core/sync/explore';
import { interleave } from '@/core/sync/interleave';
import { DEFAULT_PRESET, SYNC_PRESETS } from '@/core/sync/presets';
import { describeSchedule, threadName, type Schedule } from '@/core/sync/program';
import { SYNC_RULES } from '@/core/sync/rules';
import { SYNC_SHARE_STATE, type SyncInput } from '@/core/sync/state';

import {
  eventsAt,
  picksUpTo,
  primaryEvent,
  runTicks,
  runVerdict,
  snapshotAt,
  type HistogramRow,
} from './adapters';
import { Panel, SelectField } from './fields';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { MemoryView } from './MemoryView';
import { OutcomeHistogram } from './OutcomeHistogram';
import { ScheduleBar } from './ScheduleBar';
import { ThreadColumns } from './ThreadColumns';
import { useTickRun } from './useTickRun';

// `ostep.32.3` (deadlock bugs) is registered by the deadlock module.
const CITATIONS = createRegistry([
  syncCitations,
  deadlockCitations.filter((c) => c.id === 'ostep.32.3'),
]);

/**
 * Synchronisation: threads as lists of micro-ops, run one op per tick under a schedule
 * you pick by hand (keys 1, 2, 3), round robin or a seeded random scheduler. The race,
 * the mutex and the semaphores are the core's; this view shows them, and the outcome of
 * every interleaving beside the one on screen.
 */
export function SyncView() {
  const share = useShareState(SYNC_SHARE_STATE);
  const { state, setState } = share;
  const input = state.input as SyncInput;
  const { program, schedule } = input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [status, setStatus] = useState('');

  const run = useMemo(() => interleave(program, schedule), [program, schedule]);
  const exploration = useMemo(() => explore(program), [program]);
  const { store, tick, total, moment, phaseIndex } = useTickRun(run, share);

  // Where to put the playhead once the next run is in place (a pick, a loaded outcome).
  const pendingSeek = useRef<number | null>(null);
  useEffect(() => {
    const target = pendingSeek.current;
    if (target === null) return;
    pendingSeek.current = null;
    store.getState().seek(Math.min(target, runTicks(run)) * TICK_MS);
  }, [run, store]);

  const events = eventsAt(run, tick);
  const snapshot = snapshotAt(run, tick) ?? run.events[0]!.state;
  const lastState = run.events[run.events.length - 1]!.state;

  const setInput = useCallback(
    (next: SyncInput, seek: number | null = null) => {
      pendingSeek.current = seek;
      setState((s) => ({ ...s, step: 0, input: next }));
    },
    [setState],
  );
  const setSchedule = (next: Schedule, seek: number | null = null) =>
    setInput({ ...input, schedule: next }, seek);

  const takeOver = () => {
    const picks = picksUpTo(run, tick);
    setSchedule({ kind: 'manual', picks }, picks.length);
    setStatus(`Picking by hand from tick ${picks.length}.`);
  };

  const pick = (t: number) => {
    const name = threadName(t);
    if (!snapshot.next.includes(t)) {
      setStatus(
        snapshot.result
          ? 'The run has ended.'
          : `${name} can’t run now: ${snapshot.status[t] === 'done' ? 'it has finished' : `it waits for ${snapshot.waitingOn[t]}`}.`,
      );
      return;
    }
    const base =
      schedule.kind === 'manual' ? schedule.picks.slice(0, tick) : picksUpTo(run, tick);
    const picks = [...base, t];
    setSchedule({ kind: 'manual', picks }, picks.length);
    setStatus(`Picked ${name}.`);
  };

  // Keys 1, 2, 3 pick a thread under a manual schedule. They are the speed keys
  // everywhere else, so the capture phase claims them first and marks them handled.
  // The handler reads `pick` through a ref, so it always picks from the state on screen.
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });
  const manual = schedule.kind === 'manual';
  const threadCount = program.threads.length;
  useEffect(() => {
    if (!manual) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented)
        return;
      if (isTypingTarget(event.target)) return;
      const t = Number(event.key) - 1;
      if (!Number.isInteger(t) || t < 0 || t >= threadCount) return;
      event.preventDefault();
      pickRef.current(t);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [manual, threadCount]);

  const loadOutcome = (row: HistogramRow) => {
    setSchedule({ kind: 'manual', picks: row.example }, row.example.length);
    setStatus(`Loaded an interleaving that ends ${row.label}.`);
  };

  const preset = SYNC_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET;

  const inputs = (
    <div className="flex flex-col gap-4">
      <Panel title="Presets">
        <SelectField
          label="Preset"
          value={presetId}
          options={SYNC_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          onChange={setPresetId}
        />
        <p className="text-caption text-fg-muted">{preset.summary}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setInput({
              preset: preset.id,
              program: preset.program,
              schedule: preset.schedule,
            });
            setStatus(`Loaded preset: ${preset.title}`);
          }}
        >
          Load preset
        </Button>
      </Panel>
      <Panel title="Schedule">
        <ScheduleBar
          schedule={schedule}
          threads={program.threads.length}
          trace={snapshot.trace}
          onChange={(next) => setSchedule(next)}
          onTakeOver={takeOver}
        />
      </Panel>
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
      <StepInspector heading={`At tick ${tick}`} event={primaryEvent(events)}>
        {events.length > 1 ? (
          <ol
            aria-label={`Everything at tick ${tick}`}
            className="text-small text-fg-secondary flex list-decimal flex-col gap-1 pl-5"
          >
            {events.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ol>
        ) : null}
      </StepInspector>
      <RulesPanel rules={SYNC_RULES} />
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

  const examples = LESSON_EXAMPLES;

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Synchronisation"
        intro="Run two or three threads one micro-op at a time, choose who goes next, and watch an update get lost. Then fix it with a mutex, and share a buffer with semaphores."
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
              Content={SyncLesson}
              store={store}
              unit="tick"
              examples={examples}
              activeExample={activeExample(input)}
              onLoadExample={(id) => {
                const example = examples.find((e) => e.id === id)!;
                setInput(example.input);
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
              question="Which thread runs next, and what does its op do to shared memory?"
              className="border-border bg-surface-raised min-h-24 rounded-lg border p-4"
            />
          ) : null}

          <section aria-labelledby="threads-heading" className="flex flex-col gap-2">
            <h2 id="threads-heading" className="text-lead font-semibold">
              Threads at tick {tick}
            </h2>
            <p className="text-caption text-fg-muted">
              {describeSchedule(schedule)}. Tick {tick} of {total}.
            </p>
            <ThreadColumns
              program={program}
              snapshot={snapshot}
              onPick={manual ? pick : undefined}
            />
          </section>

          <section aria-labelledby="memory-heading" className="flex flex-col gap-2">
            <h2 id="memory-heading" className="text-lead font-semibold">
              Shared memory at tick {tick}
            </h2>
            <MemoryView program={program} snapshot={snapshot} />
          </section>

          <section aria-labelledby="result-heading" className="flex flex-col gap-2">
            <h2 id="result-heading" className="text-lead font-semibold">
              This run
            </h2>
            <p className="text-small" data-testid="run-verdict">
              {tick >= total || !lastState.result
                ? runVerdict(program, run)
                : 'Step to the end to see how this run ends.'}
            </p>
          </section>

          <section aria-labelledby="outcomes-heading" className="flex flex-col gap-2">
            <h2 id="outcomes-heading" className="text-lead font-semibold">
              Every interleaving
            </h2>
            <OutcomeHistogram exploration={exploration} onLoad={loadOutcome} />
          </section>
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
