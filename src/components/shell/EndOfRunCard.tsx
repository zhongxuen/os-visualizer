'use client';

import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { LEARNING_ORDER } from '@/components/home/moduleMeta';
import { buttonClasses } from '@/components/timeline/ui/Button';
import { cn } from '@/lib/cn';
import { MODULES } from '@/modules/registry';

/**
 * The end-of-run card (docs/UIUX.md §4.2, G16), so no module is a dead end: the result in
 * one sentence, "Try this next" (a preset that contrasts with this run), and the next
 * module in the learning order.
 *
 * `ModuleLayout` shows it when the run reaches its end, from its `endOfRun` prop. Every
 * part is optional: with nothing passed it still offers "Play again" and the next module.
 */

export interface TryNext {
  /** The preset's name, as the button reads: "SJF on the same workload". */
  label: string;
  /** One line on why it contrasts with this run. */
  why?: ReactNode;
  /** Load it. The card does not know how; the module does. */
  onSelect: () => void;
}

export interface NextModule {
  href: string;
  title: string;
}

/** What a module puts on its card (`ModuleLayout`'s `endOfRun` prop). */
export interface EndOfRunContent {
  /** The result in one sentence: "Average waiting time 7 ticks; P4 ran first." */
  result?: ReactNode;
  tryNext?: TryNext;
  /** The next module. Defaults to the next one in the learning order; `null` hides it. */
  next?: NextModule | null;
}

export interface EndOfRunCardProps extends EndOfRunContent {
  /** The module this run belongs to, for the default `next`. */
  moduleId?: string;
  /** "Play again". Omitted, there is no replay button. */
  onReplay?: () => void;
  className?: string;
}

/**
 * The module after `slug` in the learning order (home page, P6), if it is ready. A
 * module outside the order, or the last one, gets the learning path instead.
 */
export function nextModuleAfter(slug: string | undefined): NextModule | null {
  const index = LEARNING_ORDER.findIndex((step) => step.slug === slug);
  if (index === -1) return null;
  for (const step of LEARNING_ORDER.slice(index + 1)) {
    const entry = MODULES.find((m) => m.slug === step.slug && m.status === 'ready');
    if (entry) return { href: entry.route, title: entry.title };
  }
  return null;
}

export function EndOfRunCard({
  result,
  tryNext,
  next,
  moduleId,
  onReplay,
  className,
}: EndOfRunCardProps) {
  const nextModule = next === undefined ? nextModuleAfter(moduleId) : next;

  return (
    <section
      aria-labelledby="end-of-run-heading"
      data-end-of-run=""
      className={cn(
        'border-accent bg-surface-raised flex flex-col gap-3 rounded-lg border-2 p-4',
        className,
      )}
    >
      <h2 id="end-of-run-heading" className="text-lead font-semibold">
        End of the run
      </h2>
      <p className="text-fg">
        {result ?? 'The whole run is on screen. Step back to revisit any part.'}
      </p>
      {tryNext ? (
        <div className="flex flex-col gap-1">
          <p className="text-fg-muted text-caption font-semibold tracking-wide uppercase">
            Try this next
          </p>
          <button
            type="button"
            onClick={tryNext.onSelect}
            className={buttonClasses({
              variant: 'secondary',
              className: 'justify-start gap-2 self-start',
            })}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {tryNext.label}
          </button>
          {tryNext.why ? (
            <p className="text-fg-secondary text-small">{tryNext.why}</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {onReplay ? (
          <button
            type="button"
            onClick={onReplay}
            className={buttonClasses({ variant: 'ghost', className: 'gap-2' })}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Play again
          </button>
        ) : null}
        {nextModule ? (
          <Link
            href={nextModule.href}
            className={buttonClasses({ variant: 'primary', className: 'gap-2' })}
          >
            Next: {nextModule.title}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <Link
            href="/learn"
            className={buttonClasses({ variant: 'secondary', className: 'gap-2' })}
          >
            Back to the learning path
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    </section>
  );
}
