import { Lock, X } from 'lucide-react';

import { PTE_BYTES, type Geometry } from '@/core/vm/config';
import type { Pde, Pte } from '@/core/vm/memory';
import { cn } from '@/lib/cn';

import { hex, pteRows } from './adapters';

/**
 * The page table as it sits in physical memory: each entry with its own physical address
 * (`PTBR + VPN × 4`, or inside its page-table page for two levels), its valid, PFN and
 * protection bits, and the accessed and dirty bits the hardware sets. The entry the
 * current step reads is marked, with its address, in words as well as colour, and every
 * row says in words which page it is for (T3: "entry for page 6").
 *
 * A fault marks its row: an invalid entry gets a hatched red "invalid" mark, a write to a
 * read-only page a lock and "read-only".
 */

export interface PageTableFault {
  kind: 'invalid' | 'protection';
  /** Which table the invalid entry is in. */
  table?: 'pde' | 'pte' | undefined;
  vpn: number;
}

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
  /** The fault on this step, if any. */
  fault?: PageTableFault | null;
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

/** The static fault marks: a hatched swatch and words, never colour alone. */
function InvalidMark() {
  return (
    <span className="text-state-error inline-flex items-center gap-1 font-sans font-semibold">
      <span
        aria-hidden="true"
        className="border-state-error inline-block size-3 rounded-sm border"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, var(--danger) 0 1.5px, transparent 1.5px 4px)',
        }}
      />
      <X aria-hidden="true" className="size-3.5" />
      invalid
    </span>
  );
}

function ReadOnlyMark() {
  return (
    <span className="text-state-error inline-flex items-center gap-1 font-sans font-semibold">
      <Lock aria-hidden="true" className="size-3.5" />
      read-only
    </span>
  );
}

/** "pages 0–15" for directory entry `index`. */
function pagesUnder(g: Geometry, index: number): string {
  const first = index * 2 ** g.ptIndexBits;
  const last = first + 2 ** g.ptIndexBits - 1;
  return `pages ${first}–${last}`;
}

function Directory({
  g,
  ptbr,
  directory,
  focus,
  fault,
}: {
  g: Geometry;
  ptbr: number;
  directory: readonly Pde[];
  focus: number | null;
  fault: boolean;
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
              className={cn(
                active && 'bg-surface-overlay outline-accent outline-2',
                active && fault && 'outline-state-error',
              )}
            >
              <th scope="row" className={cn(CELL, 'font-normal')}>
                {index}{' '}
                <span className="text-caption text-fg-muted font-sans">
                  for {pagesUnder(g, index)}
                </span>
              </th>
              <td className={CELL}>{hex(ptbr + index * PTE_BYTES, g.paBits)}</td>
              <td className={CELL}>{pde ? '1' : '0'}</td>
              <td className={CELL}>{pde ? pde.pfn : '—'}</td>
              <td className={cn(CELL, 'text-accent font-sans font-semibold')}>
                {active && fault ? <InvalidMark /> : active ? 'reading' : ''}
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
  fault = null,
}: PageTableViewProps) {
  const protectionVpn = fault?.kind === 'protection' ? fault.vpn : null;
  const rows = pteRows(g, ptbr, ptes, directory, pteFocus ?? protectionVpn);
  const focusRow = rows.find((r) => r.vpn === pteFocus);
  const invalidPte = fault?.kind === 'invalid' && fault.table === 'pte';
  return (
    // Focusable, so a table wider than a phone can be scrolled from the keyboard.
    <div
      role="group"
      aria-label="Page table"
      tabIndex={0}
      className="focus-visible:outline-focus relative flex flex-col gap-4 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {g.levels === 2 ? (
        <Directory
          g={g}
          ptbr={ptbr}
          directory={directory}
          focus={pdeFocus}
          fault={fault?.kind === 'invalid' && fault.table === 'pde'}
        />
      ) : null}
      <table className="text-small w-full font-mono">
        <caption className="text-caption text-fg-muted text-left font-sans">
          {g.levels === 1
            ? `Linear page table at PTBR ${hex(ptbr, g.paBits)} (${g.pages} entries; unlisted pages are invalid)`
            : `Page-table entries, in the page-table pages the directory points at (unlisted pages are invalid)`}
        </caption>
        <thead className="font-sans">
          <tr className="text-caption text-fg-muted">
            <Head>Page (VPN)</Head>
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
            const invalid = active && invalidPte;
            const locked = vpn === protectionVpn;
            return (
              <tr
                key={vpn}
                data-vpn={vpn}
                data-active={active || undefined}
                data-fault={invalid ? 'invalid' : locked ? 'protection' : undefined}
                className={cn(
                  active && 'bg-surface-overlay outline-accent outline-2',
                  (invalid || locked) &&
                    'bg-surface-overlay outline-state-error outline-2',
                  touched && 'bg-surface-overlay',
                )}
              >
                <th scope="row" className={cn(CELL, 'font-normal whitespace-nowrap')}>
                  {vpn}{' '}
                  <span className="text-caption text-fg-muted font-sans">
                    entry for page {vpn}
                  </span>
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
                  {invalid ? (
                    <InvalidMark />
                  ) : locked ? (
                    <ReadOnlyMark />
                  ) : active ? (
                    'reading'
                  ) : touched ? (
                    'bits set'
                  ) : (
                    ''
                  )}
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
