/**
 * `SimResult` -- what a finished run hands to the renderer.
 *
 * A local re-implementation of Internet Visualizer's `src/core/sim/result.ts` contract
 * (see VENDORED.md). The vendored `playback.ts` imports `SimResult` from here, so the
 * names and the shape are the same: an ordered event list, a derived phase index for the
 * stepper, and the total virtual duration. What is gone is everything about PDUs -- this
 * repo has no packets -- and the hard-wired event type, which is a type parameter here so
 * each module's run is typed by its own events.
 *
 * The default type parameter is what lets the vendored `import type { SimResult }`
 * compile unchanged: `timelineFrom(result: SimResult)` reads only `at`, `phases` and
 * `durationMs`, and any `SimResult<E>` is assignable to `SimResult<TimedEvent>`.
 */

/** Anything placed on the timeline. `at` is in **virtual** milliseconds. */
export interface TimedEvent {
  at: number;
}

/**
 * Where a phase begins, as recorded by the run builder.
 *
 * In Internet Visualizer this is a `{ kind: 'phase' }` event in the event list. Here the
 * builder keeps phase starts separately, so the `OsEvent` union holds only module events
 * and every event can carry a citation and a snapshot.
 */
export interface PhaseStart extends TimedEvent {
  id: string;
  title: string;
  description: string;
  plain?: string;
}

/**
 * One chapter of the run, with its extent on the timeline. Same fields as Internet
 * Visualizer's `PhaseSummary`.
 */
export interface PhaseSummary {
  /** Position in `SimResult.phases`, so a stepper can move by index without a lookup. */
  index: number;
  /** The phase's `id`, stable across runs -- safe to put in a URL or a test. */
  id: string;
  /** Short human title, e.g. `'P2 arrives'`. */
  title: string;
  /** One or two sentences explaining what happens in this phase. */
  description: string;
  /** Virtual millisecond the phase begins. */
  startMs: number;
  /**
   * Virtual millisecond the phase ends -- the next phase's `startMs`, or the run's
   * `durationMs` for the last phase. Treated as a half-open interval `[startMs, endMs)`
   * everywhere, so exactly one phase is current at any time.
   */
  endMs: number;
  /** A plain-language sentence for the phase, when the run wrote one. */
  plain?: string;
}

/**
 * The complete output of one run.
 *
 * Deterministic by contract: the same input produces a deep-equal `SimResult`, which is
 * what lets tests compare two runs with `toStrictEqual`.
 */
export interface SimResult<E extends TimedEvent = TimedEvent> {
  /** Every event, sorted by `at` (non-decreasing). */
  events: E[];
  /** The phase index derived from the phase starts; see `summarizePhases`. */
  phases: PhaseSummary[];
  /** Total virtual duration in milliseconds -- the far end of the timeline. */
  durationMs: number;
}

/**
 * Build the phase index from the phase starts, in the order given.
 *
 * Same semantics as Internet Visualizer: each phase ends where the next begins, and the
 * last ends at `durationMs` (or at its own start, if the run is shorter than its final
 * phase -- an empty phase is preferable to a negative one).
 *
 * `plain` is copied only when present. A summary never carries `plain: undefined`: the
 * determinism test compares runs with `toStrictEqual`, and a key that is
 * present-but-undefined is a difference a consumer can see.
 */
export function summarizePhases(
  starts: readonly PhaseStart[],
  durationMs: number,
): PhaseSummary[] {
  return starts.map((start, index) => {
    const next = starts[index + 1];
    const endMs = next ? next.at : Math.max(durationMs, start.at);

    return {
      index,
      id: start.id,
      title: start.title,
      description: start.description,
      startMs: start.at,
      endMs,
      ...(start.plain === undefined ? {} : { plain: start.plain }),
    };
  });
}
