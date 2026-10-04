/**
 * The shapes a walkthrough is built from. A module computes them from its core runs;
 * the lesson components only render them. Nothing here knows any algorithm, which is
 * what keeps a checkpoint's answer out of the lesson text: the module's `lesson.ts`
 * runs the core and fills these in.
 */

/** One example a lesson loads into the module: a preset, by id. */
export interface LessonExample {
  id: string;
  title: string;
}

export interface CheckpointOption {
  value: string;
  label: string;
}

/**
 * "Predict the next step." The timeline holds at `holdAt` until the question is answered,
 * so the screen shows the state just before the step being asked about.
 */
export interface CheckpointSpec {
  /** Unique within the lesson; the MDX names it: `<Checkpoint id="..." />`. */
  id: string;
  /** The example that must be loaded for the question to make sense. */
  example: string;
  question: string;
  options: readonly CheckpointOption[];
  /** One of the option values, computed from the core run. */
  answer: string;
  /** The core's own reason: the label of the event (or result) that decides it. */
  reason: string;
  /** Whole ticks or steps: where the timeline stops until the question is answered. */
  holdAt: number;
}

/** A lesson as `/learn` and the module's Walkthrough see it. */
export interface LessonMeta {
  /** The completion id kept in `osv:v1`, e.g. `'lesson.scheduling'`. */
  id: string;
  /** The module slug in the registry. */
  module: string;
  route: `/${string}`;
  title: string;
  summary: string;
  /** How many `<LessonStep>` parts the MDX has. */
  parts: number;
}
