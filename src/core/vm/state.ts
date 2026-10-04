import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';
import { crossChecked, INPUT_SHAPE, type VmInput } from './config';
import { DEFAULT_PRESET } from './presets';
import { SIZING_SCHEMA } from './sizing';

/**
 * Share state for `/translation`: the machine, the page table, the directory, the
 * accesses, the sizing panel's input and the step. Keep the export name;
 * `src/core/state/modules.ts` imports it.
 */
export const VM_SHARE_STATE = defineShareState({
  m: 'vm',
  v: 1,
  input: z
    .object({ ...INPUT_SHAPE, sizing: SIZING_SCHEMA })
    .check(crossChecked<VmInput & { sizing: unknown }>()),
  defaults: {
    step: 0,
    input: { ...DEFAULT_PRESET.input, sizing: DEFAULT_PRESET.sizing },
  },
});
