'use client';

import { useRef, type KeyboardEvent } from 'react';

import type { DlView } from '@/core/deadlock/state';
import { cn } from '@/lib/cn';

/**
 * The Graph and Banker's tabs. A WAI-ARIA tab list: one tab in the tab order; arrow keys,
 * Home and End move between tabs and select. The keys it handles are marked handled, so
 * the playback shortcuts don't also take them.
 */

export const VIEW_NAMES: Record<DlView, string> = {
  graph: 'Graph',
  bankers: 'Banker’s',
};

const ORDER: readonly DlView[] = ['graph', 'bankers'];

export const PANEL_ID = 'deadlock-panel';

export function tabId(view: DlView): string {
  return `deadlock-tab-${view}`;
}

export function ViewTabs({
  view,
  onChange,
  className,
}: {
  view: DlView;
  onChange: (view: DlView) => void;
  className?: string;
}) {
  const refs = useRef<Partial<Record<DlView, HTMLButtonElement | null>>>({});

  const select = (next: DlView) => {
    onChange(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const i = ORDER.indexOf(view);
    let next: DlView | undefined;
    if (event.key === 'ArrowRight') next = ORDER[(i + 1) % ORDER.length];
    else if (event.key === 'ArrowLeft')
      next = ORDER[(i - 1 + ORDER.length) % ORDER.length];
    else if (event.key === 'Home') next = ORDER[0];
    else if (event.key === 'End') next = ORDER.at(-1);
    if (!next) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="tablist"
      aria-label="Deadlock view"
      className={cn('border-border flex gap-1 border-b', className)}
    >
      {ORDER.map((v) => {
        const selected = v === view;
        return (
          <button
            key={v}
            ref={(el) => {
              refs.current[v] = el;
            }}
            id={tabId(v)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(v)}
            onKeyDown={onKeyDown}
            className={cn(
              'text-small -mb-px flex-1 rounded-t-md border px-3 py-1.5 font-semibold',
              'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
              selected
                ? 'border-border bg-surface-raised border-b-surface-raised text-fg'
                : 'text-fg-muted hover:text-fg border-transparent',
            )}
          >
            {VIEW_NAMES[v]}
          </button>
        );
      })}
    </div>
  );
}
