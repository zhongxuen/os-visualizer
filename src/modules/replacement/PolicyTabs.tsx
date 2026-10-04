'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { POLICIES, POLICY_NAMES, type Policy } from '@/core/replace/input';
import { cn } from '@/lib/cn';

/**
 * One tab per policy, over the run view. A WAI-ARIA tab list: one tab in the tab order,
 * arrow keys, Home and End move between tabs and select (automatic activation). The keys
 * it handles are marked handled, so the playback shortcuts don't also take them.
 */

export const POLICY_BLURBS: Record<Policy, string> = {
  fifo: 'Evict the page loaded first.',
  lru: 'Evict the page used least recently.',
  opt: 'Evict the page needed furthest in the future.',
  clock: 'Sweep a hand over use bits; evict the first 0.',
};

export interface PolicyTabsProps {
  policy: Policy;
  onChange: (policy: Policy) => void;
  /** Faults per policy for the current string and frames, shown on each tab. */
  faults?: Record<Policy, number>;
  children: ReactNode;
  idPrefix?: string;
  className?: string;
}

export function PolicyTabs({
  policy,
  onChange,
  faults,
  children,
  idPrefix = 'policy',
  className,
}: PolicyTabsProps) {
  const refs = useRef<Partial<Record<Policy, HTMLButtonElement | null>>>({});

  const select = (next: Policy) => {
    onChange(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const i = POLICIES.indexOf(policy);
    const n = POLICIES.length;
    let next: Policy | undefined;
    if (event.key === 'ArrowRight') next = POLICIES[(i + 1) % n];
    else if (event.key === 'ArrowLeft') next = POLICIES[(i - 1 + n) % n];
    else if (event.key === 'Home') next = POLICIES[0];
    else if (event.key === 'End') next = POLICIES[n - 1];
    if (!next) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="tablist"
        aria-label="Replacement policy"
        className="border-border flex flex-wrap gap-1 border-b"
      >
        {POLICIES.map((p) => {
          const selected = p === policy;
          return (
            <button
              key={p}
              ref={(el) => {
                refs.current[p] = el;
              }}
              id={`${idPrefix}-tab-${p}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(p)}
              onKeyDown={onKeyDown}
              className={cn(
                'text-small -mb-px rounded-t-md border px-3 py-1.5 font-semibold',
                'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
                selected
                  ? 'border-border bg-surface-raised border-b-surface-raised text-fg'
                  : 'text-fg-muted hover:text-fg border-transparent',
              )}
            >
              {POLICY_NAMES[p]}
              {faults ? (
                <span className="text-caption ml-1.5 font-normal">
                  {faults[p]} {faults[p] === 1 ? 'fault' : 'faults'}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        id={`${idPrefix}-panel`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${policy}`}
        className="flex flex-col gap-4"
      >
        <p className="text-small text-fg-secondary">
          <span className="font-semibold">{POLICY_NAMES[policy]}:</span>{' '}
          {POLICY_BLURBS[policy]}
        </p>
        {children}
      </div>
    </div>
  );
}
