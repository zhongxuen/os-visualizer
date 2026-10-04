'use client';

import { useId, type ReactNode } from 'react';

import { Button } from '../timeline/ui/Button';
import { useLesson } from './LessonContext';

/**
 * One part of a walkthrough: a heading, about 150 words, and the example it uses. Only
 * the part on screen renders, so its checkpoints are the only ones that can hold the
 * timeline.
 */
export function LessonStep({
  n,
  title,
  example,
  children,
}: {
  /** 1-based, in reading order. */
  n: number;
  title: string;
  /** The example this part loads, by id. */
  example?: string;
  children: ReactNode;
}) {
  const lesson = useLesson();
  const headingId = useId();
  if (lesson.part !== n) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-fg text-body font-semibold">
        {title}
      </h3>
      {example ? <ExampleBar id={example} /> : null}
      {children}
    </section>
  );
}

export function ExampleBar({ id }: { id: string }) {
  const lesson = useLesson();
  const example = lesson.examples.find((e) => e.id === id);
  if (!example) throw new Error(`Unknown lesson example: ${id}`);
  const loaded = lesson.activeExample === id;

  return (
    <div className="border-border flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2">
      <p className="text-small min-w-0 flex-1">
        <span className="text-fg-muted">Example: </span>
        <span className="text-fg font-medium">{example.title}</span>
        {loaded ? <span className="text-fg-muted"> (loaded)</span> : null}
      </p>
      <Button
        variant={loaded ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => lesson.loadExample(id)}
      >
        {loaded ? 'Reload this example' : 'Load this example'}
      </Button>
    </div>
  );
}
