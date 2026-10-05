import type { Metadata } from 'next';
import Link from 'next/link';

import { Pill } from '@/components/ui';
import { MODULES } from '@/modules/registry';

/**
 * Any unknown URL, inside the site shell (docs/UIUX.md B5, A2): the module list and the
 * learning path, not only a link home. Next adds `noindex` to every 404 itself.
 */

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6"
    >
      <p className="num text-fg-muted text-small">404</p>
      <h1 className="text-title mt-1 font-bold tracking-tight">That page isn’t here</h1>
      <p className="text-fg-secondary text-lead mt-3">
        The address may be mistyped, or the page may have moved. Every module is listed
        below, or start with the{' '}
        <Link href="/learn" className="text-accent underline underline-offset-2">
          learning path
        </Link>
        .
      </p>

      <h2 className="mt-10 text-xl font-semibold">Modules</h2>
      <ul className="mt-4 flex flex-col gap-2">
        {MODULES.map((m) => (
          <li
            key={m.slug}
            className="border-border bg-surface-raised flex items-start gap-3 rounded-md border p-4"
          >
            <span className="num text-fg-muted" aria-hidden="true">
              {m.number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {m.status === 'ready' ? (
                  <Link
                    href={m.route}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {m.title}
                  </Link>
                ) : (
                  m.title
                )}
              </p>
              <p className="text-fg-muted text-small mt-1">{m.blurb}</p>
            </div>
            {m.status === 'ready' ? (
              <Pill tone="ok">Ready</Pill>
            ) : (
              <Pill tone="neutral">Coming later</Pill>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/learn" className="text-accent underline underline-offset-2">
          See all lessons
        </Link>
        <Link href="/" className="text-accent underline underline-offset-2">
          Back to the home page
        </Link>
      </p>
    </main>
  );
}
