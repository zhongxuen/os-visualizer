import type { Metadata } from 'next';
import Link from 'next/link';

import { GLOSSARY } from '@/content/glossary';
import { MODULES } from '@/modules/registry';

import { GlossaryList, type GlossaryItem } from './GlossaryList';

export const metadata: Metadata = {
  title: 'Glossary',
  description:
    'Every term the OS Visualizer lessons use, from tick and quantum to TLB, use bit and safe sequence, in plain words, with the modules it appears in.',
  alternates: { canonical: '/learn/glossary' },
};

/**
 * `/learn/glossary` (docs/UIUX.md §4.1): the glossary `<Term>` reads, A to Z, searchable,
 * each term linking to the modules it appears in. The list is worked out here and the
 * client only filters it.
 */
export default function GlossaryPage() {
  const modules = new Map(MODULES.map((m) => [m.slug, m]));
  const items: GlossaryItem[] = [...GLOSSARY]
    .sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))
    .map((entry) => ({
      id: entry.id,
      term: entry.term,
      short: entry.short,
      long: entry.long,
      modules: entry.modules.flatMap((slug) => {
        const m = modules.get(slug);
        return m && m.status === 'ready' ? [{ title: m.title, route: m.route }] : [];
      }),
    }));

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6"
    >
      <p className="text-small">
        <Link href="/learn" className="text-fg-secondary underline underline-offset-2">
          Back to the learning path
        </Link>
      </p>
      <h1 className="text-title mt-2 font-bold tracking-tight">Glossary</h1>
      <p className="text-fg-secondary text-lead measure mt-3">
        Every term the lessons and modules use, in plain words. The same definitions
        appear when you hover, tap or tab to an underlined term anywhere on the site.
      </p>
      <GlossaryList items={items} />
    </main>
  );
}
