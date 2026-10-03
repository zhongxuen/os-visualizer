/**
 * The learner's progress, kept in `localStorage` under `osv:v1`:
 *
 * ```
 * { v: 1, completed: string[], saved: { [module]: input[] }, prefs: {...} }
 * ```
 *
 * One key, two owners. `prefs` belongs to the shell (`src/components/shell/prefs.ts`);
 * this file owns `completed` and `saved` and writes `prefs` back exactly as it found it,
 * as the shell does for these two fields.
 *
 * Whatever is stored goes through `migrateProgress`, which accepts every shape it knows
 * and falls back to empty for anything else. Nothing here throws.
 */

import { STORAGE_KEY } from '@/components/shell/themeScript';

export const PROGRESS_KEY = STORAGE_KEY;

/** Most saved inputs kept per module; saving one more drops the oldest. */
export const MAX_SAVED_PER_MODULE = 20;

export interface ProgressV1 {
  v: 1;
  /** Finished walkthroughs or chapters, unique, in completion order. */
  completed: string[];
  /** Saved custom workloads, reference strings and graphs, per module key. */
  saved: Record<string, unknown[]>;
  /** The shell's preferences, carried through untouched. */
  prefs: Record<string, unknown>;
}

export function emptyProgress(): ProgressV1 {
  return { v: 1, completed: [], saved: {}, prefs: {} };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))];
}

/**
 * Bring any stored value up to the current version.
 *
 * - `v: 1` is read field by field: valid fields kept, the rest emptied.
 * - A record with no `v` (written before the key was versioned) is read as v1.
 * - A bare array of strings (the oldest shape: completed ids only) becomes `completed`.
 * - Anything else, including a newer version, is empty.
 */
export function migrateProgress(raw: unknown): ProgressV1 {
  const result = emptyProgress();

  if (Array.isArray(raw)) {
    result.completed = uniqueStrings(raw);
    return result;
  }
  if (!isObject(raw) || (raw.v !== 1 && raw.v !== undefined)) return result;

  result.completed = uniqueStrings(raw.completed);
  if (isObject(raw.saved)) {
    for (const [module, inputs] of Object.entries(raw.saved)) {
      if (Array.isArray(inputs)) {
        result.saved[module] = inputs.slice(-MAX_SAVED_PER_MODULE);
      }
    }
  }
  if (isObject(raw.prefs)) result.prefs = { ...raw.prefs };
  return result;
}

/** Parse the stored string. Never throws. */
export function parseProgress(stored: string | null): ProgressV1 {
  if (stored === null) return emptyProgress();
  try {
    return migrateProgress(JSON.parse(stored));
  } catch {
    return emptyProgress();
  }
}
