import { Info } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

/**
 * The one-line honesty notice on every module page (aim 5). The full disclaimers and the
 * conventions chosen where textbooks disagree are on /about.
 */
export function DisclaimerBanner({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Disclaimer"
      className={cn(
        'border-border bg-surface-overlay text-fg-secondary text-small flex items-start gap-2 rounded-md border px-3 py-2',
        className,
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        Textbook algorithms, not a real kernel.{' '}
        <Link href="/about" className="text-fg font-medium underline">
          What this models and what it leaves out
        </Link>
      </p>
    </aside>
  );
}
