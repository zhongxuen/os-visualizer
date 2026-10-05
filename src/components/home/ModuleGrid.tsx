import Link from 'next/link';

import { isGlyphSlug, ModuleGlyph } from '@/components/ModuleGlyph';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';
import { MODULES, type ModuleEntry } from '@/modules/registry';

import { CHAPTERS } from './moduleMeta';

/**
 * One card per registry module: picture, status, title, blurb and chapters.
 *
 * Only the heading is a link (B10), so a screen reader announces the module's name and
 * nothing else; its `::after` is stretched over the card so the whole card is still the
 * hit area. The card draws the focus ring for it.
 */
function ModuleCard({ module: m }: { module: ModuleEntry }) {
  const ready = m.status === 'ready';

  return (
    <li
      className={cn(
        'group panel relative flex flex-col p-5',
        ready &&
          'hover:border-accent has-[a:focus-visible]:outline-focus transition-[translate,border-color] hover:-translate-y-0.5 has-[a:focus-visible]:-translate-y-0.5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {isGlyphSlug(m.slug) ? <ModuleGlyph slug={m.slug} /> : <span />}
        {ready ? <Pill tone="ok">Ready</Pill> : <Pill tone="neutral">Coming later</Pill>}
      </div>

      <h3 className="text-lead mt-4 font-semibold">
        {ready ? (
          <Link
            href={m.route}
            className="text-fg hover:text-accent after:absolute after:inset-0 after:rounded-[var(--radius-panel)] after:content-[''] focus-visible:outline-none"
          >
            {m.title}
          </Link>
        ) : (
          m.title
        )}
      </h3>
      <p className="text-small text-fg-secondary mt-2 flex-1">{m.blurb}</p>
      {CHAPTERS[m.slug] ? (
        <p className="text-caption text-fg-muted mt-4">{CHAPTERS[m.slug]}</p>
      ) : null}
    </li>
  );
}

export function ModuleGrid() {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MODULES.map((m) => (
        <ModuleCard key={m.slug} module={m} />
      ))}
    </ul>
  );
}
