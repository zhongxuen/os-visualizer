import Link from 'next/link';

import { SITE_NAME } from '@/lib/site';
import { MODULES } from '@/modules/registry';

import { ThemeToggle } from './ThemeToggle';

/**
 * The bar on every page: skip link, the site name home, the ready modules, About, and
 * the theme toggle. Modules come from the registry, so a module appears here the moment
 * its entry is flipped to `ready`.
 */
export function SiteHeader() {
  const ready = MODULES.filter((m) => m.status === 'ready');

  return (
    <header className="border-border bg-surface-raised border-b">
      <a
        href="#main"
        className="skip-link bg-accent text-accent-ink rounded-md px-3 py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-fg text-lead rounded-sm font-semibold">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="flex-1">
          <ul className="text-small flex flex-wrap gap-x-4 gap-y-1">
            {ready.map((m) => (
              <li key={m.slug}>
                <Link
                  href={m.route}
                  className="text-fg-secondary hover:text-fg rounded-sm"
                >
                  {m.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/about" className="text-fg-secondary hover:text-fg rounded-sm">
                About
              </Link>
            </li>
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
