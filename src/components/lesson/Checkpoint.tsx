'use client';

import { useEffect, useId, useState } from 'react';

import { UNIT_MS } from '@/core/events/builder';
import { cn } from '@/lib/cn';

import { Button } from '../timeline/ui/Button';
import { useLesson } from './LessonContext';

/**
 * "Predict the next step." The question, the options and the answer all come from the
 * module's `lesson.ts`, which runs the core; the MDX only names the checkpoint. A wrong
 * answer is met with the right one and the core's own reason for it.
 *
 * While unanswered and on screen, the walkthrough holds the timeline at the
 * checkpoint's moment. "Show this moment" seeks there; "Continue" plays on after the
 * answer.
 */
export function Checkpoint({ id }: { id: string }) {
  const lesson = useLesson();
  const name = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const { mount } = lesson;
  useEffect(() => mount(id), [mount, id]);

  const spec = lesson.checkpoints.find((c) => c.id === id);
  if (!spec) throw new Error(`Unknown checkpoint: ${id}`);

  const given = lesson.answers[id];
  const answered = given !== undefined;
  const correct = given === spec.answer;
  const right = spec.options.find((o) => o.value === spec.answer);
  const loaded = lesson.activeExample === spec.example;
  const example = lesson.examples.find((e) => e.id === spec.example);

  const showMoment = () => {
    lesson.engage();
    const actions = lesson.store.getState();
    actions.pause();
    actions.seek(spec.holdAt * UNIT_MS[lesson.unit]);
  };

  return (
    <fieldset
      className="border-accent bg-surface flex flex-col gap-3 rounded-md border-l-4 p-3"
      data-checkpoint={id}
    >
      <legend className="text-fg float-left mb-1 w-full font-semibold">
        <span className="text-accent">Checkpoint: </span>
        {spec.question}
      </legend>

      {!loaded ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-small">
            This checkpoint uses the example “{example?.title ?? spec.example}”.
          </p>
          <Button size="sm" onClick={() => lesson.loadExample(spec.example)}>
            Load it
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {spec.options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'border-border text-small inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3',
              'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              answered && option.value === spec.answer && 'border-state-ok border-2',
              answered && option.value === given && !correct && 'border-state-error',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={(answered ? given : choice) === option.value}
              disabled={answered}
              onChange={() => setChoice(option.value)}
            />
            {option.label}
            {answered && option.value === spec.answer ? (
              <span className="text-caption text-fg-muted">(answer)</span>
            ) : null}
          </label>
        ))}
      </div>

      {answered ? (
        <div className="flex flex-col gap-2" data-testid={`checkpoint-result-${id}`}>
          <p className="text-fg font-semibold">
            {correct ? 'Correct.' : `Not quite. The answer is ${right?.label}.`}
          </p>
          <p className="text-small">
            <span className="text-fg font-semibold">Why: </span>
            {spec.reason}
          </p>
          <div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => lesson.store.getState().play()}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={choice === null || !loaded}
            onClick={() => {
              if (choice !== null) lesson.answer(id, choice);
            }}
          >
            Check answer
          </Button>
          <Button size="sm" variant="ghost" disabled={!loaded} onClick={showMoment}>
            Show this moment
          </Button>
        </div>
      )}
    </fieldset>
  );
}
