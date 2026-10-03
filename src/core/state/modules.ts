/**
 * The share-state registry: every module's branch of the `?s=` union.
 *
 * Append-only. A module defines its branch with `defineShareState` in
 * `src/core/<name>/state.ts` and adds one import line and one entry line here. Resolve
 * merge conflicts by keeping both sides. `state.test.ts` checks every entry: a unique
 * `m`, and defaults that round-trip through a link.
 */

import { DEADLOCK_SHARE_STATE } from '../deadlock/state';
import { REPLACE_SHARE_STATE } from '../replace/state';
import { COMPARE_SHARE_STATE, SCHED_SHARE_STATE } from '../sched/state';
import { VM_SHARE_STATE } from '../vm/state';
import type { ModuleShareState } from './schema';

export const SHARE_STATES: readonly ModuleShareState[] = [
  SCHED_SHARE_STATE,
  VM_SHARE_STATE,
  REPLACE_SHARE_STATE,
  DEADLOCK_SHARE_STATE,
  COMPARE_SHARE_STATE,
];
