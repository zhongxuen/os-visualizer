import { useCallback, useState } from 'react';

/**
 * May opening a lesson part load its example (Q1, docs/UIUX.md §10.1)?
 *
 * Guided mode loads each part's example as the part opens, so the text and the picture
 * agree from the first screen. Sandbox state is never overwritten without the learner
 * acting, so the answer is no, and the part keeps its "Load this example" bar, when:
 *
 * - the page was opened from a `?s=` link (someone's shared input, or a hand-off from
 *   another module): `linked` is not the module's defaults themselves;
 * - the learner has saved work for this module in this browser (`saved` > 0);
 * - the input is not one the lesson owns: neither the module's untouched defaults nor the
 *   input the lesson itself last loaded. An edit or a preset, even one equal to a lesson
 *   example, is the learner's.
 *
 * Until the link has been read (`ready`), nothing loads.
 *
 * `useShareState` hands back its definition's `defaults` object itself when there is no
 * `?s=`, and keeps the input's identity until something replaces it, so identity is the
 * test here, not deep equality.
 */

export interface LessonInputState<I> {
  /** `useShareState(...).ready`. */
  ready: boolean;
  /** `useShareState(...).linked`: what the link decoded to. */
  linked: unknown;
  /** The module's share-state defaults (`XXX_SHARE_STATE.defaults`). */
  defaults: { input: I };
  /** The module's input now (`state.input`). */
  input: I;
  /** How many inputs the learner saved for this module in this browser. */
  saved?: number;
}

export function lessonMayLoad<I>({
  ready,
  linked,
  defaults,
  input,
  owned,
  saved = 0,
}: LessonInputState<I> & {
  /** The input the lesson may replace: the defaults, or what it last loaded. */
  owned: unknown;
}): boolean {
  return ready && linked === defaults && saved === 0 && input === owned;
}

/**
 * The module's side of Q1: `autoLoad` for `<Walkthrough>`, and `lessonLoaded()`, which
 * the module calls whenever the lesson loads an example, so the input that load produces
 * is the lesson's to replace when the next part opens.
 */
export function useLessonAutoLoad<I>(state: LessonInputState<I>): {
  autoLoad: boolean;
  lessonLoaded: () => void;
} {
  const { input } = state;
  const [track, setTrack] = useState<{ owned: unknown; pending: boolean }>({
    owned: state.defaults.input,
    pending: false,
  });
  // The load and the flag land in the same render, so `input` is what the load made.
  // Adjusted while rendering (React's "storing information from previous renders").
  let owned = track.owned;
  if (track.pending) {
    owned = input;
    setTrack({ owned, pending: false });
  }
  const lessonLoaded = useCallback(
    () => setTrack((current) => ({ ...current, pending: true })),
    [],
  );
  return { autoLoad: lessonMayLoad({ ...state, owned }), lessonLoaded };
}
