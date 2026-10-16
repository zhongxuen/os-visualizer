'use client';

import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { GanttChart, type GanttLane } from '@/components/blocks/GanttChart';
import {
  formatMetric,
  MetricsTable,
  type MetricsColumn,
} from '@/components/blocks/MetricsTable';
import { QueueView, type QueueItem } from '@/components/blocks/QueueView';
import { Term } from '@/components/glossary/Term';
import { CitationsProvider } from '@/components/inspector/CitationsContext';
import { RulesPanel } from '@/components/inspector/RulesPanel';
import { ruleUsed, StepInspector } from '@/components/inspector/StepInspector';
import { useLessonAutoLoad } from '@/components/lesson/autoLoad';
import { matchExample } from '@/components/lesson/examples';
import { LESSON_PRESET, presetSelect } from '@/components/lesson/presetOption';
import { Flash } from '@/components/motion/Flash';
import { DURATION } from '@/components/motion/tokens';
import { useStepTransition } from '@/components/motion/useStepTransition';
import { ModuleLayout, type ModuleMode } from '@/components/shell/ModuleLayout';
import { useProgress } from '@/components/state/useProgress';
import { useShareState } from '@/components/state/useShareState';
import { isTypingTarget } from '@/components/timeline/keymap';
import { PhaseStepper } from '@/components/timeline/PhaseStepper';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import { StepCaption } from '@/components/timeline/StepCaption';
import { Button } from '@/components/timeline/ui/Button';
import { createRegistry } from '@/core/citations/registry';
import { schedCitations } from '@/core/sched/citations';
import { metricsFrom } from '@/core/sched/metrics';
import { SCHED_PRESETS } from '@/core/sched/presets';
import { rulesFor } from '@/core/sched/rules';
import { schedule } from '@/core/sched/schedule';
import { SCHED_SHARE } from '@/core/sched/share';
import { pidNumber, policyName, type Policy, type Workload } from '@/core/sched/workload';
import { cn } from '@/lib/cn';

import {
  eventsAt,
  finalSegments,
  percent,
  primaryEvent,
  processRows,
  queueState,
  snapshotAt,
  toGanttSegments,
} from './adapters';
import {
  bracketsFor,
  preemptionMarks,
  quantumUse,
  resultSentence,
  ruleAt,
  tryNextFor,
  waitingReasons,
} from './explain';
import { Panel, SelectField } from './fields';
import { LESSON, LESSON_CHECKPOINTS, LESSON_EXAMPLES } from './lesson';
import { MetricDefinitions } from './MetricDefinitions';
import { isZoomKey, MODULE_SHORTCUTS } from './shortcuts';
import { useTickRun } from './useTickRun';

const CITATIONS = createRegistry([schedCitations]);
/** Guided mode's lesson: client-only, its own chunk, out of first-load JS. */
const GuidedLesson = dynamic(() => import('./GuidedLesson'), {
  ssr: false,
  loading: () => <p className="text-fg-muted text-small">Loading the lesson…</p>,
});
/** Sandbox's editors: their own chunk, loaded the first time the editor is opened. */
const SandboxEditor = dynamic(() => import('./SandboxEditor'), {
  ssr: false,
  loading: () => <p className="text-fg-muted text-small min-h-96">Loading the editor…</p>,
});
/** The saved list: its own chunk, loaded only when something is saved. */
const SavedWorkloads = dynamic(() => import('./SavedWorkloads'), { ssr: false });
const SAVE_KEY = 'sched';
/** S6: one tick at this many pixels when zoomed in. */
const ZOOM_PX = 16;

interface SavedRun {
  workload: Workload;
  policy: Policy;
}

/* --- Small parts ----------------------------------------------------------- */

/**
 * G14: which way is good, as an icon and words. `wrap` lets it break onto two lines in a
 * table header, so six columns fit the Watch column at 1366 px without scrolling.
 */
