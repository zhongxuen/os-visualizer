'use client';

import { useId, useMemo, useState } from 'react';

import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { ProcessChip } from '@/components/shell/ProcessChip';
import { PROCESS_PALETTE, processPatternId } from '@/components/shell/processPalette';
import { ProcessPatternDefs } from '@/components/shell/ProcessPatternDefs';
import { usePlayback, usePlaybackState } from '@/components/timeline/hooks/usePlayback';
import { usePlaybackKeys } from '@/components/timeline/hooks/usePlaybackKeys';
import { PlaybackBar, phaseIndexAt } from '@/components/timeline/PlaybackBar';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { stageMoment, StepCaption } from '@/components/timeline/StepCaption';
import { formatTimecode, unitIndex } from '@/components/timeline/time';
import { UNIT_MS, type RunUnit } from '@/core/events/builder';
import { cn } from '@/lib/cn';

import { buildFakeRun, DEMO_PROCESSES } from './fakeRun';

function UnitPicker({
  unit,
  onChange,
}: {
  unit: RunUnit;
  onChange: (u: RunUnit) => void;
}) {
  const name = useId();
  return (
    <fieldset className="border-border bg-surface-raised rounded-lg border p-4">
      <legend className="text-small px-1 font-semibold">Fake run</legend>
      <p className="text-fg-muted text-small">
        FCFS over three processes, written by hand. Choose how the timeline reads it.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {(['tick', 'step'] as const).map((value) => (
          <label key={value} className="text-small inline-flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={value}
              checked={unit === value}
              onChange={() => onChange(value)}
              className="accent-accent size-4"
            />
            {value === 'tick' ? 'Ticks (t = 7)' : 'Steps (step 7 / 9)'}
          </label>
        ))}
      </div>
      <table className="text-small mt-4 w-full text-left">
        <caption className="sr-only">Processes in the fake run</caption>
        <thead className="text-fg-muted">
          <tr>
            <th scope="col" className="font-medium">
              Process
            </th>
            <th scope="col" className="font-medium">
              Arrival
            </th>
            <th scope="col" className="font-medium">
              Burst
            </th>
          </tr>
        </thead>
        <tbody>
          {DEMO_PROCESSES.map((p) => (
            <tr key={p.pid}>
              <td className="py-1">
                <ProcessChip pid={p.pid} />
              </td>
              <td className="font-mono">{p.arrival}</td>
              <td className="font-mono">{p.burst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </fieldset>
  );
}

function Palette() {
  return (
    <section aria-labelledby="palette-heading" className="mt-8">
      <h2 id="palette-heading" className="text-lead font-semibold">
        Process palette
      </h2>
      <p className="text-fg-muted text-small mt-1">
        Ten slots (PID mod 10). Each has a colour, a pattern and the PID as text, so none
        of the three has to carry it alone.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PROCESS_PALETTE.map((slot) => (
          <li key={slot.slot} className="flex flex-col items-start gap-1">
            <ProcessChip pid={slot.slot} />
            <span className="text-fg-muted text-caption">
              {slot.colour}, {slot.pattern}
            </span>
          </li>
        ))}
      </ul>
      <svg
        role="img"
        aria-label="The ten process patterns as chart bars, P0 to P9"
        viewBox="0 0 400 40"
        className="mt-4 h-10 w-full max-w-xl"
      >
        <ProcessPatternDefs />
        {PROCESS_PALETTE.map((slot) => (
          <rect
            key={slot.slot}
            x={slot.slot * 40 + 2}
            y={4}
            width={36}
            height={32}
            rx={3}
            fill={`url(#${processPatternId(slot.slot)})`}
            stroke="var(--proc-ink)"
          />
        ))}
      </svg>
    </section>
  );
}

export function DemoClient() {
  const [unit, setUnit] = useState<RunUnit>('tick');
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const run = useMemo(() => buildFakeRun(unit), [unit]);
  const store = usePlayback({ result: run });
  usePlaybackKeys(store);

  // Discrete selections only: these change once per tick, not once per frame.
  const index = usePlaybackState(store, (s) => unitIndex(s.virtualTime, unit));
  const moment = usePlaybackState(store, (s) => stageMoment(s.status, s.virtualTime));
  const phaseIndex = usePlaybackState(store, (s) =>
    phaseIndexAt(run.phases, s.virtualTime),
  );

  const count = run.events.length;
  const current = run.events[Math.min(index, count - 1)];
  const reached = moment === 'done' ? count - 1 : Math.min(index, count - 1);

  return (
    <ModuleLayout
      title="Component demo"
      intro="The shell and the timeline, driven by a fake run. Everything here works from the keyboard."
      mode={mode}
      onModeChange={setMode}
      inputs={<UnitPicker unit={unit} onChange={setUnit} />}
      inspector={
        <div className="flex flex-col gap-4">
          <div className="border-border bg-surface-raised rounded-lg border p-4">
            <h2 className="text-small text-fg-muted font-semibold">This {unit}</h2>
            <p className="text-fg mt-1">{current?.label}</p>
            <p className="text-fg-muted text-caption mt-2 font-mono">
              {formatTimecode(index * UNIT_MS[unit], run.durationMs, unit)}
            </p>
          </div>
          <div>
            <h2 className="text-small text-fg-muted mb-2 font-semibold">Phases</h2>
            <PhaseStepper
              phases={run.phases}
              currentIndex={phaseIndex}
              onSeek={(time) => store.getState().seek(time)}
              unit={unit}
            />
          </div>
        </div>
      }
      timeline={<PlaybackBar store={store} phases={run.phases} unit={unit} />}
    >
      <p className="text-fg-muted text-small mb-3">
        Mode: {mode === 'walkthrough' ? 'Walkthrough' : 'Free play'} (the switch is wired;
        modules decide what it changes).
      </p>
      <StepCaption
        phases={run.phases}
        currentIndex={phaseIndex}
        moment={moment}
        question="Three processes arrive one tick apart. Who runs first under FCFS?"
        className="border-border bg-surface-raised min-h-28 rounded-lg border p-4"
      />

      <ol
        aria-label={`CPU by ${unit}`}
        className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2"
      >
        {run.events.map((event, i) => {
          const done = i <= reached;
          return (
            <li
              key={event.id}
              aria-current={i === reached && moment !== 'done' ? 'step' : undefined}
              className={cn(
                'border-border flex flex-col items-center gap-1 rounded-md border p-2',
                i === reached && moment !== 'done' && 'border-accent border-2',
                !done && 'state-dim',
              )}
            >
              <span className="text-caption text-fg-muted font-mono">
                {unit === 'tick' ? `t = ${i}` : `step ${i + 1}`}
              </span>
              {done && event.pid !== null ? (
                <ProcessChip pid={event.pid} />
              ) : (
                <span className="text-small">not yet</span>
              )}
            </li>
          );
        })}
      </ol>

      <Palette />
    </ModuleLayout>
  );
}
