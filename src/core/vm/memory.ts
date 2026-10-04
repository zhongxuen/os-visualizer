/**
 * The page tables as data. The tables sit in physical memory, so every entry has a
 * physical address: `PTBR + VPN × 4` for a linear table (OSTEP §18.4), and for two levels
 * `PDBR + PDindex × 4` for the directory entry and `PDE.PFN × pageSize + PTindex × 4` for
 * the page-table entry (OSTEP §20.3).
 *
 * Only the listed rows are stored; an unlisted VPN or directory index is invalid. Every
 * function here returns new values, so a snapshot can share them safely.
 */

import {
  geometry,
  PTE_BYTES,
  type DirectoryEntry,
  type Geometry,
  type PageMapping,
  type Prot,
  type VmConfig,
  type VmInput,
} from './config';

export interface Pte {
  vpn: number;
  valid: boolean;
  pfn: number;
  prot: Prot;
  /** Set by the hardware on an access (x86-style). */
  accessed: boolean;
  /** Set by the hardware on a write. */
  dirty: boolean;
}

/** A valid page-directory entry: the page-table page for `index` is in frame `pfn`. */
export interface Pde {
  index: number;
  pfn: number;
}

export interface PageTables {
  levels: 1 | 2;
  /** Physical address of the linear table or of the page directory. */
  ptbr: number;
  /** Listed page-table rows, sorted by VPN. */
  ptes: Pte[];
  /** Valid directory entries, sorted by index. Empty for one level. */
  directory: Pde[];
}

/** A virtual address split into its fields. */
export interface VaFields {
  va: number;
  vpn: number;
  offset: number;
  /** Two levels: the directory index (high VPN bits). Equals `vpn` for one level. */
  pdIndex: number;
  /** Two levels: the table index (low VPN bits). Equals `vpn` for one level. */
  ptIndex: number;
}

export function buildTables(input: VmInput): PageTables {
  return {
    levels: input.config.levels,
    ptbr: input.config.ptbr,
    ptes: [...input.pages]
      .sort((a, b) => a.vpn - b.vpn)
      .map((page) => ({ ...page, accessed: false, dirty: false })),
    directory:
      input.config.levels === 2
        ? [...input.directory]
            .sort((a, b) => a.index - b.index)
            .map(({ index, pfn }) => ({ index, pfn }))
        : [],
  };
}

export function splitVa(g: Geometry, va: number): VaFields {
  const vpn = va >> g.offsetBits;
  const offset = va & (g.pageSize - 1);
  if (g.levels === 1) return { va, vpn, offset, pdIndex: vpn, ptIndex: vpn };
  return {
    va,
    vpn,
    offset,
    pdIndex: vpn >> g.ptIndexBits,
    ptIndex: vpn & (2 ** g.ptIndexBits - 1),
  };
}

/** The listed row for `vpn`, or `null` (an unlisted VPN is invalid). */
export function findPte(tables: PageTables, vpn: number): Pte | null {
  return tables.ptes.find((pte) => pte.vpn === vpn) ?? null;
}

/** The valid directory entry for `index`, or `null` (invalid). */
export function findPde(tables: PageTables, index: number): Pde | null {
  return tables.directory.find((pde) => pde.index === index) ?? null;
}

/** Two levels: where the directory entry for `pdIndex` sits. */
export function pdeAddress(tables: PageTables, pdIndex: number): number {
  return tables.ptbr + pdIndex * PTE_BYTES;
}

/**
 * Where the PTE for `fields` sits. One level: `PTBR + VPN × 4`. Two levels: inside the
 * page-table page the directory entry points at.
 */
export function pteAddress(
  g: Geometry,
  tables: PageTables,
  fields: VaFields,
  pde: Pde | null,
): number {
  if (g.levels === 1) return tables.ptbr + fields.vpn * PTE_BYTES;
  if (!pde) throw new Error('A two-level PTE address needs its directory entry');
  return pde.pfn * g.pageSize + fields.ptIndex * PTE_BYTES;
}

/** `pfn << offsetBits | offset`. */
export function physicalAddress(g: Geometry, pfn: number, offset: number): number {
  return pfn * g.pageSize + offset;
}

/** A copy of `tables` with the hardware bits of `vpn` set for an access. */
export function markAccess(tables: PageTables, vpn: number, write: boolean): PageTables {
  return {
    ...tables,
    ptes: tables.ptes.map((pte) =>
      pte.vpn === vpn ? { ...pte, accessed: true, dirty: pte.dirty || write } : pte,
    ),
  };
}

/**
 * A page directory for a mapping list: one page-table page for every directory index that
 * has a valid page, placed in the highest frames that no page (valid or not) uses and that
 * don't overlap the directory itself. Deterministic, so switching a run to two levels
 * gives the same tables every time. Returns `[]` for one level or when frames run out.
 */
export function directoryFor(
  config: VmConfig,
  pages: readonly PageMapping[],
): DirectoryEntry[] {
  if (config.levels !== 2) return [];
  const g = geometry(config);
  const needed = [
    ...new Set(pages.filter((p) => p.valid).map((p) => p.vpn >> g.ptIndexBits)),
  ].sort((a, b) => a - b);

  const used = new Set(pages.map((p) => p.pfn));
  const rootFirst = Math.floor(config.ptbr / g.pageSize);
  const rootLast = Math.floor((config.ptbr + g.rootBytes - 1) / g.pageSize);
  for (let f = rootFirst; f <= rootLast; f++) used.add(f);

  const directory: DirectoryEntry[] = [];
  let frame = g.frames - 1;
  for (const index of needed) {
    while (frame >= 0 && used.has(frame)) frame--;
    if (frame < 0) return [];
    directory.push({ index, pfn: frame });
    used.add(frame);
  }
  return directory;
}
