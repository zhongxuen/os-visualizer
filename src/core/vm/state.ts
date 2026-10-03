import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';

/**
 * Placeholder share-state branch so the registry is complete before the address translation core
 * exists. The vm core replaces `input` with what it needs to reproduce a run. Keep
 * the export name; `src/core/state/modules.ts` imports it.
 */
export const VM_SHARE_STATE = defineShareState({
  m: 'vm',
  v: 1,
  input: z.object({}),
  defaults: { step: 0, input: {} },
});
