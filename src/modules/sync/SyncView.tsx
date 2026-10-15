'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Term } from '@/components/glossary';
import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { RulesPanel, ruleUsed, StepInspector } from '@/components/inspector';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useLessonAutoLoad } from '@/components/lesson/autoLoad';
import { LESSON_PRESET, presetSelect } from '@/components/lesson/presetOption';
import { useShareState } from '@/components/state/useShareState';
import { isTypingTarget } from '@/components/timeline/keymap';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
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
  lostUpdatesAt,
  picksUpTo,
  primaryEvent,
  ruleForEvent,
  runTicks,
  runVerdict,
  snapshotAt,
  TRY_NEXT,
  type HistogramRow,
} from './adapters';
import { Panel, SelectField } from './fields';
import { activeExample, LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { MemoryView } from './MemoryView';
import { OutcomeHistogram } from './OutcomeHistogram';
import { ScheduleBar } from './ScheduleBar';
import { MODULE_SHORTCUTS, threadForKey } from './shortcuts';
import { ThreadColumns } from './ThreadColumns';
import { useTickRun } from './useTickRun';

/** Guided mode's lesson: client-only, its own chunk, out of first-load JS. */
const GuidedLesson = dynamic(() => import('./GuidedLesson'), {
  ssr: false,
  loading: () => <p className="text-fg-muted text-small">Loading the lesson…</p>,
});

// `ostep.32.3` (deadlock bugs) is registered by the deadlock module.
const CITATIONS = createRegistry([
  syncCitations,
  deadlockCitations.filter((c) => c.id === 'ostep.32.3'),
]);

/**
 * Synchronisation: threads as lists of micro-ops, run one op per tick under a schedule
 * you pick by hand (keys A, B, C), round robin or a seeded random scheduler. The race,
 * the mutex and the semaphores are the core's; this view shows them, and the outcome of
 * every interleaving beside the one on screen.
 */
export function SyncView() {
  const share = useShareState(SYNC_SHARE_STATE);
  const { state, setState, ready } = share;
  const input = state.input as SyncInput;
  const { program, schedule } = input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [status, setStatus] = useState('');

  const run = useMemo(() => interleave(program, schedule), [program, schedule]);
  const exploration = useMemo(() => explore(program), [program]);
  const { store, tick, total, moment, phaseIndex } = useTickRun(run, share);

  // Where to put the playhead once the next run is in place (a pick, a loaded outcome),
  // and whether to play from there (a loaded outcome plays from the start, so the
  // schedule fills in tick by tick).
  const pendingSeek = useRef<number | null>(null);
  const pendingPlay = useRef(false);
  useEffect(() => {
    const target = pendingSeek.current;
    if (target === null) return;
    pendingSeek.current = null;
    store.getState().seek(Math.min(target, runTicks(run)) * TICK_MS);
    if (pendingPlay.current) {
      pendingPlay.current = false;
      store.getState().play();
    }
  }, [run, store]);

  const events = eventsAt(run, tick);
  const snapshot = snapshotAt(run, tick) ?? run.events[0]!.state;
  const lastState = run.events[run.events.length - 1]!.state;
  const lost = lostUpdatesAt(program, run, tick);
  const current = primaryEvent(events);
  // The rule behind this tick: the closing event's if it has one, else its op's.
  const ruleId = [...events].reverse().map(ruleForEvent).find(Boolean) ?? null;

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

  // Keys A, B, C pick a thread under a manual schedule (Y1, B6; listed in shortcuts.ts,
  // so the shortcuts sheet prints them and the keymap test checks they clash with no
  // playback or workspace key). The handler reads `pick` through a ref, so it always
  // picks from the state on screen.
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
      const t = threadForKey(event.key);
      if (t === null || t >= threadCount) return;
      event.preventDefault();
      pickRef.current(t);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manual, threadCount]);

  const loadOutcome = (row: HistogramRow) => {
    pendingPlay.current = true;
    setSchedule({ kind: 'manual', picks: row.example }, 0);
    setStatus(
      `Loaded an interleaving that ends ${row.label}. Playing it from the start.`,
    );
  };

  const exampleId = activeExample(input);
  const presets = presetSelect(
    SYNC_PRESETS.map((p) => ({ value: p.id, label: p.title })),
    presetId,
    exampleId,
    DEFAULT_PRESET.id,
  );
  const lessonExample = presets.lesson
    ? LESSON_EXAMPLES.find((e) => e.id === exampleId)
    : undefined;
  const preset = SYNC_PRESETS.find((p) => p.id === presets.value) ?? DEFAULT_PRESET;
  const lessonAuto = useLessonAutoLoad({
    ready,
    linked: share.linked,
    defaults: SYNC_SHARE_STATE.defaults,
    input: state.input,
  });
  const loadExample = (id: string) => {
    lessonAuto.lessonLoaded();
    const example = LESSON_EXAMPLES.find((e) => e.id === id)!;
    setPresetId(LESSON_PRESET);
    setInput(example.input);
    setStatus(`Loaded example: ${example.title}`);
  };

  const loadPreset = (id: string) => {
    const chosen = SYNC_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
    setPresetId(chosen.id);
    setInput({ preset: chosen.id, program: chosen.program, schedule: chosen.schedule });
    setStatus(`Loaded preset: ${chosen.title}`);
  };

  const contrast = TRY_NEXT[input.preset];
  const contrastPreset = contrast
    ? SYNC_PRESETS.find((p) => p.id === contrast.preset)
    : undefined;

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
            lessonExample ? loadExample(lessonExample.id) : loadPreset(preset.id)
          }
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
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector
        heading={`At tick ${tick}`}
        event={current}
        rule={ruleUsed(SYNC_RULES, ruleId)}
      >
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
      <RulesPanel rules={SYNC_RULES} currentRuleId={ruleId} />
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
  const ended = tick >= total || !lastState.result;

  const results = (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="result-heading" className="flex flex-col gap-2">
        <h2 id="result-heading" className="text-lead font-semibold">
          This run
        </h2>
        <p className="text-small" data-testid="run-verdict">
          {ended ? runVerdict(program, run) : 'Step to the end to see how this run ends.'}
        </p>
      </section>

      <section aria-labelledby="outcomes-heading" className="flex flex-col gap-2">
        <h2 id="outcomes-heading" className="text-lead font-semibold">
          Every interleaving
        </h2>
        <OutcomeHistogram exploration={exploration} onLoad={loadOutcome} />
      </section>
    </div>
  );

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="Synchronisation"
        moduleId="sync"
        intro={
          <>
            Run two or three <Term id="thread">threads</Term> one micro-op per{' '}
            <Term id="tick">tick</Term>, choose who goes next, and watch a{' '}
            <Term id="race-condition">race</Term> make an update get lost. Then fix it
            with a <Term id="mutex">mutex</Term>, and share a buffer with{' '}
            <Term id="semaphore">semaphores</Term>.
          </>
        }
        mode={mode}
        onModeChange={setMode}
        inputs={inputs}
        inspector={inspector}
        results={results}
        endOfRun={{
          result: runVerdict(program, run),
          ...(contrast && contrastPreset
            ? {
                tryNext: {
                  label: contrastPreset.title,
                  why: contrast.why,
                  onSelect: () => loadPreset(contrastPreset.id),
                },
              }
            : {}),
        }}
        share={{ link: share.link, shareable: share.shareable }}
        shortcuts={MODULE_SHORTCUTS}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="tick" />}
      >
        <div className="flex flex-col gap-6">
          {mode === 'walkthrough' ? (
            <GuidedLesson
              lesson={LESSON}
              store={store}
              unit="tick"
              examples={examples}
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
            <p role="status" className="text-caption text-fg-muted min-h-4">
              {status}
            </p>
          </section>

          <section aria-labelledby="memory-heading" className="flex flex-col gap-2">
            <h2 id="memory-heading" className="text-lead font-semibold">
              Shared memory at tick {tick}
            </h2>
            <MemoryView program={program} snapshot={snapshot} lost={lost} />
          </section>
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
