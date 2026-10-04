'use client';

import type { MDXComponents } from 'mdx/types';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
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
 * The lesson is complete (and `/learn` says so) once every checkpoint has an answer.
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
  const [part, setPart] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState<ReadonlySet<string>>(new Set());
  const [engaged, setEngaged] = useState(false);
  const [notice, setNotice] = useState('');
  const progress = useProgress();
  const { markComplete } = progress;
  const complete = progress.isComplete(lesson.id);

  const loadExample = useCallback(
    (id: string) => {
      onLoadExample(id);
      setEngaged(true);
    },
    [onLoadExample],
  );

  const answer = useCallback((id: string, value: string) => {
    setAnswers((current) => (id in current ? current : { ...current, [id]: value }));
  }, []);

  const mount = useCallback((id: string) => {
    setMounted((current) => new Set(current).add(id));
    return () =>
      setMounted((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
  }, []);

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

  const answered = checkpoints.filter((c) => c.id in answers).length;
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
      mount,
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
      mount,
    ],
  );

  const go = (next: number) => {
    setPart(next);
    setNotice(`Part ${next} of ${lesson.parts}`);
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'border-border bg-surface-raised flex flex-col gap-3 rounded-lg border p-4',
        className,
      )}
      data-lesson={lesson.id}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lead font-semibold">
          Lesson: {lesson.title}
        </h2>
        <p className="text-caption text-fg-muted">
          Part {part} of {lesson.parts} · {answered} of {checkpoints.length} checkpoints
          {complete ? ' · complete' : ''}
        </p>
      </div>

      <LessonContext.Provider value={value}>
        <div className="lesson-prose text-fg-secondary flex flex-col gap-3">
          <Content components={LESSON_COMPONENTS} />
        </div>
      </LessonContext.Provider>

      <nav aria-label="Lesson parts" className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={part <= 1}
          onClick={() => go(part - 1)}
        >
          Previous part
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={part >= lesson.parts}
          onClick={() => go(part + 1)}
        >
          Next part
        </Button>
      </nav>
      <p role="status" className="text-caption text-fg-muted min-h-4">
        {allAnswered ? 'Every checkpoint answered: lesson complete. ' : ''}
        {notice}
      </p>
    </section>
  );
}
