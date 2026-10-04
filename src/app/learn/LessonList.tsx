'use client';

import Link from 'next/link';

import { useProgress } from '@/components/state/useProgress';
import { Button } from '@/components/timeline/ui/Button';
import { LESSONS } from '@/content/lessons/catalog';

/**
 * The lessons in course order, each marked complete once every checkpoint in it has been
 * answered. Completion lives in this browser only (`osv:v1`), so the server renders
 * every lesson as not started and the marks arrive after hydration.
 */
export function LessonList() {
  const progress = useProgress();
  const done = LESSONS.filter((l) => progress.isComplete(l.id)).length;

  return (
    <>
      <p className="text-fg-secondary mt-6" data-testid="learn-progress">
        {done} of {LESSONS.length} lessons complete.
      </p>
      <ol className="mt-4 flex flex-col gap-4">
        {LESSONS.map((lesson, i) => {
          const complete = progress.isComplete(lesson.id);
          return (
            <li
              key={lesson.id}
              className="border-border bg-surface-raised rounded-lg border p-5"
              data-lesson={lesson.id}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lead font-semibold">
                  <Link
                    href={lesson.route}
                    className="focus-visible:outline-focus rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {i + 1}. {lesson.title}
                  </Link>
                </h2>
                <p className="text-small text-fg-muted">
                  {lesson.parts} parts ·{' '}
                  <span className={complete ? 'text-fg font-semibold' : undefined}>
                    {complete ? 'Complete' : 'Not complete'}
                  </span>
                </p>
              </div>
              <p className="text-fg-secondary mt-2">{lesson.summary}</p>
            </li>
          );
        })}
      </ol>
      {done > 0 ? (
        <div className="mt-6">
          <Button variant="ghost" size="sm" onClick={() => progress.reset()}>
            Forget my progress
          </Button>
        </div>
      ) : null}
    </>
  );
}
