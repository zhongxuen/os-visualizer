import {
  pidNumber,
  runMetrics,
  schedule,
  type Policy,
  type SchedEvent,
  type Workload,
} from '@/core/sched';

/**
 * The run behind the home page's miniature Gantt chart (docs/UIUX.md §7.1): Round Robin,
 * q = 2, on three processes, computed by the same `schedule()` the /scheduling module
 * uses. The page is a Server Component, so this runs at build time and ships as markup.
 */

export const HERO_WORKLOAD: Workload = {
  processes: [
    { pid: 'P1', arrival: 0, bursts: [5], priority: 0 },
    { pid: 'P2', arrival: 1, bursts: [3], priority: 0 },
    { pid: 'P3', arrival: 2, bursts: [4], priority: 0 },
  ],
  contextSwitch: 0,
};

export const HERO_POLICY: Policy = { kind: 'rr', quantum: 2 };

/** One stretch of the chart and the sentence shown while it draws. */
export interface HeroSegment {
  pid: string;
  /** Palette slot: the PID's number. */
  slot: number;
  start: number;
  /** Exclusive. */
  end: number;
  caption: string;
}

export interface HeroRun {
  segments: HeroSegment[];
  /** Ticks in the whole run: the chart's width. */
  ticks: number;
  /** Shown once the chart is complete, and on the resting frame. */
  doneCaption: string;
}

/** Why the CPU changed hands at `tick`: the event that ended the previous stretch. */
function handover(events: readonly SchedEvent[], tick: number): string | null {
  const ended = events.find(
    (e) =>
      e.tick === tick && (e.kind === 'sched.quantumExpired' || e.kind === 'sched.finish'),
  );
  if (!ended?.pid) return null;
  return ended.kind === 'sched.finish'
    ? `${ended.pid} finished`
    : `quantum expired for ${ended.pid}`;
}

/** "P2 runs: quantum expired for P1", or the dispatch's own reason when nothing ended. */
function captionFor(events: readonly SchedEvent[], pid: string, start: number): string {
  const reason = handover(events, start);
  if (reason) return `${pid} runs: ${reason}`;
  const dispatch = events.find(
    (e) => e.kind === 'sched.dispatch' && e.tick === start && e.pid === pid,
  );
  return dispatch?.label ?? `${pid} runs`;
}

function formatTicks(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function heroRun(): HeroRun {
  const run = schedule(HERO_WORKLOAD, HERO_POLICY);
  const last = run.events[run.events.length - 1];
  const raw = last?.state.segments ?? [];
  const ticks = raw.reduce((max, s) => Math.max(max, s.end), 0);

  const segments = raw.map((s) => ({
    pid: s.pid,
    slot: pidNumber(s.pid),
    start: s.start,
    end: s.end,
    caption: captionFor(run.events, s.pid, s.start),
  }));

  const metrics = runMetrics(HERO_WORKLOAD, run);
  const doneCaption = `All three done at t = ${ticks}; average wait ${formatTicks(metrics.avgWaiting)} ticks`;

  return { segments, ticks, doneCaption };
}
