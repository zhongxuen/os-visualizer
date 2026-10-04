/**
 * Turning a translation run into what the shared blocks draw. Pure functions, no React:
 * the module renders the core's decisions, it never makes its own.
 */

import type { BitFieldPart } from '@/components/blocks/BitField';
import type { Access, Geometry, VmInput } from '@/core/vm/config';
import { PTE_BYTES } from '@/core/vm/config';
import type { VmCounters, VmEvent } from '@/core/vm/events';
import type { Pde, Pte } from '@/core/vm/memory';
import type { VmRun } from '@/core/vm/translate';

/** The event on screen at step position `step` (0-based; the end clamps to the last). */
export function eventAt(run: VmRun, step: number): VmEvent | undefined {
  if (run.events.length === 0) return undefined;
  return run.events[Math.max(0, Math.min(step, run.events.length - 1))];
}

/** `0x` and upper-case hex, padded to the digits `bits` needs. */
export function hex(n: number, bits: number): string {
  const digits = Math.max(1, Math.ceil(bits / 4));
  return `0x${n.toString(16).toUpperCase().padStart(digits, '0')}`;
}

/** An address as `0x64 (100)`. */
export function address(n: number, bits: number): string {
  return `${hex(n, bits)} (${n})`;
}

/** The virtual address fields, most significant first. */
export function vaParts(g: Geometry): BitFieldPart[] {
  if (g.levels === 2) {
    return [
      { id: 'pd', name: 'PD index', bits: g.pdIndexBits },
      { id: 'pt', name: 'PT index', bits: g.ptIndexBits },
      { id: 'offset', name: 'Offset', bits: g.offsetBits },
    ];
  }
  return [
    { id: 'vpn', name: 'VPN', bits: g.vpnBits },
    { id: 'offset', name: 'Offset', bits: g.offsetBits },
  ];
}

export function paParts(g: Geometry): BitFieldPart[] {
  return [
    { id: 'pfn', name: 'PFN', bits: g.pfnBits },
    { id: 'offset', name: 'Offset', bits: g.offsetBits },
  ];
}

/**
 * The VA field the event reads. TLB steps use the whole VPN, which is one field for one
 * level and two for two levels (so nothing single is highlighted there).
 */
export function vaHighlight(event: VmEvent | undefined, g: Geometry): string | undefined {
  if (!event) return undefined;
  const vpnField = g.levels === 1 ? 'vpn' : undefined;
  switch (event.kind) {
    case 'vm.tlbHit':
    case 'vm.tlbMiss':
    case 'vm.tlbInsert':
      return vpnField;
    case 'vm.readPde':
      return 'pd';
    case 'vm.readPte':
      return g.levels === 1 ? 'vpn' : 'pt';
    case 'vm.fault':
      if (event.table === 'pde') return 'pd';
      if (event.table === 'pte') return g.levels === 1 ? 'vpn' : 'pt';
      return undefined;
    case 'vm.physical':
    case 'vm.memory':
      return 'offset';
    default:
      return undefined;
  }
}

/** The PTE row the event reads, by VPN; `null` when the event doesn't read one. */
export function pteFocus(event: VmEvent | undefined): number | null {
  if (!event) return null;
  if (event.kind === 'vm.readPte') return event.vpn;
  if (event.kind === 'vm.fault' && event.table === 'pte') return event.vpn;
  return null;
}

/** The directory index the event reads; `null` when it doesn't read one. */
export function pdeFocus(event: VmEvent | undefined, g: Geometry): number | null {
  if (!event || g.levels !== 2) return null;
  if (
    event.kind === 'vm.readPde' ||
    (event.kind === 'vm.fault' && event.table === 'pde')
  ) {
    return event.vpn >> g.ptIndexBits;
  }
  return null;
}

/** The TLB slot the event uses; `null` when none. */
export function tlbFocus(event: VmEvent | undefined): number | null {
  if (!event || event.slot === undefined || event.slot < 0) return null;
  return event.slot;
}

