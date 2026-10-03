import Link from 'next/link';

import { SITE_NAME } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface-raised text-fg-muted text-small border-t">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <p>
          {SITE_NAME}: textbook algorithms, not a real kernel.{' '}
          <Link href="/about" className="text-fg-secondary hover:text-fg underline">
            How accuracy is checked
          </Link>
        </p>
        <p>MIT licence. Part of the Visualizer Series.</p>
      </div>
    </footer>
  );
}
