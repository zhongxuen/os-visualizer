'use client';

import type { MDXComponents } from 'mdx/types';
import { BookOpen, Check } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';

import { UNIT_MS, type RunUnit } from '@/core/events/builder';
import { cn } from '@/lib/cn';

import { useProgress } from '../state/useProgress';
import type { PlaybackStore } from '../timeline/hooks/usePlayback';
import { Button } from '../timeline/ui/Button';
import { LessonContext, type LessonContextValue } from './LessonContext';
import { LESSON_COMPONENTS } from './lessonComponents';
import { checkpointKey } from './progress';
import { revealVisual } from './reveal';
import type { CheckpointSpec, LessonExample, LessonMeta } from './types';

/**
 * A module's Walkthrough mode: the lesson MDX, one part at a time, beside the module's
 * own visualisation and timeline.
 *
 * Each part loads an example into the module ("Load this example") and may hold
 * checkpoints. Once the learner has used the lesson (loaded an example from it, or asked
 * to see a checkpoint's moment), the walkthrough watches
 * the playback store: playing, stepping or seeking past an unanswered checkpoint on
 * screen pauses the run at the checkpoint's moment. A preset loaded from the Presets
 * panel, or a shared link, is never held, so free exploration is never interrupted.
 *
 * Each answer is kept in `osv:v1` as it is given (`progress.ts`), so `/learn` can show
 * how far into a lesson the learner is. The lesson is complete (and `/learn` says so)
 * once every checkpoint has an answer, in this visit or an earlier one.
 *
 * Guided mode's look (docs/UIUX.md §4.1, §7.3): the prose sits in a reading column of at
 * most 68ch, the parts show as a row of segments, and `<TryIt>` and checkpoint buttons
 * bring the picture into view (`reveal.ts`).
 */

export interface WalkthroughProps {
  lesson: LessonMeta;
  Content: ComponentType<{ components?: MDXComponents }>;
  store: PlaybackStore;
  unit: RunUnit;
  examples: readonly LessonExample[];
  activeExample: string | null;
  onLoadExample(id: string): void;
  checkpoints: readonly CheckpointSpec[];
  className?: string;
}

export function Walkthrough({
  lesson,
  Content,
  store,
  unit,
  examples,
  activeExample,
  onLoadExample,
  checkpoints,
  className,
}: WalkthroughProps) {
  const headingId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [part, setPart] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState<ReadonlySet<string>>(new Set());
  const [engaged, setEngaged] = useState(false);
  const [notice, setNotice] = useState('');
  const progress = useProgress();
  const { markComplete } = progress;
  const completed = progress.progress.completed;
  const complete = progress.isComplete(lesson.id);

  const loadExample = useCallback(
    (id: string) => {
      onLoadExample(id);
      setEngaged(true);
    },
    [onLoadExample],
  );

  const answer = useCallback(
    (id: string, value: string) => {
      setAnswers((current) => (id in current ? current : { ...current, [id]: value }));
      markComplete(checkpointKey(lesson.id, id));
    },
    [lesson.id, markComplete],
  );

  const isDone = useCallback(
    (id: string) =>
      id in answers ||
      completed.includes(lesson.id) ||
      completed.includes(checkpointKey(lesson.id, id)),
    [answers, completed, lesson.id],
  );

  const mount = useCallback((id: string) => {
    setMounted((current) => new Set(current).add(id));
    return () =>
      setMounted((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
  }, []);

  const reveal = useCallback(() => revealVisual(rootRef.current), []);

  // The first unanswered checkpoint on screen whose example is loaded from the lesson.
  const pending = useMemo(
    () =>
      checkpoints
        .filter(
          (c) =>
            mounted.has(c.id) &&
            c.example === activeExample &&
            engaged &&
            !(c.id in answers),
        )
        .sort((a, b) => a.holdAt - b.holdAt)[0] ?? null,
    [checkpoints, mounted, activeExample, engaged, answers],
  );

  useEffect(() => {
    if (!pending) return;
    const limit = pending.holdAt * UNIT_MS[unit];
    const hold = (state: { virtualTime: number }) => {
      if (state.virtualTime <= limit) return;
      const actions = store.getState();
      actions.pause();
      actions.seek(limit);
      setNotice(`Paused for a checkpoint: ${pending.question}`);
    };
    hold(store.getState());
    return store.subscribe(hold);
  }, [pending, store, unit]);

  const answered = checkpoints.filter((c) => isDone(c.id)).length;
  const allAnswered = checkpoints.length > 0 && answered === checkpoints.length;
  useEffect(() => {
    if (allAnswered) markComplete(lesson.id);
  }, [allAnswered, lesson.id, markComplete]);

  const value: LessonContextValue = useMemo(
    () => ({
      store,
      unit,
      part,
      parts: lesson.parts,
      examples,
      activeExample,
      loadExample,
      engage: () => setEngaged(true),
      checkpoints,
      answers,
      answer,
      isDone,
      mount,
      pending: pending?.id ?? null,
      reveal,
    }),
    [
      store,
      unit,
      part,
      lesson.parts,
      examples,
      activeExample,
      loadExample,
      checkpoints,
      answers,
      answer,
      isDone,
      mount,
      pending,
      reveal,
    ],
  );

  const go = (next: number) => {
    setPart(next);
    setNotice(`Part ${next} of ${lesson.parts}`);
  };

  return (
    <section
      ref={rootRef}
      aria-labelledby={headingId}
      className={cn(
        'border-border bg-surface-raised flex flex-col gap-4 rounded-lg border p-4 sm:p-5',
        className,
      )}
      data-lesson={lesson.id}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2
            id={headingId}
            className="text-lead inline-flex items-center gap-2 font-semibold"
          >
            <BookOpen aria-hidden="true" className="text-accent size-5 shrink-0" />
            <span>
              <span className="sr-only">Lesson: </span>
              {lesson.title}
            </span>
          </h2>
          <p className="text-caption text-fg-muted num">
            Part {part} of {lesson.parts} · {answered} of {checkpoints.length} checkpoints
            {complete ? ' · complete' : ''}
          </p>
        </div>
        <ol aria-hidden="true" className="flex gap-1" data-testid="lesson-parts">
          {Array.from({ length: lesson.parts }, (_, i) => (
            <li
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i + 1 < part
                  ? 'bg-accent/60'
                  : i + 1 === part
                    ? 'bg-accent'
                    : 'bg-border',
              )}
            />
          ))}
        </ol>
      </header>

      <LessonContext.Provider value={value}>
        <div className="lesson-prose text-fg-secondary measure flex flex-col gap-4">
          <Content components={LESSON_COMPONENTS} />
        </div>
      </LessonContext.Provider>

      <nav
        aria-label="Lesson parts"
        className="border-border measure flex flex-wrap items-center justify-between gap-2 border-t pt-3"
      >
        <Button
          variant="secondary"
          size="sm"
          disabled={part <= 1}
          onClick={() => go(part - 1)}
        >
          Previous part
        </Button>
        <Button
          variant={part < lesson.parts ? 'primary' : 'secondary'}
          size="sm"
          disabled={part >= lesson.parts}
          onClick={() => go(part + 1)}
        >
          Next part
        </Button>
      </nav>
      <p role="status" className="text-caption text-fg-muted min-h-4">
        {allAnswered ? (
          <span className="text-state-ok inline-flex items-center gap-1 font-medium">
            <Check aria-hidden="true" className="size-4" />
            Every checkpoint answered: lesson complete.{' '}
          </span>
        ) : null}
        {notice}
      </p>
    </section>
  );
}
