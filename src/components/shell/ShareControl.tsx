'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { buttonClasses } from '@/components/timeline/ui/Button';
import { cn } from '@/lib/cn';

/**
 * "Saved in this link · Copy link" (docs/UIUX.md §4.2, G15): tells a beginner that the
 * workload they built lives in the URL, and copies it.
 *
 * Every module keeps its input in `?s=` through `useShareState`, which writes the address
 * bar as the input changes, so by default this copies the address bar. A module that has
 * the hook's `link()` and `shareable` can pass them, which writes the URL at once and
 * says so when the input is too large for a link.
 */

export interface ShareControlProps {
  /** Write the link now and return it (`useShareState().link`). Defaults to the address bar. */
  link?: () => string | null;
  /** False when the input is too large for a link (`useShareState().shareable`). */
  shareable?: boolean;
  className?: string;
}

type CopyState = 'idle' | 'copied' | 'manual' | 'too-large';

const MESSAGES: Record<CopyState, string> = {
  idle: '',
  copied: 'Link copied.',
  manual: 'Copy the link from the address bar.',
  'too-large': 'This input is too large for a link.',
};

export function ShareControl({ link, shareable = true, className }: ShareControlProps) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const report = (next: CopyState) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 4000);
  };

  const copy = async () => {
    const url = link ? link() : window.location.href;
    if (!url) {
      report('too-large');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      report('copied');
    } catch {
      report('manual');
    }
  };

  return (
    <div data-share-control="" className={cn('flex items-center gap-2', className)}>
      <span className="text-fg-muted text-caption max-sm:sr-only">
        {shareable ? 'Saved in this link' : 'Too large for a link'}
      </span>
      <button
        type="button"
        onClick={copy}
        // The visible words lead the name (WCAG 2.5.3); the rest tells it apart from a
        // module's own "Copy link" in its Setup panel.
        aria-label="Copy link to this page"
        className={buttonClasses({
          variant: 'secondary',
          size: 'sm',
          className: 'gap-1.5',
        })}
      >
        {state === 'copied' ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Link2 aria-hidden="true" className="size-4" />
        )}
        Copy link
      </button>
      <span role="status" className="sr-only">
        {MESSAGES[state]}
      </span>
    </div>
  );
}
