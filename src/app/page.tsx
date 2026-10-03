import Link from 'next/link';

import { cn } from '@/lib/cn';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';
import { MODULES, type ModuleEntry } from '@/modules/registry';

function ModuleCard({ module: m }: { module: ModuleEntry }) {
  const ready = m.status === 'ready';
  const body = (
    <>
      <p className="text-fg-muted text-sm">
        Module {m.number}
        {m.phase === 2 ? ' · phase 2' : ''}
      </p>
      <h3 className="mt-1 text-lg font-semibold">{m.title}</h3>
      <p className="text-fg-muted mt-2 text-sm">{m.blurb}</p>
      {!ready && <p className="text-fg-muted mt-3 text-sm font-medium">Coming soon</p>}
    </>
  );

  return (
    <li
      className={cn(
        'border-border bg-surface-raised rounded-lg border',
        ready && 'hover:border-accent transition-colors',
      )}
    >
      {ready ? (
        <Link
          href={m.route}
          className="focus-visible:outline-focus block h-full rounded-lg p-5 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {body}
        </Link>
      ) : (
        <div className="h-full p-5">{body}</div>
      )}
    </li>
  );
}

export default function Home() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6"
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{SITE_NAME}</h1>
      <p className="text-fg-muted mt-3 max-w-2xl">{SITE_DESCRIPTION}</p>
      <p className="text-fg-muted mt-2 max-w-2xl text-sm">
        These are the textbook algorithms, not a real kernel.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Modules</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <ModuleCard key={m.slug} module={m} />
        ))}
      </ul>
    </main>
  );
}
