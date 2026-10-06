'use client';

import { Check, X } from 'lucide-react';

import { Flash } from '@/components/motion';
import type { TlbPolicy } from '@/core/vm/config';
import type { TlbEntry } from '@/core/vm/tlb';
import { cn } from '@/lib/cn';

import { EASING, useStepMotion } from './useStepMotion';

/**
 * The TLB, one row per slot. The slot the current step hits or fills is marked in words
 * as well as colour; an eviction is named under the table.
 *
 * Motion (docs/UIUX.md §7.2.3), forward steps only: on a lookup the page number arrives
 * from the address and a scan highlight sweeps down the entries; a hit pulses green with
 * "✓ hit"; a miss marks every entry "no match"; a fill slides the new entry into its
 * slot. Each ends in a static mark, so a paused or reduced-motion frame shows it too.
 */

export interface TlbViewProps {
  slots: readonly (TlbEntry | null)[];
  policy: TlbPolicy;
  /** The slot the step uses. */
  focus: number | null;
  /** What the step did with it. */
  action?: 'hit' | 'fill' | 'check';
  evicted?: TlbEntry | undefined;
  /** The page being looked up, on the lookup step itself. */
  lookup?: { vpn: number; hit: boolean } | undefined;
  /** The step position: restarts the step motion. */
  position?: number;
}

const ACTION_TEXT = { hit: '✓ hit', fill: 'filled', check: 'checked' } as const;
const CELL = 'border-border border-b px-2 py-1 text-left';

export function TlbView({
  slots,
  policy,
  focus,
  action,
  evicted,
  lookup,
  position = 0,
}: TlbViewProps) {
  const sweep = lookup ? position : null;
  const bodyRef = useStepMotion<HTMLTableSectionElement>(sweep, (body, duration) => {
    if (sweep === null) return null;
    const rows = [...body.rows];
    const each = duration / 2;
    const gap = rows.length > 1 ? each / (rows.length - 1) : 0;
    return rows.map((row, i) =>
      row.animate(
        [
          { backgroundColor: 'color-mix(in oklab, var(--accent) 22%, transparent)' },
          { backgroundColor: getComputedStyle(row).backgroundColor },
        ],
        { duration: each, delay: i * gap, easing: EASING, fill: 'backwards' },
      ),
    );
  });
  const filled = action === 'fill' ? position : null;
  const fillRef = useStepMotion<HTMLDivElement>(filled, (root, duration) => {
    const row = root.querySelector('tr[data-active]');
    if (filled === null || !(row instanceof HTMLElement)) return null;
    return row.animate(
      [
        { transform: 'translateX(1.5rem)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration, easing: EASING },
    );
  });
  const arriveRef = useStepMotion<HTMLParagraphElement>(sweep, (chip, duration) =>
    sweep === null
      ? null
      : chip.animate(
          [
            { transform: 'translateY(-1.25rem)', opacity: 0 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: duration / 2, easing: EASING },
        ),
  );

  if (slots.length === 0) {
    return (
      <p className="text-small text-fg-muted">
        No TLB: every access walks the page table.
      </p>
    );
  }
  const miss = lookup !== undefined && !lookup.hit;
  return (
    // Focusable, so a table wider than a phone can be scrolled from the keyboard.
    <div
      ref={fillRef}
      role="group"
      aria-label="TLB"
      tabIndex={0}
      className="focus-visible:outline-focus relative flex flex-col gap-2 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <p ref={arriveRef} className="text-small min-h-6" data-testid="tlb-lookup">
        {lookup ? (
          <>
            Looking up{' '}
            <span className="border-accent rounded border px-1.5 font-mono">
              VPN {lookup.vpn}
            </span>
            :{' '}
            {lookup.hit ? (
              <span className="text-state-ok font-semibold">found, a hit</span>
            ) : (
              <span className="text-state-error font-semibold">not there, a miss</span>
            )}
          </>
        ) : null}
      </p>
      <table className="text-small w-full font-mono">
        <caption className="text-caption text-fg-muted text-left font-sans">
          {slots.length}-entry fully associative TLB, {policy.toUpperCase()} replacement
        </caption>
        <thead className="font-sans">
          <tr className="text-caption text-fg-muted">
            <th scope="col" className={CELL}>
              Slot
            </th>
            <th scope="col" className={CELL}>
              VPN
            </th>
            <th scope="col" className={CELL}>
              PFN
            </th>
            <th scope="col" className={CELL}>
              Prot
            </th>
            <th scope="col" className={CELL}>
              {policy === 'lru' ? 'Last used' : 'Loaded'}
            </th>
            <th scope="col" className={CELL}>
              <span className="sr-only">This step</span>
            </th>
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {slots.map((entry, slot) => {
            const active = slot === focus;
            const hit = active && action === 'hit';
            return (
              <tr
                key={slot}
                data-slot={slot}
                data-active={active || undefined}
                className={cn(active && 'bg-surface-overlay outline-accent outline-2')}
              >
                <th scope="row" className={cn(CELL, 'font-normal')}>
                  {slot}
                </th>
                {entry ? (
                  <>
                    <td className={CELL}>{entry.vpn}</td>
                    <td className={CELL}>{entry.pfn}</td>
                    <td className={CELL}>{entry.prot}</td>
                    <td className={CELL}>
                      access {(policy === 'lru' ? entry.lastUsed : entry.loadedAt) + 1}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className={cn(CELL, 'text-fg-muted font-sans')}>
                    empty
                  </td>
                )}
                <td
                  className={cn(
                    CELL,
                    'font-sans font-semibold',
                    hit ? 'text-state-ok' : 'text-accent',
                  )}
                >
                  {hit ? (
                    <Flash trigger={position} tone="ok" className="px-1">
                      {ACTION_TEXT.hit}
                    </Flash>
                  ) : active && action ? (
                    ACTION_TEXT[action]
                  ) : miss && entry ? (
                    <span className="text-fg-muted inline-flex items-center gap-0.5 font-normal">
                      <X aria-hidden="true" className="size-3.5" />
                      no match
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {evicted ? (
        <p className="text-caption text-fg-secondary">
          Evicted: VPN {evicted.vpn} → PFN {evicted.pfn}.
        </p>
      ) : null}
      {action === 'fill' && !evicted ? (
        <p className="text-caption text-fg-secondary inline-flex items-center gap-1">
          <Check aria-hidden="true" className="size-3.5" />
          Loaded into an empty slot.
        </p>
      ) : null}
    </div>
  );
}
