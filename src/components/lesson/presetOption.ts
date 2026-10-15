/**
 * The Presets dropdown while a lesson example is loaded (Q5, docs/UIUX.md §10.1).
 *
 * A lesson example is not one of the module's presets, so after "Load this example" the
 * dropdown used to keep naming whichever preset it showed before, while the picture
 * showed something else. A module marks a lesson load by choosing `LESSON_PRESET`; the
 * dropdown then shows "Lesson example" for as long as a lesson example is the input.
 * Picking a preset in the dropdown, or changing the input so it is no longer a lesson
 * example, takes it back to the presets (to `fallback` in the second case), and the
 * "Lesson example" entry is not offered again until the next lesson load.
 */

export const LESSON_PRESET = 'lesson-example';
export const LESSON_PRESET_LABEL = 'Lesson example';

export interface PresetOption {
  value: string;
  label: string;
}

export interface PresetSelect {
  /** The dropdown's value. */
  value: string;
  options: PresetOption[];
  /** True while the dropdown shows "Lesson example". */
  lesson: boolean;
}

export function presetSelect(
  options: readonly PresetOption[],
  chosen: string,
  activeExample: string | null,
  fallback: string,
): PresetSelect {
  const lesson = chosen === LESSON_PRESET && activeExample !== null;
  if (lesson) {
    return {
      value: LESSON_PRESET,
      options: [{ value: LESSON_PRESET, label: LESSON_PRESET_LABEL }, ...options],
      lesson,
    };
  }
  return {
    value: chosen === LESSON_PRESET ? fallback : chosen,
    options: [...options],
    lesson,
  };
}
