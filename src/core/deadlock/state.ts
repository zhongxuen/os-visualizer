import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';

/**
 * Placeholder share-state branch so the registry is complete before the deadlock core
 * exists. The deadlock core replaces `input` with what it needs to reproduce a run. Keep
 * the export name; `src/core/state/modules.ts` imports it.
 */
export const DEADLOCK_SHARE_STATE = defineShareState({
  m: 'deadlock',
  v: 1,
  input: z.object({}),
  defaults: { step: 0, input: {} },
});
