import { runVm, type VmEvent, type VmInput, type VmRun } from '@/core/vm';

/** The state after the last event: the finished run. */
export function final(run: VmRun) {
  const last = run.events.at(-1);
  if (!last) throw new Error('empty run');
  return last.state;
}

/** `'miss hit hit ...'`, one word per access (faults included, by their TLB outcome). */
export function tlbPattern(run: VmRun): string {
  return final(run)
    .log.map((r) => r.tlb)
    .join(' ');
}

export function eventsOf(run: VmRun, access: number): VmEvent[] {
  return run.events.filter((e) => e.access === access);
}

export function kindsOf(run: VmRun, access: number): string[] {
  return eventsOf(run, access).map((e) => e.kind);
}

export function run(input: VmInput) {
  const result = runVm(input);
  return { result, state: final(result) };
}