function Direction({
  better,
  wrap = false,
}: {
  better: 'lower' | 'higher';
  wrap?: boolean;
}) {
  const Icon = better === 'lower' ? ArrowDown : ArrowUp;
  return (
    <span
      className={cn(
        'text-caption text-fg-muted inline-flex items-center gap-0.5 font-normal',
        wrap ? 'text-right' : 'whitespace-nowrap',
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {better} is better
    </span>
  );
}

function Stat({
  id,
  label,
  value,
  better,
}: {
  id: string;
  label: ReactNode;
  value: string;
  better?: 'lower' | 'higher';
}) {
  return (
    <div className="border-border rounded-md border px-3 py-2">
      <dt className="text-caption text-fg-muted flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{label}</span>
        {better ? <Direction better={better} /> : null}
      </dt>
      <dd className="font-mono text-lg font-semibold">
        <Flash trigger={`${id}:${value}`}>
          <span data-testid={id}>{value}</span>
        </Flash>
      </dd>
    </div>
  );
}

/**
 * The per-process columns, each with its direction and definition (G14).
 *
 * In a narrow Watch column (under 32rem: the three-column desktop layout at 1024 px, or a
 * phone) the table drops Arrival and CPU, which are the workload's inputs and are in the
 * editor, tightens its cell padding, and lets the two longest headers break
 * ("Comple|tion", "Turn|around", at a `<wbr>`, so their names read the same). Every
 * metric keeps its column, its direction and its definition, and nothing scrolls
 * sideways (`NARROW_TABLE`).
 */
const PROCESS_COLUMNS: readonly MetricsColumn[] = [
  { id: 'arrival', label: 'Arrival', header: <Term id="arrival">Arrival</Term> },
  { id: 'cpu', label: 'CPU', header: <Term id="cpu-burst">CPU</Term> },
  {
    id: 'completion',
    label: 'Completion',
    header: (
      <>
        Comple
        <wbr />
        tion
      </>
    ),
  },
  {
    id: 'turnaround',
    label: 'Turnaround',
    header: (
      <span className="inline-flex flex-col items-end">
        <Term id="turnaround-time">
          Turn
          <wbr />
          around
        </Term>
        <Direction better="lower" wrap />
      </span>
    ),
  },
  {
    id: 'waiting',
    label: 'Waiting',
    header: (
      <span className="inline-flex flex-col items-end">
        <Term id="waiting-time">Waiting</Term>
        <Direction better="lower" wrap />
      </span>
    ),
  },
  {
    id: 'response',
    label: 'Response',
    header: (
      <span className="inline-flex flex-col items-end">
        <Term id="response-time">Response</Term>
        <Direction better="lower" wrap />
      </span>
    ),
  },
];

/** Columns 2 and 3 of every row are Arrival and CPU (column 1 is the process). */
const NARROW_TABLE =
  '@max-[32rem]:[&_tr>:nth-child(2)]:hidden @max-[32rem]:[&_tr>:nth-child(3)]:hidden @max-[32rem]:[&_td]:px-1 @max-[32rem]:[&_th]:px-1';

/** RR and MLFQ: how much of the running process's quantum is gone, as a draining ring. */
function QuantumRing({ used, quantum }: { used: number; quantum: number }) {
  const { scale } = useStepTransition();
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const left = Math.max(0, quantum - used) / quantum;
  return (
    <span className="text-caption text-fg-secondary inline-flex items-center gap-1 font-mono">
      <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
        <circle cx={9} cy={9} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        <circle
          cx={9}
          cy={9}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeDasharray={`${circumference * left} ${circumference}`}
          transform="rotate(-90 9 9)"
          style={{
            transition: `stroke-dasharray ${scale(DURATION.move)}ms var(--ease-out)`,
          }}
        />
      </svg>
      <span aria-hidden="true">
        {used}/{quantum}
      </span>
      <span className="sr-only">
        {used} of {quantum} ticks of its quantum used
      </span>
    </span>
  );
}

/** S7: MLFQ lanes say their quantum and allotment. */
function schedLanes(policy: Policy): GanttLane[] | undefined {
  if (policy.kind !== 'mlfq') return undefined;
  return policy.levels.map((level, i) => ({
    id: i,
    label: `Q${i} q=${level.quantum} a=${level.allotment}`,
  }));
}

function laneLabel(policy: Policy, level: number): string {
  if (policy.kind !== 'mlfq') return 'Ready queue';
  const l = policy.levels[level];
  return `Q${level}${level === 0 ? ' (top)' : ''}: quantum ${l?.quantum}, allotment ${l?.allotment}`;
}

/** S7: which of OSTEP's rules 1-5 a MLFQ setup shows, by name. */
export function mlfqRulesNote(policy: Policy): string | null {
  if (policy.kind !== 'mlfq') return null;
  const parts = [
    'Rules 1–2: a higher queue runs first; one queue takes turns (round robin)',
    'rule 3: new jobs start in Q0',
    policy.rule4 === 'original'
      ? 'rule 4a/4b (old): only a whole quantum used moves a job down'
      : 'rule 4: using its allotment moves a job down, I/O or not',
  ];
  parts.push(
    policy.boostEvery
      ? `rule 5: every ${policy.boostEvery} ticks, every job is boosted to Q0`
      : 'no rule 5 boost',
  );
  return `${parts.join('; ')}.`;
}

function Legend({ marks, mlfq }: { marks: boolean; mlfq: boolean }) {
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
          <strong>CS</strong>: a <Term id="context-switch">context switch</Term>. These
          ticks are neither busy nor idle: no process makes progress, and utilisation does
          not count them.
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
      {marks ? (
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="w-6 shrink-0 text-center">
            ▼
          </span>
          <span>A process lost the CPU here (preempted, or its quantum ran out).</span>
        </li>
      ) : null}
      {mlfq ? (
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="w-6 shrink-0" />
          <span>One lane per queue: q = quantum, a = allotment, in ticks.</span>
        </li>
      ) : null}
      <li className="flex items-start gap-2">
        <span aria-hidden="true" className="w-6 shrink-0" />
        <span>
          Hover or focus a row of the per-process table to see its response, turnaround
          and waiting (shaded) on the chart.
        </span>
      </li>
    </ul>
  );
}

/* --- The view -------------------------------------------------------------- */

export function SchedulingView() {
  const share = useShareState(SCHED_SHARE);
  const { state, setState, ready } = share;
  const { workload, policy } = state.input;
  const [mode, setMode] = useState<ModuleMode>('walkthrough');
  const [presetId, setPresetId] = useState(SCHED_PRESETS[1]!.id);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState('');
  // The editor is open from the start in Sandbox and folded in Guided, where the lesson
  // chooses the input; once toggled, it stays as the learner left it.
  const [editingChoice, setEditing] = useState<boolean | null>(null);
  const editing = editingChoice ?? mode === 'free';
  const [zoom, setZoom] = useState<'fit' | 'tick'>('fit');
  const [hoverPid, setHoverPid] = useState<string | null>(null);
  const [bracketPid, setBracketPid] = useState<string | null>(null);
  const progress = useProgress();

  const run = useMemo(() => schedule(workload, policy), [workload, policy]);
  const { store, tick, total, moment, phaseIndex } = useTickRun(run, share);

  const final = useMemo(() => finalSegments(run), [run]);
  const segments = useMemo(() => toGanttSegments(final), [final]);
  const marks = useMemo(
    () => preemptionMarks(run, policy.kind === 'mlfq'),
    [run, policy],
  );
  const lanes = schedLanes(policy);
  const events = eventsAt(run, tick);
  const snapshot = snapshotAt(run, tick);
  const queues = queueState(snapshot, policy, workload);
  const metrics = metricsFrom(
    workload,
    (snapshot?.segments ?? [])
      .filter((s) => s.start < tick)
      .map((s) => ({ ...s, end: Math.min(s.end, tick) })),
    snapshot?.done ?? [],
    tick,
  );
  const finished = metrics.processes.filter((p) => p.completion !== null).length;
  const limited = run.events.some((e) => e.kind === 'sched.limit');
  const name = policyName(policy);
  const rules = rulesFor(policy.kind);
  const ruleId = ruleAt(run, tick, policy);
  const waiting = waitingReasons(run, tick, policy, workload);
  const quantum = quantumUse(run, tick, policy, snapshot);
  const brackets = bracketPid ? bracketsFor(workload, final, bracketPid) : null;
  const highlight = hoverPid ?? bracketPid;
  const highlightNumber = highlight ? pidNumber(highlight) : null;
  const onPidHover = (pid: number | null) => setHoverPid(pid === null ? null : `P${pid}`);
  const rulesNote = mlfqRulesNote(policy);

  // Z: toggle the Gantt zoom.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target) || !isZoomKey(event)) {
        return;
      }
      event.preventDefault();
      setZoom((z) => (z === 'fit' ? 'tick' : 'fit'));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // The queue chips, with the quantum ring on the running one and aging as a ticker.
  const withExtras = (item: QueueItem): QueueItem => {
    const pid = `P${item.pid}`;
    const out: QueueItem = { ...item };
    const priority = snapshot?.priorities?.[pid];
    if (priority !== undefined) {
      delete out.detail;
      out.extra = (
        <span className="text-small text-fg-secondary">
          priority <Flash trigger={`${pid}:${priority}`}>{priority}</Flash>
        </span>
      );
    }
    if (quantum && quantum.pid === pid && queues.running?.pid === item.pid) {
      out.extra = (
        <>
          {out.extra}
          <QuantumRing used={quantum.used} quantum={quantum.quantum} />
        </>
      );
    }
    return out;
  };
  const running =
    queues.running && snapshot?.running ? withExtras(queues.running) : queues.running;
  const done = (snapshot?.done ?? []).map((pid) => ({ pid: pidNumber(pid) }));

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

  const saved = progress.savedFor(SAVE_KEY);

  const presets = presetSelect(
    SCHED_PRESETS.map((p) => ({ value: p.id, label: p.title })),
    presetId,
    activeExample,
    SCHED_PRESETS[1]!.id,
  );
  const preset = presets.lesson
    ? undefined
    : SCHED_PRESETS.find((p) => p.id === presets.value);
  const presetNote = preset ? mlfqRulesNote(preset.policy) : null;
  const lessonExample = presets.lesson
    ? LESSON_EXAMPLES.find((e) => e.id === activeExample)
    : undefined;
  const lessonAuto = useLessonAutoLoad({
    ready,
    linked: share.linked,
    defaults: SCHED_SHARE.defaults,
    input: state.input,
    saved: saved.length,
  });
  const loadExample = (id: string) => {
    lessonAuto.lessonLoaded();
    const example = LESSON_EXAMPLES.find((e) => e.id === id)!;
    setPresetId(LESSON_PRESET);
    load(example.input, `Loaded example: ${example.title}`);
  };
  const next = tryNextFor(policy);

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
          {lessonExample ? `From the lesson: ${lessonExample.title}.` : preset?.summary}
        </p>
        {presetNote ? (
          <p className="text-caption text-fg-secondary">
            <Term id="mlfq">MLFQ</Term> rules on show. {presetNote}
          </p>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (lessonExample) return loadExample(lessonExample.id);
            const chosen = preset!;
            load(
              { workload: chosen.workload, policy: chosen.policy },
              `Loaded preset: ${chosen.title}`,
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
        aria-controls="sched-editor"
        onClick={() => setEditing(!editing)}
        className="border-border bg-surface-raised text-small hover:bg-surface-overlay focus-visible:outline-focus flex items-center justify-between rounded-lg border px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Edit the policy and workload
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', editing && 'rotate-180')}
        />
      </button>

      <div id="sched-editor" hidden={!editing} className="flex flex-col gap-4">
        {editing ? (
          <SandboxEditor
            workload={workload}
            policy={policy}
            editorKey={`${loads}-${ready ? 1 : 0}`}
            highlightPid={highlight}
            onPidHover={setHoverPid}
            onChange={setInput}
          />
        ) : null}
      </div>

      <Panel title="Save in this browser">
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
        </div>
        {saved.length > 0 ? (
          <SavedWorkloads
            entries={saved}
            onLoad={(value, n) => load(value, `Loaded saved workload ${n}.`)}
            onDelete={(index) => progress.removeSaved(SAVE_KEY, index)}
          />
        ) : null}
      </Panel>
    </div>
  );

  const inspector = (
    <div className="flex flex-col gap-4">
      <StepInspector
        heading={`At t = ${tick}`}
        event={primaryEvent(events)}
        rule={ruleUsed(rules, ruleId)}
      >
        {waiting.length > 0 ? (
          <div data-testid="waiting-reasons">
            <p className="text-fg-muted text-caption font-semibold tracking-wide uppercase">
              Waiting
            </p>
            <ul className="text-small text-fg-secondary flex flex-col gap-1">
              {waiting.map((w) => (
                <li key={w.pid}>{w.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
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
      <RulesPanel rules={rules} currentRuleId={ruleId} />
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

  const results = (
    <section aria-labelledby="metrics-heading" className="flex flex-col gap-3">
      <h2 id="metrics-heading" className="text-lead font-semibold">
        Metrics at t = {tick}
      </h2>
      <p className="text-caption text-fg-muted">
        {finished} of {workload.processes.length} processes finished. Averages are over
        finished processes.
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          id="avg-waiting"
          label={
            <>
              Average <Term id="waiting-time">waiting</Term>
            </>
          }
          value={formatMetric(metrics.avgWaiting)}
          better="lower"
        />
        <Stat
          id="avg-turnaround"
          label="Average turnaround"
          value={formatMetric(metrics.avgTurnaround)}
          better="lower"
        />
        <Stat
          id="avg-response"
          label="Average response"
          value={formatMetric(metrics.avgResponse)}
          better="lower"
        />
        <Stat
          id="utilisation"
          label={
            <>
              CPU <Term id="utilisation">utilisation</Term>
            </>
          }
          value={percent(metrics.utilisation)}
          better="higher"
        />
        <Stat
          id="throughput"
          label={
            <>
              <Term id="throughput">Throughput</Term> (per tick)
            </>
          }
          value={formatMetric(metrics.throughput)}
          better="higher"
        />
        <Stat
          id="cs-count"
          label="Context switches"
          value={String(metrics.contextSwitches)}
          better="lower"
        />
      </dl>
      <div className="@container overflow-x-auto">
        <p className="text-caption text-fg-muted mb-1 hidden @max-[32rem]:block">
          Arrival and CPU are in the workload editor; this table shows the results.
        </p>
        <MetricsTable
          className={NARROW_TABLE}
          caption={`Per process at t = ${tick} (— = not yet). Hover or focus a row to draw it on the Gantt chart.`}
          columns={PROCESS_COLUMNS}
          rows={processRows(metrics)}
          average="Average"
          highlightRow={highlight}
          onRowHover={(id) => {
            setBracketPid(id);
            setHoverPid(id);
          }}
          animate
        />
      </div>
      <MetricDefinitions />
    </section>
  );

  return (
    <CitationsProvider citations={CITATIONS}>
      <ModuleLayout
        title="CPU Scheduling"
        intro={
          <>
            Build a set of <Term id="process">processes</Term>, pick a policy, and watch
            the Gantt chart form one <Term id="tick">tick</Term> at a time, with the
            reason for every decision.
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
          result: resultSentence(policy, metrics, final),
          tryNext: {
            label: next.label,
            why: next.why,
            onSelect: () =>
              load({ workload, policy: next.policy }, `Loaded: ${next.label}`),
          },
        }}
        timeline={<PlaybackBar store={store} phases={run.phases} unit="tick" />}
      >
        <div className="flex flex-col gap-6">
          {mode === 'walkthrough' ? (
            <GuidedLesson
              lesson={LESSON}
              store={store}
              unit="tick"
              examples={LESSON_EXAMPLES}
              activeExample={activeExample}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="gantt-heading" className="text-lead font-semibold">
                {name}
              </h2>
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={zoom === 'tick'}
                aria-keyshortcuts="Z"
                data-zoom-toggle=""
                onClick={() => setZoom((z) => (z === 'fit' ? 'tick' : 'fit'))}
              >
                Zoom in: 1 tick = {ZOOM_PX} px
              </Button>
            </div>
            {rulesNote ? (
              <p className="text-caption text-fg-secondary">{rulesNote}</p>
            ) : null}
            <GanttChart
              segments={segments}
              tick={tick}
              endTick={total}
              lanes={lanes}
              title={`Gantt chart, ${name}`}
              zoom={zoom === 'fit' ? 'fit' : ZOOM_PX}
              followCursor
              highlightPid={highlightNumber}
              onPidHover={onPidHover}
              brackets={brackets}
              marks={marks}
              animate
            />
            <Legend marks={marks.length > 0} mlfq={policy.kind === 'mlfq'} />
          </section>

          <section aria-labelledby="queues-heading" className="flex flex-col gap-2">
            <h2 id="queues-heading" className="text-lead font-semibold">
              Queues at t = {tick}
            </h2>
            <p className="text-caption text-fg-muted">
              Processes wait in the <Term id="ready-queue">ready queue</Term>, head first.
            </p>
            <QueueView
              running={running}
              queues={queues.queues.map((q, level) => ({
                ...q,
                label: laneLabel(policy, level),
                items: q.items.map(withExtras),
              }))}
              waiting={queues.waiting}
              done={done}
              highlightPid={highlightNumber}
              onPidHover={onPidHover}
              animate
            />
          </section>
        </div>
      </ModuleLayout>
    </CitationsProvider>
  );
}
