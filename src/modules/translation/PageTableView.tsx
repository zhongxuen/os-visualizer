import { PTE_BYTES, type Geometry } from '@/core/vm/config';
import type { Pde, Pte } from '@/core/vm/memory';
import { cn } from '@/lib/cn';

import { hex, pteRows } from './adapters';

/**
 * The page table as it sits in physical memory: each entry with its own physical address
 * (`PTBR + VPN × 4`, or inside its page-table page for two levels), its valid, PFN and
 * protection bits, and the accessed and dirty bits the hardware sets. The entry the
 * current step reads is marked, with its address, in words as well as colour.
 */

export interface PageTableViewProps {
  g: Geometry;
  ptbr: number;
  ptes: readonly Pte[];
  directory: readonly Pde[];
  /** VPN whose PTE the step reads. */
  pteFocus: number | null;
  /** Directory index whose PDE the step reads. */
  pdeFocus: number | null;
  /** VPN whose accessed/dirty bits the step sets. */
  marked: number | null;
}

const CELL = 'border-border border-b px-2 py-1 text-left';

function Flag({ on }: { on: boolean }) {
  return <>{on ? '1' : '0'}</>;
}

function Head({ children }: { children: string }) {
  return (
    <th scope="col" className={CELL}>
      {children}
    </th>
  );
}

function Directory({
  g,
  ptbr,
  directory,
  focus,
}: {
  g: Geometry;
  ptbr: number;
  directory: readonly Pde[];
  focus: number | null;
}) {
  const indexes = directory.map((d) => d.index);
  if (focus !== null && !indexes.includes(focus)) indexes.push(focus);
  indexes.sort((a, b) => a - b);
  return (
    <table className="text-small w-full font-mono">
      <caption className="text-caption text-fg-muted text-left font-sans">
        Page directory at PDBR {hex(ptbr, g.paBits)} ({2 ** g.pdIndexBits} entries; only
        valid ones listed)
      </caption>
      <thead className="font-sans">
        <tr className="text-caption text-fg-muted">
          <Head>Index</Head>
          <Head>PDE address</Head>
          <Head>Valid</Head>
          <Head>PFN</Head>
          <th scope="col" className={CELL}>
            <span className="sr-only">This step</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {indexes.map((index) => {
          const pde = directory.find((d) => d.index === index);
          const active = index === focus;
          return (
            <tr
              key={index}
              data-pde={index}
              data-active={active || undefined}
              className={cn(active && 'bg-surface-overlay outline-accent outline-2')}
            >
              <th scope="row" className={cn(CELL, 'font-normal')}>
                {index}
              </th>
              <td className={CELL}>{hex(ptbr + index * PTE_BYTES, g.paBits)}</td>
              <td className={CELL}>{pde ? '1' : '0'}</td>
              <td className={CELL}>{pde ? pde.pfn : '—'}</td>
              <td className={cn(CELL, 'text-accent font-sans font-semibold')}>
                {active ? 'reading' : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PageTableView({
  g,
  ptbr,
  ptes,
  directory,
  pteFocus,
  pdeFocus,
  marked,
}: PageTableViewProps) {
  const rows = pteRows(g, ptbr, ptes, directory, pteFocus);
  const focusRow = rows.find((r) => r.vpn === pteFocus);
  return (
    <div className="flex flex-col gap-4 overflow-x-auto">
      {g.levels === 2 ? (
        <Directory g={g} ptbr={ptbr} directory={directory} focus={pdeFocus} />
      ) : null}
      <table className="text-small w-full font-mono">
        <caption className="text-caption text-fg-muted text-left font-sans">
          {g.levels === 1
            ? `Linear page table at PTBR ${hex(ptbr, g.paBits)} (${g.pages} entries; unlisted VPNs are invalid)`
            : `Page-table entries, in the page-table pages the directory points at (unlisted VPNs are invalid)`}
        </caption>
        <thead className="font-sans">
          <tr className="text-caption text-fg-muted">
            <Head>VPN</Head>
            <Head>PTE address</Head>
            <Head>Valid</Head>
            <Head>PFN</Head>
            <Head>Prot</Head>
            <Head>Accessed</Head>
            <Head>Dirty</Head>
            <th scope="col" className={CELL}>
              <span className="sr-only">This step</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ vpn, pte, address }) => {
            const active = vpn === pteFocus;
            const touched = vpn === marked;
            return (
              <tr
                key={vpn}
                data-vpn={vpn}
                data-active={active || undefined}
                className={cn(
                  active && 'bg-surface-overlay outline-accent outline-2',
                  touched && 'bg-surface-overlay',
                )}
              >
                <th scope="row" className={cn(CELL, 'font-normal')}>
                  {vpn}
                </th>
                <td className={CELL}>
                  {address === null ? '—' : hex(address, g.paBits)}
                </td>
                {pte ? (
                  <>
                    <td className={CELL}>
                      <Flag on={pte.valid} />
                    </td>
                    <td className={CELL}>{pte.valid ? pte.pfn : '—'}</td>
                    <td className={CELL}>{pte.prot}</td>
                    <td className={CELL}>
                      <Flag on={pte.accessed} />
                    </td>
                    <td className={CELL}>
                      <Flag on={pte.dirty} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className={CELL}>0</td>
                    <td colSpan={4} className={cn(CELL, 'text-fg-muted font-sans')}>
                      not mapped
                    </td>
                  </>
                )}
                <td className={cn(CELL, 'text-accent font-sans font-semibold')}>
                  {active ? 'reading' : touched ? 'bits set' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {focusRow ? (
        <p className="text-small" data-testid="pte-read">
          Reading the PTE for VPN {focusRow.vpn} at physical address{' '}
          <span className="font-mono">
            {focusRow.address === null ? '—' : hex(focusRow.address, g.paBits)}
          </span>
          {focusRow.address === null ? '' : ` (${focusRow.address})`}.
        </p>
      ) : null}
    </div>
  );
}
