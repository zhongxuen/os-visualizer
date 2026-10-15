import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { lessonMayLoad, useLessonAutoLoad } from './autoLoad';
import { LESSON_PRESET, presetSelect } from './presetOption';

const defaults = { step: 0, input: { n: 1 } };

describe('lessonMayLoad (Q1)', () => {
  const base = {
    ready: true,
    linked: defaults,
    defaults,
    input: defaults.input,
    owned: defaults.input,
  };

  it('loads over the untouched defaults, or over what the lesson loaded itself', () => {
    expect(lessonMayLoad(base)).toBe(true);
    const fromLesson = { n: 2 };
    expect(lessonMayLoad({ ...base, input: fromLesson, owned: fromLesson })).toBe(true);
  });

  it('waits until the link has been read', () => {
    expect(lessonMayLoad({ ...base, ready: false })).toBe(false);
  });

  it('never loads over a ?s= link, even one that decodes to the defaults', () => {
    expect(lessonMayLoad({ ...base, linked: { step: 0, input: { n: 1 } } })).toBe(false);
  });

  it('never loads when the learner has saved work for the module', () => {
    expect(lessonMayLoad({ ...base, saved: 1 })).toBe(false);
  });

  it('never loads over the learner’s own input (an edit or a preset)', () => {
    // Equal to the defaults, or to a lesson example, but not the lesson's: the learner's.
    expect(lessonMayLoad({ ...base, input: { n: 1 } })).toBe(false);
    expect(lessonMayLoad({ ...base, input: { n: 2 }, owned: { n: 2 } })).toBe(false);
  });
});

describe('useLessonAutoLoad (Q1)', () => {
  it('hands the input a lesson load produced to the lesson, and nothing else', () => {
    const { result } = renderHook(() => {
      const [input, setInput] = useState(defaults.input);
      const auto = useLessonAutoLoad({
        ready: true,
        linked: defaults,
        defaults,
        input,
      });
      return { ...auto, setInput };
    });
    expect(result.current.autoLoad).toBe(true);
    // The lesson loads an example: still the lesson's.
    act(() => {
      result.current.lessonLoaded();
      result.current.setInput({ n: 7 });
    });
    expect(result.current.autoLoad).toBe(true);
    // The learner edits: theirs from now on.
    act(() => result.current.setInput({ n: 8 }));
    expect(result.current.autoLoad).toBe(false);
  });
});

describe('presetSelect (Q5)', () => {
  const options = [
    { value: 'a', label: 'Preset A' },
    { value: 'b', label: 'Preset B' },
  ];

  it('shows the chosen preset normally', () => {
    expect(presetSelect(options, 'b', null, 'a')).toEqual({
      value: 'b',
      options,
      lesson: false,
    });
    // A preset chosen in the dropdown wins, even with a lesson example loaded.
    expect(presetSelect(options, 'b', 'ex', 'a').value).toBe('b');
  });

  it('shows "Lesson example" while a lesson example is loaded', () => {
    const shown = presetSelect(options, LESSON_PRESET, 'ex', 'a');
    expect(shown.lesson).toBe(true);
    expect(shown.value).toBe(LESSON_PRESET);
    expect(shown.options[0]).toEqual({ value: LESSON_PRESET, label: 'Lesson example' });
    expect(shown.options).toHaveLength(3);
  });

  it('falls back once the input is no longer a lesson example', () => {
    const shown = presetSelect(options, LESSON_PRESET, null, 'a');
    expect(shown).toEqual({ value: 'a', options, lesson: false });
  });
});
