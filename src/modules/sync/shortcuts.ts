import type { ModuleShortcut } from '@/components/timeline/keymap';

/**
 * Synchronisation's own keys (docs/UIUX.md §2.3 Y1, §3 B6). Under a manual schedule, A,
 * B and C run the next op of thread T0, T1 and T2. They were 1, 2 and 3, which are the
 * timeline's speed keys everywhere else; letters keep every key meaning one thing on
 * every page. `timeline/keymap.test.ts` checks this list against the playback and
 * workspace keys.
 */

/** The key for each thread, in thread order: A runs T0. */
export const THREAD_KEYS = ['A', 'B', 'C'] as const;

export const MODULE_SHORTCUTS: readonly ModuleShortcut[] = [
  {
    chords: THREAD_KEYS.map((key) => [key]),
    action: 'Run thread T0, T1 or T2 next (manual schedule)',
  },
];

/** The key that runs thread `t`, or `undefined` past the last key. */
export function threadKey(t: number): string | undefined {
  return THREAD_KEYS[t];
}

/** The thread a key press runs (either case), or `null`. */
export function threadForKey(key: string): number | null {
  const index = THREAD_KEYS.indexOf(key.toUpperCase() as (typeof THREAD_KEYS)[number]);
  return index === -1 ? null : index;
}
