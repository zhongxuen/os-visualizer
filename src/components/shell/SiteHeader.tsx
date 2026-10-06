import Link from 'next/link';

import { SITE_NAME } from '@/lib/site';

import { KeyboardHelp, MobileMenu, ModulesMenu, NavLink } from './SiteHeaderMenus';
import { ShortcutsSheet } from './ShortcutsSheet';
import { ThemeToggle } from './ThemeToggle';

/**
 * The bar on every page (docs/UIUX.md §4.2): skip link, wordmark, a Modules menu from the
 * registry, Learn, About, the theme toggle and the keyboard-help button. Below `md` the
 * links and the toggle move into a menu sheet. Sticky, with a 1 px rule under it.
 *
 * `/demo` is a developer page and is deliberately not linked (A3).
 */
export function SiteHeader() {
  return (
    <header className="border-border bg-surface-raised sticky top-0 z-40 border-b">
      <a
        href="#main"
        className="skip-link bg-accent text-accent-ink rounded-md px-3 py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="text-fg text-lead mr-auto shrink-0 rounded-sm font-semibold tracking-tight md:mr-2"
        >
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-x-3">
            <li>
              <ModulesMenu />
            </li>
            <li>
              <NavLink href="/learn">Learn</NavLink>
            </li>
            <li>
              <NavLink href="/about">About</NavLink>
            </li>
          </ul>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <KeyboardHelp />
        </div>
        <div className="md:hidden">
          <MobileMenu />
        </div>
      </div>
      {/* Outside the `hidden` wrappers: a dialog under `display: none` never shows. */}
      <ShortcutsSheet />
    </header>
  );
}
