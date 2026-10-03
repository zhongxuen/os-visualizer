/**
 * A fake run for /demo: three processes under FCFS, written by hand with the real run
 * builder. Not the scheduling core (phase 04); it only has to look like a run so the
 * shell and timeline can be exercised. The same events can be laid out as ticks or as
 * steps, to show both timecodes.
 */

import { createRun, type RunUnit } from '@/core/events/builder';
import type { EventBase } from '@/core/events/types';
import type { SimResult } from '@/core/sim/result';

export type DemoEvent = EventBase & {
  kind: 'demo.tick';
  /** Who held the CPU during this tick; `null` is idle. */
  pid: number | null;
  /** Remaining burst per PID after this tick. */
  remaining: Record<string, number>;
};

export interface DemoProcess {
  pid: number;
  arrival: number;
  burst: number;
}

export const DEMO_PROCESSES: readonly DemoProcess[] = [
  { pid: 1, arrival: 0, burst: 3 },
  { pid: 2, arrival: 1, burst: 2 },
  { pid: 3, arrival: 2, burst: 4 },
];

export function buildFakeRun(unit: RunUnit): SimResult<DemoEvent> {
  const run = createRun<DemoEvent>({ unit });
  const remaining: Record<string, number> = Object.fromEntries(
    DEMO_PROCESSES.map((p) => [String(p.pid), p.burst]),
  );

  let tick = 0;
  for (const p of DEMO_PROCESSES) {
    run.phase(
      `p${p.pid}`,
      `P${p.pid} runs`,
      p.pid === 1
        ? `P${p.pid} arrived first, so FCFS gives it the CPU until its burst of ${p.burst} is done.`
        : `P${p.pid} is next in arrival order, so it runs for its whole burst of ${p.burst}.`,
    );
    for (let i = 0; i < p.burst; i += 1) {
      remaining[String(p.pid)] -= 1;
      const left = remaining[String(p.pid)]!;
      run.emit({
        kind: 'demo.tick',
        id: `demo.p${p.pid}.${tick}`,
        label:
          left === 0
            ? `P${p.pid} runs its last tick and finishes at t = ${tick + 1}.`
            : `P${p.pid} runs: first come, first served (${left} left).`,
        citation: 'ostep.4',
        pid: p.pid,
        remaining: { ...remaining },
      });
      run.advance();
      tick += 1;
    }
  }
  return run.finish();
}
