import Link from 'next/link';

import { moduleBySlug } from '@/modules/registry';

import { LEARNING_ORDER } from './moduleMeta';

/**
 * The suggested order as a numbered rail (P6): vertical on phones, across on wide
 * screens. Each later module leans on the one before it.
 */
export function LearningOrder() {
  const sync = moduleBySlug('sync');

  return (
    <>
      <ol className="mt-6 grid gap-0 lg:grid-cols-5 lg:gap-4">
        {LEARNING_ORDER.map(({ slug, why }, i) => {
          const m = moduleBySlug(slug);
          const last = i === LEARNING_ORDER.length - 1;
          return (
            <li key={slug} className="relative flex gap-4 pb-6 lg:block lg:pb-0">
              {/* The rail: down the left on phones, along the top on wide screens. */}
              {!last ? (
                <span
                  aria-hidden="true"
                  className="bg-rule absolute top-9 bottom-0 left-[1.0625rem] w-px lg:top-[1.0625rem] lg:right-[-1rem] lg:bottom-auto lg:left-9 lg:h-px lg:w-auto"
                />
              ) : null}
              <span
                aria-hidden="true"
                className={
                  i === 0
                    ? 'num bg-accent text-accent-ink relative flex size-9 shrink-0 items-center justify-center rounded-full font-semibold'
                    : 'num border-border bg-surface-raised text-fg relative flex size-9 shrink-0 items-center justify-center rounded-full border font-semibold'
                }
              >
                {i + 1}
              </span>
              <div className="lg:mt-3">
                <p className="font-semibold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {m.status === 'ready' ? (
                    <Link href={m.route} className="text-accent hover:underline">
                      {m.title}
                    </Link>
                  ) : (
                    m.title
                  )}
                </p>
                <p className="text-small text-fg-secondary mt-1">{why}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-small text-fg-secondary mt-6">
        After that:{' '}
        {sync.status === 'ready' ? (
          <Link href={sync.route} className="text-accent hover:underline">
            {sync.title}
          </Link>
        ) : (
          sync.title
        )}
        , where two threads race on shared data and a lock puts it right.
      </p>
    </>
  );
}
