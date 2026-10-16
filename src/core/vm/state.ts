import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';
import type { VmInput } from './config';
import { crossChecked, INPUT_SHAPE } from './config.schema';
import { VM_SHARE } from './share';
import { SIZING_SCHEMA } from './sizing.schema';

/**
 * Share state for `/translation`: the machine, the page table, the directory, the
 * accesses, the sizing panel's input and the step. Keep the export name;
 * `src/core/state/modules.ts` imports it. The defaults are `VM_SHARE`'s, which the page
 * renders from without loading this file (`share.ts`).
 */
export const VM_SHARE_STATE = defineShareState({
  m: VM_SHARE.m,
  v: VM_SHARE.v,
  input: z
    .object({ ...INPUT_SHAPE, sizing: SIZING_SCHEMA })
    .check(crossChecked<VmInput & { sizing: unknown }>()),
  defaults: { step: VM_SHARE.defaults.step, input: VM_SHARE.defaults.input },
});
