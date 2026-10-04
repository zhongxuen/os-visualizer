import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';
import { PROGRAM_SCHEMA, SCHEDULE_SCHEMA, type Program, type Schedule } from './program';
import { DEFAULT_PRESET } from './presets';

/** Everything `/sync` needs to reproduce a run. */
export interface SyncInput {
  /** The preset the program came from, for the picker; `'custom'` once edited. */
  preset: string;
  program: Program;
  schedule: Schedule;
}

export const SYNC_INPUT_SCHEMA = z.object({
  preset: z.string().check(z.regex(/^[a-z0-9-]{1,32}$/)),
  program: PROGRAM_SCHEMA,
  schedule: SCHEDULE_SCHEMA,
}) as unknown as z.ZodMiniType<SyncInput>;

export const DEFAULT_INPUT: SyncInput = {
  preset: DEFAULT_PRESET.id,
  program: DEFAULT_PRESET.program,
  schedule: DEFAULT_PRESET.schedule,
};

/**
 * Share state for `/sync`: the program, the schedule (manual picks, round-robin quantum
 * or random seed) and the tick on screen. Keep the export name;
 * `src/core/state/modules.ts` imports it.
 */
export const SYNC_SHARE_STATE = defineShareState({
  m: 'sync',
  v: 1,
  input: SYNC_INPUT_SCHEMA,
  defaults: { step: 0, input: DEFAULT_INPUT },
});
