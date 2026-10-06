'use client';

import { DrawPath, Ticker, useStepTransition } from '@/components/motion';
import type { Geometry } from '@/core/vm/config';
import type { VmEvent } from '@/core/vm/events';
import { cn } from '@/lib/cn';

import { hex } from './adapters';

/**
 * The page-table walk as hops (docs/UIUX.md §7.2.3): PTBR → PTE for one level, PDBR →
 * PDE → PTE for two. Each hop is a memory reference; an arrow draws in as the walk
 * reaches it, and the access's memory-reference counter rolls up by one (`Ticker`).
 *
 * Built from the current access's events so far, so it never shows a hop before the
 * core has made it. On a TLB hit there is no walk, and it says so.
 */

export interface Hop {
  id: 'root' | 'pde' | 'pte';
  label: string;
  /** The physical address read, for a PDE or PTE hop. */
  address?: number;
  /** The read found an invalid entry: the walk stops here. */
  invalid?: boolean;
  /** The event index that made this hop. */
  at: number;
}

export interface Walk {
  hit: boolean;
  /** Has the walk started (a miss has been decided)? */
  started: boolean;
  hops: Hop[];
  /** Memory references this access has made so far. */
  refs: number;
}

/** The current access's walk, read off the run's events up to `index`. */
export function walkAt(
  events: readonly VmEvent[],
  index: number,
  g: Geometry,
  ptbr: number,
): Walk | null {
  if (events.length === 0) return null;
  const at = Math.max(0, Math.min(index, events.length - 1));
  const access = events[at]!.access;
  const firstOfAccess = events.findIndex((e) => e.access === access);
  const hops: Hop[] = [];
  let hit = false;
  let started = false;
  let refs = 0;
  for (let i = firstOfAccess; i <= at; i += 1) {
    const e = events[i]!;
    if (e.kind === 'vm.tlbHit') hit = true;
    if (e.kind === 'vm.tlbMiss') {
      started = true;
      hops.push({
        id: 'root',
        label:
          g.levels === 2 ? `PDBR ${hex(ptbr, g.paBits)}` : `PTBR ${hex(ptbr, g.paBits)}`,
        at: i,
      });
    }
    const reads =
      e.kind === 'vm.readPde' ||
      e.kind === 'vm.readPte' ||
      (e.kind === 'vm.fault' && e.table !== undefined);
    if (reads) {
      refs += 1;
      const pde = e.kind === 'vm.readPde' || (e.kind === 'vm.fault' && e.table === 'pde');
      hops.push({
        id: pde ? 'pde' : 'pte',
        label: pde ? 'PDE' : 'PTE',
        ...(e.address !== undefined ? { address: e.address } : {}),
        invalid: e.kind === 'vm.fault',
        at: i,
      });
    }
    if (e.kind === 'vm.memory') refs += 1;
  }
  return { hit, started, hops, refs };
}

export interface WalkPathProps {
  walk: Walk | null;
  g: Geometry;
  /** The event index on screen. */
  position: number;
}

export function WalkPath({ walk, g, position }: WalkPathProps) {
  const { direction } = useStepTransition();
  if (!walk) return null;
  return (
    <div className="flex flex-col gap-2" data-walk="">
      <div className="flex flex-wrap items-center gap-y-2">
        {walk.hit ? (
          <p className="text-small text-fg-secondary">
            No walk: the TLB already had this page, so the page table isn’t read.
          </p>
        ) : !walk.started ? (
          <p className="text-small text-fg-muted">The walk starts on a TLB miss.</p>
        ) : (
          <ol
            aria-label="Page-table walk"
            className="flex flex-wrap items-center gap-y-2"
          >
            {walk.hops.map((hop, i) => (
              <li key={hop.id} className="flex items-center" data-hop={hop.id}>
                {i > 0 ? (
                  <svg aria-hidden="true" viewBox="0 0 32 12" className="mx-1 h-3 w-8">
                    <DrawPath
                      d="M1 6 H27 M23 2 L28 6 L23 10"
                      trigger={hop.at}
                      active={hop.at === position && direction === 'forward'}
                      stroke={hop.invalid ? 'var(--danger)' : 'var(--accent)'}
                      strokeWidth={1.75}
                      fill="none"
                    />
                  </svg>
                ) : null}
                {i > 0 ? <span className="sr-only">then </span> : null}
                <span
                  className={cn(
                    'text-small rounded-md border px-2 py-0.5 font-mono',
                    hop.invalid
                      ? 'border-state-error text-state-error font-semibold'
                      : 'border-border',
                    hop.at === position && !hop.invalid && 'border-accent border-2',
                  )}
                >
                  {hop.label}
                  {hop.address !== undefined ? ` at ${hex(hop.address, g.paBits)}` : ''}
                  {hop.invalid ? ' (invalid)' : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="text-small">
        Memory references for this access so far:{' '}
        <Ticker value={walk.refs} className="font-semibold" />
      </p>
    </div>
  );
}