export interface PteRow {
  vpn: number;
  /** `null` when the row is not listed (an invalid page the event is reading). */
  pte: Pte | null;
  /** Where the PTE sits in physical memory; `null` when its table page doesn't exist. */
  address: number | null;
}

/** Physical address of the PTE for `vpn`, or `null` (two levels, no table page). */
export function pteAddressOf(
  g: Geometry,
  ptbr: number,
  directory: readonly Pde[],
  vpn: number,
): number | null {
  if (g.levels === 1) return ptbr + vpn * PTE_BYTES;
  const pde = directory.find((d) => d.index === vpn >> g.ptIndexBits);
  if (!pde) return null;
  return pde.pfn * g.pageSize + (vpn & (2 ** g.ptIndexBits - 1)) * PTE_BYTES;
}

/**
 * The page-table rows to draw: the listed ones, plus the VPN the event is reading if it
 * isn't listed (so an unmapped page shows up as the invalid row it is).
 */
export function pteRows(
  g: Geometry,
  ptbr: number,
  ptes: readonly Pte[],
  directory: readonly Pde[],
  focus: number | null,
): PteRow[] {
  const rows: PteRow[] = ptes.map((pte) => ({
    vpn: pte.vpn,
    pte,
    address: pteAddressOf(g, ptbr, directory, pte.vpn),
  }));
  if (focus !== null && !ptes.some((p) => p.vpn === focus)) {
    rows.push({
      vpn: focus,
      pte: null,
      address: pteAddressOf(g, ptbr, directory, focus),
    });
    rows.sort((a, b) => a.vpn - b.vpn);
  }
  return rows;
}

/** Hits over lookups, as `70%`; `—` before the first lookup. */
export function hitRate(counters: VmCounters): string {
  const lookups = counters.hits + counters.misses;
  if (lookups === 0) return '—';
  return `${Math.round((counters.hits / lookups) * 1000) / 10}%`;
}

const EMPTY_COUNTERS: VmCounters = {
  accesses: 0,
  hits: 0,
  misses: 0,
  faults: 0,
  memRefs: 0,
};

export function countersAt(event: VmEvent | undefined): VmCounters {
  return event?.state.counters ?? EMPTY_COUNTERS;
}

/** Addresses print as hex from 12 bits up, where decimal stops being readable. */
export function prefersHex(vaBits: number): boolean {
  return vaBits >= 12;
}

/** The access list as text: `100, 104 w, 0x3F80`. Reads the format `parseAccesses` takes. */
export function formatAccesses(accesses: readonly Access[], vaBits: number): string {
  return accesses
    .map((a) => {
      const va = prefersHex(vaBits) ? hex(a.va, vaBits) : String(a.va);
      return a.op === 'write' ? `${va} w` : va;
    })
    .join(', ');
}

/**
 * `'100, 104 w, 0x3F80 r'` → accesses. An address alone is a read; `r`/`read` and
 * `w`/`write` after it set the operation. A bad token keeps its place as `NaN` or an
 * unknown op, so the schema reports it against the right access.
 */
export function parseAccesses(text: string): { va: number; op: string }[] {
  return text
    .split(/[,;\n]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [va = '', op = 'r', ...rest] = token.split(/\s+/);
      const parsedVa = /^(0x[0-9a-f]+|\d+)$/i.test(va)
        ? va.toLowerCase().startsWith('0x')
          ? parseInt(va.slice(2), 16)
          : Number(va)
        : Number.NaN;
      const o = op.toLowerCase();
      const parsedOp =
        rest.length > 0
          ? 'invalid'
          : o === 'r' || o === 'read'
            ? 'read'
            : o === 'w' || o === 'write'
              ? 'write'
              : 'invalid';
      return { va: parsedVa, op: parsedOp };
    });
}

/** A short summary of an input, for a heading or a status line. */
export function inputSummary(input: VmInput): string {
  const { config } = input;
  return `${config.vaBits}-bit VA, ${config.pageSize}-byte pages, ${config.levels === 2 ? 'two-level' : 'linear'} table, ${config.tlbSize === 0 ? 'no TLB' : `${config.tlbSize}-entry ${config.tlbPolicy.toUpperCase()} TLB`}`;
}
