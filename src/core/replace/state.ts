import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';
import { INPUT_SHAPE } from './input';
import { DEFAULT_PRESET } from './presets';

/**
 * Share state for `/replacement`: the reference string, the frame count, the policy and
 * the step. A generated string is stored as the string itself, so a link needs no seed.
 * Keep the export name; `src/core/state/modules.ts` imports it.
 */
export const REPLACE_SHARE_STATE = defineShareState({
  m: 'replace',
  v: 1,
  input: z.object(INPUT_SHAPE),
  defaults: { step: 0, input: DEFAULT_PRESET.input },
});
