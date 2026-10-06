'use client';

import { MousePointerClick } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { UNIT_MS, type RunUnit } from '@/core/events/builder';

import { Button } from '../timeline/ui/Button';
import { useLesson } from './LessonContext';
import { usePartExample } from './LessonStep';

/**
 * "Try it" (docs/UIUX.md §7.3): one thing to do with the picture, and a button that does
 * the setting up. It loads the part's example if another is showing, moves the timeline
 * to the right moment, paused, and scrolls the picture into view.
 *
 * The timeline's checkpoint hold still applies: a "Try it" past an unanswered checkpoint
 * stops at the checkpoint, which is the point of asking first.
 */

export type TryItTarget = number | 'start' | 'end';

export function tryItLabel(at: TryItTarget, unit: RunUnit): string {
  if (at === 'start') return 'Go to the start';
  if (at === 'end') return 'Go to the end';
  return unit === 'tick' ? `Go to t = ${at}` : `Go to step ${at}`;
}

export function TryIt({
  at,
  example: exampleProp,
  children,
}: {
  /** Whole ticks or steps, or either end of the run. */
  at: TryItTarget;
  /** Defaults to the example of the part it is in. */
  example?: string;
  children: ReactNode;
}) {
  const lesson = useLesson();
  const partExample = usePartExample();
  const example = exampleProp ?? partExample;
  const loaded = !example || lesson.activeExample === example;
  const [queued, setQueued] = useState(false);
  const { store, unit, reveal, engage } = lesson;

  // After a load the module hands the store its new run in its own effects, which run
  // after this component's; wait a frame so the seek lands on the new run.
  useEffect(() => {
    if (!queued || !loaded) return;
    const frame = requestAnimationFrame(() => {
      const actions = store.getState();
      actions.pause();
      if (at === 'start' || at === 'end') actions.jumpTo(at);
      else actions.seek(at * UNIT_MS[unit]);
      reveal();
      setQueued(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [queued, loaded, at, store, unit, reveal]);

  const go = () => {
    if (example && !loaded) lesson.loadExample(example);
    else engage();
    setQueued(true);
  };

  return (
    <div
      className="border-accent/60 bg-surface flex flex-col gap-2 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
      data-try-it=""
    >
      <div className="text-small min-w-0 flex-1 [&_p]:inline">
        <span className="text-accent inline-flex items-center gap-1 font-semibold">
          <MousePointerClick aria-hidden="true" className="size-4" />
          Try it:
        </span>{' '}
        {children}
      </div>
      <Button size="sm" variant="secondary" onClick={go} className="self-start">
        {tryItLabel(at, unit)}
      </Button>
    </div>
  );
}
