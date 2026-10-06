'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { checkpointsDone } from '@/components/lesson/progress';
import { sharedPrefsStore } from '@/components/shell/prefs';
import { useProgress } from '@/components/state/useProgress';
import { Button } from '@/components/timeline/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';

/**
 * The parts of `/learn` that read the learner's progress. Progress lives in this
 * browser only (`osv:v1`), so the server renders every station as not started and the
 * rings fill after hydration, which is also what animates them.
 */

export interface StationProgressInput {
  lessonId: string;
  checkpointIds: readonly string[];
}

function useStation({ lessonId, checkpointIds }: StationProgressInput) {
  const { progress, isComplete } = useProgress();
  const total = checkpointIds.length;
  const done = checkpointsDone(progress.completed, lessonId, checkpointIds);
  const complete = isComplete(lessonId) || (total > 0 && done === total);
  return { done, total, complete };
}

/**
 * Opens a module in Guided mode. The workspace opens each module in the mode it was
 * last left in (`prefs.moduleModes`), so the link records Guided for it first.
 */
export function GuidedLink({
  slug,
  href,
  className,
  children,
}: {
  slug: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        const store = sharedPrefsStore();
        const modes = store.getSnapshot().moduleModes;
        if (modes[slug] !== 'walkthrough') {
          store.set('moduleModes', { ...modes, [slug]: 'walkthrough' });
        }
      }}
    >
      {children}
    </Link>
  );
}

const RADIUS = 21;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The station marker: a ring that fills with checkpoints answered, and a tick at the end. */
export function StationRing({
  number,
  ...input
}: StationProgressInput & { number: number | null }) {
  const { done, total, complete } = useStation(input);
  const fraction = total === 0 ? (complete ? 1 : 0) : done / total;

  return (
    <span
      aria-hidden="true"
      className="bg-surface relative flex size-12 shrink-0 items-center justify-center rounded-full"
      data-fraction={fraction.toFixed(2)}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-12 -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          className="stroke-border"
        />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className={cn(
            'transition-[stroke-dashoffset] duration-(--dur-3) ease-out',
            fraction > 0 ? 'stroke-accent' : 'stroke-transparent',
          )}
        />
      </svg>
      {complete ? (
        <span className="bg-accent text-accent-ink relative flex size-8 items-center justify-center rounded-full">
          <Check className="size-5" strokeWidth={2.5} />
        </span>
      ) : (
        <span className="num text-fg relative font-semibold">{number ?? '+'}</span>
      )}
    </span>
  );
}

/** "2 of 4 checkpoints" and a status pill, in words for everyone. */
export function StationStatus(input: StationProgressInput) {
  const { done, total, complete } = useStation(input);
  return (
    <>
      <span data-testid={`station-checkpoints-${input.lessonId}`} className="num">
        {done} of {total} checkpoints
      </span>
      {complete ? (
        <Pill tone="ok" icon={<Check />}>
          Complete
        </Pill>
      ) : done > 0 ? (
        <Pill tone="accent">In progress</Pill>
      ) : (
        <Pill tone="neutral">Not started</Pill>
      )}
    </>
  );
}

/** What the station's call to action says, which depends on how far in the learner is. */
export function StationAction(input: StationProgressInput) {
  const { done, complete } = useStation(input);
  return <>{complete ? 'Review' : done > 0 ? 'Continue' : 'Start'} in Guided mode</>;
}

/** The totals over every lesson, and a way to forget them. */
export function ProgressSummary({
  stations,
}: {
  stations: readonly StationProgressInput[];
}) {
  const progress = useProgress();
  const { completed } = progress.progress;
  const lessons = stations.filter(
    (s) =>
      progress.isComplete(s.lessonId) ||
      (s.checkpointIds.length > 0 &&
        checkpointsDone(completed, s.lessonId, s.checkpointIds) ===
          s.checkpointIds.length),
  ).length;
  const answered = stations.reduce(
    (sum, s) => sum + checkpointsDone(completed, s.lessonId, s.checkpointIds),
    0,
  );
  const total = stations.reduce((sum, s) => sum + s.checkpointIds.length, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-fg-secondary" data-testid="learn-progress">
        <span className="text-fg font-semibold">
          {lessons} of {stations.length} lessons complete.
        </span>{' '}
        <span className="num">
          {answered} of {total} checkpoints answered.
        </span>
      </p>
      {answered > 0 || lessons > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => progress.reset()}>
          Forget my progress
        </Button>
      ) : null}
    </div>
  );
}
