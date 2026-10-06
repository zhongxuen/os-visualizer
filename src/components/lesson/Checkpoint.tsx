'use client';

import { Check, CircleHelp, Pause, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useStore } from 'zustand';

import { UNIT_MS } from '@/core/events/builder';
import { cn } from '@/lib/cn';

import { Pill } from '../ui/Pill';
import { Button } from '../timeline/ui/Button';
import { focusRing } from '../timeline/ui/styles';
import { useLesson } from './LessonContext';

/**
 * "Predict the next step" as a question card (docs/UIUX.md §7.3). The question, the
 * options and the answer all come from the module's `lesson.ts`, which runs the core; the
 * MDX only names the checkpoint.
 *
 * Its states:
 *
 * - **Needs its example:** another example is loaded, so the card offers to load this one.
 * - **Asking:** the options are buttons; pressing one answers. While the walkthrough holds
 *   the timeline for this card and the playhead has reached it, the card says "Paused for
 *   this question".
 * - **Correct:** a tick, "Correct", the core's reason, and "Show the next step", which
 *   moves one step past the question and brings the picture into view.
 * - **Wrong:** a cross, the right answer, the core's reason (the deciding event's label)
 *   and the same "Show the next step".
 *
 * No confetti. Focus moves to the result when the question is answered, so a keyboard or
 * screen-reader user hears it and is not left on a button that has gone.
 */
export function Checkpoint({ id }: { id: string }) {
  const lesson = useLesson();
  const questionId = useId();
  const resultRef = useRef<HTMLParagraphElement>(null);
  const justAnswered = useRef(false);
  const { mount, store, unit } = lesson;
  useEffect(() => mount(id), [mount, id]);

  const spec = lesson.checkpoints.find((c) => c.id === id);
  if (!spec) throw new Error(`Unknown checkpoint: ${id}`);
  const holdMs = spec.holdAt * UNIT_MS[unit];

  const given = lesson.answers[id];
  const answered = given !== undefined;

  useEffect(() => {
    if (answered && justAnswered.current) {
      justAnswered.current = false;
      resultRef.current?.focus();
    }
  }, [answered]);

  const atHold = useStore(store, (s) => s.virtualTime >= holdMs);
  const held = !answered && lesson.pending === id && atHold;

  const correct = given === spec.answer;
  const right = spec.options.find((o) => o.value === spec.answer);
  const loaded = lesson.activeExample === spec.example;
  const example = lesson.examples.find((e) => e.id === spec.example);
  const doneBefore = !answered && lesson.isDone(id);

  const showMoment = () => {
    lesson.engage();
    const actions = store.getState();
    actions.pause();
    actions.seek(holdMs);
    lesson.reveal();
  };

  const showNext = () => {
    const actions = store.getState();
    actions.pause();
    actions.seek(Math.min(holdMs + UNIT_MS[unit], actions.timeline.durationMs));
    lesson.reveal();
  };

  const choose = (value: string) => {
    justAnswered.current = true;
    lesson.answer(id, value);
  };

  return (
    <section
      aria-labelledby={questionId}
      className={cn(
        'bg-surface flex flex-col gap-3 rounded-lg border p-4',
        answered
          ? correct
            ? 'border-state-ok'
            : 'border-state-error'
          : 'border-accent border-l-4',
      )}
      data-checkpoint={id}
      data-state={
        answered
          ? correct
            ? 'correct'
            : 'wrong'
          : held
            ? 'held'
            : loaded
              ? 'asking'
              : 'idle'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-caption text-accent inline-flex items-center gap-1 font-semibold tracking-wide uppercase">
          <CircleHelp aria-hidden="true" className="size-4" />
          Checkpoint
        </p>
        {held ? (
          <Pill tone="accent" icon={<Pause />} data-testid={`checkpoint-held-${id}`}>
            Paused for this question
          </Pill>
        ) : null}
        {doneBefore ? <Pill tone="neutral">Answered on an earlier visit</Pill> : null}
      </div>
      <h4 id={questionId} className="text-fg text-body font-semibold">
        {spec.question}
      </h4>

      {!loaded && !answered ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-small">
            This question uses the example &ldquo;{example?.title ?? spec.example}&rdquo;.
          </p>
          <Button size="sm" onClick={() => lesson.loadExample(spec.example)}>
            Load it
          </Button>
        </div>
      ) : null}

      <ul
        aria-label="Answers"
        className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]"
      >
        {spec.options.map((option) => {
          const isAnswer = option.value === spec.answer;
          const isGiven = option.value === given;
          return (
            <li key={option.value} className="flex">
              <button
                type="button"
                disabled={answered || !loaded}
                aria-pressed={answered ? isGiven : undefined}
                onClick={() => choose(option.value)}
                className={cn(
                  'min-h-target text-small flex w-full items-center justify-between gap-2 rounded-md border px-3 text-left font-medium transition-colors',
                  focusRing,
                  !answered &&
                    'border-border-strong bg-surface-raised text-fg hover:border-accent enabled:cursor-pointer disabled:opacity-60',
                  answered && isAnswer && 'border-state-ok text-fg border-2',
                  answered && isGiven && !isAnswer && 'border-state-error text-fg',
                  answered && !isAnswer && !isGiven && 'border-border text-fg-muted',
                )}
              >
                <span>{option.label}</span>
                {answered && isAnswer ? (
                  <span className="text-state-ok text-caption inline-flex items-center gap-1">
                    <Check aria-hidden="true" className="size-4" />
                    answer
                  </span>
                ) : answered && isGiven ? (
                  <span className="text-state-error text-caption inline-flex items-center gap-1">
                    <X aria-hidden="true" className="size-4" />
                    your pick
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <div className="flex flex-col gap-2" data-testid={`checkpoint-result-${id}`}>
          <p
            ref={resultRef}
            tabIndex={-1}
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold outline-none',
              correct ? 'text-state-ok' : 'text-state-error',
            )}
          >
            {correct ? (
              <Check aria-hidden="true" className="size-5" />
            ) : (
              <X aria-hidden="true" className="size-5" />
            )}
            {correct ? 'Correct.' : `Not quite. The answer is ${right?.label}.`}
          </p>
          <p className="text-small text-fg-secondary">
            <span className="text-fg font-semibold">Why: </span>
            {spec.reason}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={showNext}>
              Show the next step
            </Button>
            <Button size="sm" variant="ghost" onClick={() => store.getState().play()}>
              Continue playing
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" disabled={!loaded} onClick={showMoment}>
            Show this moment
          </Button>
          <p className="text-caption text-fg-muted">Pick an answer to check it.</p>
        </div>
      )}
    </section>
  );
}
