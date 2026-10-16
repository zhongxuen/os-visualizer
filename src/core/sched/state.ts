import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';
import { MAX_COMPARE, MIN_COMPARE } from './compare';
import { COMPARE_SHARE, SCHED_SHARE } from './share';
import { POLICY_SCHEMA, WORKLOAD_SCHEMA } from './workload.schema';

/**
 * Share state for `/scheduling`: the workload, the policy and the step. Keep the export
 * name; `src/core/state/modules.ts` imports it. The defaults are `SCHED_SHARE`'s, which
 * the page renders from without loading this file (`share.ts`).
 */
export const SCHED_SHARE_STATE = defineShareState({
  m: SCHED_SHARE.m,
  v: SCHED_SHARE.v,
  input: z.object({ workload: WORKLOAD_SCHEMA, policy: POLICY_SCHEMA }),
  defaults: { step: SCHED_SHARE.defaults.step, input: SCHED_SHARE.defaults.input },
});

/** Share state for `/compare`: the workload and 2-4 policies. */
export const COMPARE_SHARE_STATE = defineShareState({
  m: COMPARE_SHARE.m,
  v: COMPARE_SHARE.v,
  input: z.object({
    workload: WORKLOAD_SCHEMA,
    policies: z
      .array(POLICY_SCHEMA)
      .check(z.minLength(MIN_COMPARE), z.maxLength(MAX_COMPARE)),
  }),
  defaults: { step: COMPARE_SHARE.defaults.step, input: COMPARE_SHARE.defaults.input },
});
