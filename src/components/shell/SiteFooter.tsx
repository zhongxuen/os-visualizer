import Link from 'next/link';

import { SITE_NAME } from '@/lib/site';

/** The other visualizers in the series, and this one's source. */
const SERIES = [
  {
    label: 'Internet Visualizer',
    href: 'https://github.com/zhongxuen/internet-visualizer',
  },
  { label: 'Crypto Visualizer', href: 'https://github.com/zhongxuen/crypto-visualizer' },
] as const;

const REPO_URL = 'https://github.com/zhongxuen/os-visualizer';

const link = 'text-fg-secondary hover:text-fg rounded-sm underline underline-offset-2';

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface-raised text-fg-muted text-small border-t">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-start md:justify-between">
        <p className="max-w-prose">
          {SITE_NAME} runs the textbook algorithms, not a real kernel, so the numbers
          match your textbook, not your laptop.{' '}
          <Link href="/about" className={link}>
            About and how accuracy is checked
          </Link>
        </p>
        <nav aria-label="Series and source">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li className="text-fg-muted">Part of the Visualizer Series:</li>
            {SERIES.map((s) => (
              <li key={s.href}>
                <a href={s.href} className={link}>
                  {s.label}
                </a>
              </li>
            ))}
            <li>
              <a href={REPO_URL} className={link}>
                Source on GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
