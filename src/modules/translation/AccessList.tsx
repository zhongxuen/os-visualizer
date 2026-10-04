import type { Access, Geometry } from '@/core/vm/config';
import type { AccessResult } from '@/core/vm/events';
import { cn } from '@/lib/cn';

import { hex } from './adapters';

/**
 * Every access in the run and what it came to so far: TLB hit or miss, the physical
 * address or the fault, and the memory references it cost. Accesses still to come show
 * a dash; the one in progress is marked.
 */

export interface AccessListProps {
  g: Geometry;
  accesses: readonly Access[];
  log: readonly AccessResult[];
  current: number;
}

const CELL = 'border-border border-b px-2 py-1 text-left';

function outcome(result: AccessResult, g: Geometry): string {
  if (result.fault === 'invalid') return 'fault: invalid page';
  if (result.fault === 'protection') return 'fault: protection';
  return result.pa === null ? '—' : `PA ${hex(result.pa, g.paBits)} (${result.pa})`;
}

export function AccessList({ g, accesses, log, current }: AccessListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="text-small w-full">
        <caption className="text-caption text-fg-muted text-left">
          Accesses ({log.length} of {accesses.length} done)
        </caption>
        <thead>
          <tr className="text-caption text-fg-muted">
            <th scope="col" className={CELL}>
              #
            </th>
            <th scope="col" className={CELL}>
              VA
            </th>
            <th scope="col" className={CELL}>
              Op
            </th>
            <th scope="col" className={CELL}>
              TLB
            </th>
            <th scope="col" className={CELL}>
              Result
            </th>
            <th scope="col" className={CELL}>
              Memory refs
            </th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {accesses.map((access, i) => {
            const result = log[i];
            const active = i === current;
            return (
              <tr
                key={i}
                data-access={i}
                data-active={active || undefined}
                className={cn(active && 'bg-surface-overlay outline-accent outline-2')}
              >
                <th scope="row" className={cn(CELL, 'font-normal')}>
                  {i + 1}
                  {active ? <span className="sr-only"> (current)</span> : null}
                </th>
                <td className={CELL}>
                  {hex(access.va, g.vaBits)} ({access.va})
                </td>
                <td className={cn(CELL, 'font-sans')}>{access.op}</td>
                <td className={cn(CELL, 'font-sans')}>
                  {result ? result.tlb : active ? '…' : '—'}
                </td>
                <td
                  className={cn(
                    CELL,
                    result?.fault && 'text-state-error font-sans font-semibold',
                  )}
                >
                  {result ? outcome(result, g) : active ? 'in progress' : '—'}
                </td>
                <td className={CELL}>{result ? result.memRefs : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
