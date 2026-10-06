import { ArrowRight, BookA } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { isGlyphSlug, ModuleGlyph } from '@/components/ModuleGlyph';
import { cn } from '@/lib/cn';

import {
  GuidedLink,
  ProgressSummary,
  StationAction,
  StationRing,
  StationStatus,
} from './LearnProgress';
import { learnStations } from './stations';

export const metadata: Metadata = {
  title: 'Learn',
  description:
    'A learning path through every module: short guided lessons with a worked example to step through, and checkpoints that ask you to predict the next step.',
  alternates: { canonical: '/learn' },
};

/**
 * The learning path (docs/UIUX.md §4.1): a vertical path, not a card grid, because the
 * order is the point. Each station is a lesson that runs inside its module in Guided
 * mode; its ring fills as checkpoints are answered there.
 */
export default function LearnPage() {
  const stations = learnStations();
  const progressInputs = stations.map(({ lessonId, checkpointIds }) => ({
    lessonId,
    checkpointIds,
  }));
  const numbers = stations.map((station, i) =>
    station.core ? stations.slice(0, i + 1).filter((s) => s.core).length : null,
  );

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6"
    >
      <h1 className="text-title font-bold tracking-tight">Learn</h1>
      <p className="text-fg-secondary text-lead measure mt-3">
        Five stops through the course, in the order they build on each other, and one more
        after that. Each lesson runs inside its module in Guided mode: it loads an
        example, explains it a part at a time, and stops at checkpoints that ask you to
        predict the next step. Every answer comes from the same algorithm the module runs.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <ProgressSummary stations={progressInputs} />
        <p className="text-small text-fg-secondary inline-flex items-center gap-1.5">
          <BookA aria-hidden="true" className="size-4 shrink-0" />
          <span>
            New words?{' '}
            <Link
              href="/learn/glossary"
              className="text-fg font-medium underline underline-offset-2"
            >
              The glossary
            </Link>{' '}
            explains every term the lessons use.
          </span>
        </p>
      </div>

      <h2 className="sr-only">The path</h2>
      <ol className="mt-10" data-testid="learn-path">
        {stations.map((station, i) => {
          const number = numbers[i] ?? null;
          const next = stations[i + 1];
          const label = number !== null ? `Station ${number}` : 'After that';
          return (
            <li
              key={station.lessonId}
              className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0 sm:gap-x-6"
              data-station={station.slug}
            >
              {next ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-12 bottom-0 left-6 w-0 border-l',
                    next.core ? 'border-rule' : 'border-rule border-dashed',
                  )}
                />
              ) : null}
              <StationRing
                number={number}
                lessonId={station.lessonId}
                checkpointIds={station.checkpointIds}
              />
              <article
                aria-labelledby={`station-${station.slug}`}
                className="group border-border bg-surface-raised hover:border-accent focus-within:border-accent relative rounded-lg border p-5 transition-[translate,border-color] duration-(--dur-1) hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-caption text-fg-muted font-medium tracking-wide uppercase">
                      {label}
                      {i === 0 ? ' · start here' : ''}
                    </p>
                    <h3
                      id={`station-${station.slug}`}
                      className="text-lead mt-1 font-semibold"
                    >
                      <GuidedLink
                        slug={station.slug}
                        href={station.route}
                        className="focus-visible:outline-focus rounded-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {station.title}
                        <span className="sr-only">, lesson in Guided mode</span>
                      </GuidedLink>
                    </h3>
                  </div>
                  {isGlyphSlug(station.slug) ? (
                    <ModuleGlyph slug={station.slug} className="h-8 w-16 shrink-0" />
                  ) : null}
                </div>
                <p className="text-fg mt-2">{station.why}</p>
                <p className="text-small text-fg-secondary mt-1">{station.summary}</p>
                <p className="text-small text-fg-muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="num">
                    {station.parts} parts · about {station.minutes} min
                  </span>
                  <StationStatus
                    lessonId={station.lessonId}
                    checkpointIds={station.checkpointIds}
                  />
                </p>
                <p
                  aria-hidden="true"
                  className="text-small text-accent mt-3 inline-flex items-center gap-1 font-medium"
                >
                  <StationAction
                    lessonId={station.lessonId}
                    checkpointIds={station.checkpointIds}
                  />
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </p>
              </article>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
