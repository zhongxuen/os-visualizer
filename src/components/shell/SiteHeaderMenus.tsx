'use client';

import { Keyboard, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Pill, Popover, Sheet, focusRing } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MODULES, type ModuleEntry } from '@/modules/registry';

import { requestShortcuts, useShortcutsOpen } from './ShortcutsSheet';
import { ThemeToggle } from './ThemeToggle';

/**
 * The header's interactive parts: the Modules menu, the keyboard-help button and the
 * phone menu sheet. `SiteHeader` itself stays a Server Component.
 */

// The shortcuts action lives with the sheet; re-exported for existing callers.
export { requestShortcuts, SHORTCUTS_EVENT } from './ShortcutsSheet';

const navLink =
  'text-fg-secondary hover:text-fg aria-[current=page]:text-fg min-h-target-floor inline-flex items-center rounded-sm px-1 text-small font-medium aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[6px]';

/** Status in words: the registry's `phase` is roadmap vocabulary and never shown (P4). */
function StatusPill({ module }: { module: ModuleEntry }) {
  return module.status === 'ready' ? (
    <Pill tone="ok">Ready</Pill>
  ) : (
    <Pill tone="neutral">Coming later</Pill>
  );
}

/** Every registry module, numbered, with its status. Planned modules are not links. */
function ModuleList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {MODULES.map((m) => {
        const row = (
          <>
            <span className="num text-fg-muted w-4 text-right" aria-hidden="true">
              {m.number}
            </span>
            <span className="text-fg flex-1 font-medium">{m.title}</span>
            <StatusPill module={m} />
          </>
        );
        const rowClass =
          'min-h-target-floor flex items-center gap-3 rounded-md px-2 py-1.5 text-small';
        return (
          <li key={m.slug}>
            {m.status === 'ready' ? (
              <Link
                href={m.route}
                onClick={onNavigate}
                aria-current={pathname === m.route ? 'page' : undefined}
                className={cn(
                  rowClass,
                  'hover:bg-surface-raised aria-[current=page]:bg-surface-raised',
                  focusRing,
                )}
              >
                {row}
              </Link>
            ) : (
              <div className={rowClass}>{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A top-level nav link that marks the current page. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      aria-current={pathname === href ? 'page' : undefined}
      className={cn(navLink, focusRing)}
    >
      {children}
    </Link>
  );
}

export function ModulesMenu() {
  return (
    <Popover
      trigger="Modules"
      triggerVariant="unstyled"
      triggerClassName={cn(navLink, 'cursor-pointer aria-expanded:text-fg')}
      align="start"
      className="w-[min(22rem,calc(100vw_-_1rem))] max-w-none p-1.5"
    >
      {({ close }) => (
        <nav aria-label="Modules">
          <ModuleList onNavigate={close} />
        </nav>
      )}
    </Popover>
  );
}

/**
 * The header's keyboard-help button. It opens the `ShortcutsSheet` (which the header
 * mounts once) through the shared action, so the button and `?` are one path.
 */
export function KeyboardHelp() {
  const open = useShortcutsOpen();
  return (
    <button
      type="button"
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts (?)"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={requestShortcuts}
      className={cn(
        'text-fg-secondary hover:bg-surface-overlay hover:text-fg size-target inline-flex items-center justify-center rounded-md',
        focusRing,
      )}
    >
      <Keyboard aria-hidden="true" className="size-4" strokeWidth={1.75} />
    </button>
  );
}

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          'text-fg-secondary hover:bg-surface-overlay hover:text-fg size-target inline-flex items-center justify-center gap-1.5 rounded-md',
          focusRing,
        )}
      >
        <Menu aria-hidden="true" className="size-5" strokeWidth={1.75} />
        <span className="sr-only">Menu</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu" side="right">
        {open ? (
          <div className="flex flex-col gap-6">
            <nav aria-label="Site" className="flex flex-col gap-4">
              <div>
                <h3 className="text-fg-muted text-caption mb-1 px-2 font-semibold tracking-wide uppercase">
                  Modules
                </h3>
                <ModuleList onNavigate={() => setOpen(false)} />
              </div>
              <ul className="flex flex-col gap-0.5">
                {[
                  { href: '/learn', label: 'Learn' },
                  { href: '/about', label: 'About' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'text-fg hover:bg-surface-raised min-h-target-floor text-small flex items-center rounded-md px-2 font-medium',
                        focusRing,
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <ThemeToggle className="self-start" />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
