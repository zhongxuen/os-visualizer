import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * "Real systems": what real kernels do instead, described and never simulated. Every box
 * cites where the claim comes from; `docs/ACCURACY.md` lists the same sources, and
 * `tests/accuracy.test.ts` checks that it does.
 */

export interface RealSource {
  title: string;
  url: string;
}

export function RealSystems({
  sources,
  children,
}: {
  sources: readonly RealSource[];
  children: ReactNode;
}) {
  return (
    <aside
      aria-label="Real systems"
      className="border-border bg-surface-overlay flex flex-col gap-2 rounded-md border p-3"
    >
      <p className="text-fg font-semibold">Real systems</p>
      <div className="text-small flex flex-col gap-2">{children}</div>
      <ul className="text-caption flex flex-col gap-1" aria-label="Sources">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent inline-flex items-baseline gap-1 underline"
            >
              {source.title}
              <span className="sr-only"> (opens in a new tab)</span>
              <ExternalLink aria-hidden="true" className="size-3 self-center" />
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
