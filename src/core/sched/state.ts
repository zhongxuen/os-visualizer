import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';
import { DEFAULT_COMPARE_PRESET, MAX_COMPARE, MIN_COMPARE } from './compare';
import { DEFAULT_PRESET } from './presets';
import { POLICY_SCHEMA, WORKLOAD_SCHEMA } from './workload';

/**
 * Share state for `/scheduling`: the workload, the policy and the step. Keep the export
 * name; `src/core/state/modules.ts` imports it.
 */
export const SCHED_SHARE_STATE = defineShareState({
  m: 'sched',
  v: 1,
  input: z.object({ workload: WORKLOAD_SCHEMA, policy: POLICY_SCHEMA }),
  defaults: {
    step: 0,
    input: { workload: DEFAULT_PRESET.workload, policy: DEFAULT_PRESET.policy },
  },
});

/** Share state for `/compare`: the workload and 2-4 policies. */
export const COMPARE_SHARE_STATE = defineShareState({
  m: 'compare',
  v: 1,
  input: z.object({
    workload: WORKLOAD_SCHEMA,
    policies: z
      .array(POLICY_SCHEMA)
      .check(z.minLength(MIN_COMPARE), z.maxLength(MAX_COMPARE)),
  }),
  defaults: {
    step: 0,
    input: {
      workload: DEFAULT_COMPARE_PRESET.workload,
      policies: DEFAULT_COMPARE_PRESET.policies,
    },
  },
});
