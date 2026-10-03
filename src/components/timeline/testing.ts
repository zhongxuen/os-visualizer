/**
 * A small hand-written tick run for the timeline tests: three phases over six ticks.
 * Built with the real run builder, so it has the shape every module's run has.
 */

import { createRun } from '@/core/events/builder';
import type { EventBase } from '@/core/events/types';
import type { SimResult } from '@/core/sim/result';

type TestEvent = EventBase & { kind: 'test.tick' };

export function buildTickRun(): SimResult<TestEvent> {
  const run = createRun<TestEvent>({ unit: 'tick' });
  const tick = (id: string) =>
    run.emit({ kind: 'test.tick', id, label: id, citation: 'ostep.4' });

  run.phase('arrive', 'P1 arrives', 'P1 is the only process, so it runs.');
  tick('t0');
  run.advance();
  tick('t1');
  run.advance();
  run.phase(
    'preempt',
    'P2 preempts P1',
    'P2 arrives with a shorter burst and takes the CPU.',
  );
  tick('t2');
  run.advance();
  tick('t3');
  run.advance();
  tick('t4');
  run.advance();
  run.phase('finish', 'P1 finishes', 'P1 runs its last tick.');
  tick('t5');
  run.advance();
  return run.finish();
}
