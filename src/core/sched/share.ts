import type { ModuleShareState, ShareStateBase, ShareStateSource } from '../state/schema';
import { DEFAULT_COMPARE_PRESET } from './compare';
import { DEFAULT_PRESET } from './presets';
import type { Policy, Workload } from './workload';

/**
 * `/scheduling` and `/compare`'s share states without their schemas (see
 * `ShareStateSource`): what the pages render from, with `load()` bringing `state.ts` and
 * Zod only when a link has to be decoded.
 */

export type SchedShareState = ShareStateBase<
  'sched',
  { workload: Workload; policy: Policy }
>;
export type CompareShareState = ShareStateBase<
  'compare',
  { workload: Workload; policies: Policy[] }
>;

export const SCHED_SHARE: ShareStateSource<SchedShareState> = {
  m: 'sched',
  v: 1,
  defaults: {
    m: 'sched',
    v: 1,
    step: 0,
    input: { workload: DEFAULT_PRESET.workload, policy: DEFAULT_PRESET.policy },
  },
  load: () =>
    import('./state').then(
      (s) => s.SCHED_SHARE_STATE as unknown as ModuleShareState<SchedShareState>,
    ),
};

export const COMPARE_SHARE: ShareStateSource<CompareShareState> = {
  m: 'compare',
  v: 1,
  defaults: {
    m: 'compare',
    v: 1,
    step: 0,
    input: {
      workload: DEFAULT_COMPARE_PRESET.workload,
      policies: [...DEFAULT_COMPARE_PRESET.policies],
    },
  },
  load: () =>
    import('./state').then(
      (s) => s.COMPARE_SHARE_STATE as unknown as ModuleShareState<CompareShareState>,
    ),
};
