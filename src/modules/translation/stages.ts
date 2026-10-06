/**
 * The seven-stage pipeline (docs/UIUX.md T2): where the current access is in Split →
 * TLB → Walk → Check → Fill → PA → Access, and which stages it skips or never reaches.
 *
 * Pure: every state is read off the core's events, never decided here. A stage is
 * **skipped** when the access passes it without an event for it: a TLB hit skips the walk
 * and the fill, and with no TLB nothing is ever filled. Skips are shown as soon as the
 * TLB lookup has decided them (that is the lesson: a hit saves the walk), not only once
 * the access has gone past them. Stages after a fault are **not reached**.
 */

import type { VmEvent, VmStep } from '@/core/vm/events';
import type { VmRun } from '@/core/vm/translate';

export interface Stage {
  step: VmStep;
  /** The short name on the pipeline. */
  name: string;
  /** The name in a sentence. */
  long: string;
}

export const STAGES: readonly Stage[] = [
  { step: 1, name: 'Split', long: 'split the address' },
  { step: 2, name: 'TLB', long: 'TLB lookup' },
  { step: 3, name: 'Walk', long: 'page-table walk' },
  { step: 4, name: 'Check', long: 'protection check' },
  { step: 5, name: 'Fill', long: 'TLB fill' },
  { step: 6, name: 'PA', long: 'physical address' },
  { step: 7, name: 'Access', long: 'memory access' },
];

export type StageStatus =
  'pending' | 'current' | 'done' | 'skipped' | 'fault' | 'stopped';

export interface StageState {
  stage: Stage;
  status: StageStatus;
  /** The status in words, shown under the stage: colour is never the only cue. */
  note: string;
}

/** The steps the TLB lookup rules out for this access: a hit never walks or fills. */
function ruledOut(events: readonly VmEvent[], tlbSize: number): Set<VmStep> {
  if (events.some((e) => e.kind === 'vm.tlbHit')) return new Set<VmStep>([3, 5]);
  if (tlbSize === 0 && events.some((e) => e.kind === 'vm.tlbMiss')) {
    return new Set<VmStep>([5]);
  }
  return new Set<VmStep>();
}

function skipNote(events: readonly VmEvent[]): string {
  return events.some((e) => e.kind === 'vm.tlbHit') ? 'skipped: hit' : 'skipped: no TLB';
}

/** The pipeline for the event at `index` in `run` (none before the first event). */
export function stageStates(
  run: VmRun,
  index: number,
  tlbSize: number,
): StageState[] | null {
  if (run.events.length === 0) return null;
  const at = Math.max(0, Math.min(index, run.events.length - 1));
  const event = run.events[at]!;
  // The access's events up to and including this one: nothing from its future.
  const seen = run.events.slice(0, at + 1).filter((e) => e.access === event.access);
  const skips = ruledOut(seen, tlbSize);

  return STAGES.map((stage) => {
    const s = stage.step;
    if (s === event.step) {
      return event.kind === 'vm.fault'
        ? { stage, status: 'fault', note: 'fault' }
        : { stage, status: 'current', note: 'now' };
    }
    if (seen.some((e) => e.step === s)) return { stage, status: 'done', note: 'done' };
    if (s < event.step || skips.has(s)) {
      return { stage, status: 'skipped', note: skipNote(seen) };
    }
    if (event.kind === 'vm.fault') {
      return { stage, status: 'stopped', note: 'not reached' };
    }
    return { stage, status: 'pending', note: '' };
  });
}
