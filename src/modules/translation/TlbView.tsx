import type { TlbPolicy } from '@/core/vm/config';
import type { TlbEntry } from '@/core/vm/tlb';
import { cn } from '@/lib/cn';

/**
 * The TLB, one row per slot. The slot the current step hits or fills is marked in words
 * as well as colour; an eviction is named under the table.
 */

export interface TlbViewProps {
  slots: readonly (TlbEntry | null)[];
  policy: TlbPolicy;
  /** The slot the step uses. */
  focus: number | null;
  /** What the step did with it. */
  action?: 'hit' | 'fill' | 'check';
  evicted?: TlbEntry | undefined;
}

const ACTION_TEXT = { hit: 'hit', fill: 'filled', check: 'checked' } as const;
const CELL = 'border-border border-b px-2 py-1 text-left';

export function TlbView({ slots, policy, focus, action, evicted }: TlbViewProps) {
  if (slots.length === 0) {
    return (
      <p className="text-small text-fg-muted">
        No TLB: every access walks the page table.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
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
        <tbody>
          {slots.map((entry, slot) => {
            const active = slot === focus;
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
                <td className={cn(CELL, 'text-accent font-sans font-semibold')}>
                  {active && action ? ACTION_TEXT[action] : ''}
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
    </div>
  );
}
