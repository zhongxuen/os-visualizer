import { replace, type Policy, type ReplEvent, type ReplRun } from '@/core/replace';

/** The state after the last event: the finished run. */
export function final(run: ReplRun) {
  const last = run.events.at(-1);
  if (!last) throw new Error('empty run');
  return last.state;
}

export function eventsOf(run: ReplRun, index: number): ReplEvent[] {
  return run.events.filter((e) => e.state.index === index);
}

export function kindsOf(run: ReplRun, index: number): string[] {
  return eventsOf(run, index).map((e) => e.kind);
}

export function run(refString: number[], frames: number, policy: Policy) {
  const result = replace(refString, frames, policy);
  return { result, state: final(result) };
}
