/**
 * The address translation input: the machine (address sizes, page size, levels, TLB), the
 * page table as a compact mapping list, the page directory for two levels, and the
 * accesses to run, with hard limits. The Zod schemas and the validator are in
 * `config.schema.ts`.
 *
 * The limits keep every run small enough that each event carries a full snapshot
 * (00-overview §6.14): at most 40 accesses and 64 listed page-table entries. Pages that
 * are not listed are invalid (`valid = 0`), so a 16-bit address space doesn't need 4096
 * rows to describe.
 *
 * This file has no Zod, so a page that only shows a run never loads it (docs/UIUX.md
 * §10.5).
 */


/** Bytes per page-table entry and per page-directory entry (OSTEP §18.2 uses 4). */
export const PTE_BYTES = 4;

export const LIMITS = {
  minVaBits: 6,
  maxVaBits: 16,
  minPaBits: 6,
  maxPaBits: 16,
  /** One page-table entry: the smallest page that can hold a page-table page. */
  minPageSize: PTE_BYTES,
  maxTlb: 8,
  minAccesses: 1,
  maxAccesses: 40,
  maxPages: 64,
} as const;

export type Prot = 'r' | 'rw';
export type Op = 'read' | 'write';
export type TlbPolicy = 'lru' | 'fifo';
export type Levels = 1 | 2;

export interface VmConfig {
  /** Virtual address bits, 6..16. */
  vaBits: number;
  /** Physical address bits, 6..16. */
  paBits: number;
  /** Bytes, a power of two; at least one VPN bit and one PFN bit are left. */
  pageSize: number;
  /** 1 = a linear page table, 2 = page directory + page-table pages (OSTEP §20.3). */
  levels: Levels;
  /** TLB entries, 0..8. 0 = no TLB. */
  tlbSize: number;
  tlbPolicy: TlbPolicy;
  /**
   * Physical address of the page table (one level) or the page directory (two levels):
   * the page-table base register, called the PDBR for two levels.
   */
  ptbr: number;
}

/** One row of the page table, keyed by VPN. */
export interface PageMapping {
  vpn: number;
  valid: boolean;
  pfn: number;
  prot: Prot;
}

/** Two levels: the page-table page for directory index `index` sits in frame `pfn`. */
export interface DirectoryEntry {
  index: number;
  pfn: number;
}

export interface Access {
  va: number;
  op: Op;
}

export interface VmInput {
  config: VmConfig;
  /** Listed rows of the page table. Unlisted VPNs are invalid. */
  pages: PageMapping[];
  /**
   * Two levels: the valid page-directory entries. Unlisted indexes are invalid. Ignored
   * for one level.
   */
  directory: DirectoryEntry[];
  accesses: Access[];
}

/** Everything that follows from the config: field widths and table shapes. */
export interface Geometry {
  vaBits: number;
  paBits: number;
  pageSize: number;
  levels: Levels;
  offsetBits: number;
  vpnBits: number;
  pfnBits: number;
  /** Number of virtual pages, 2^vpnBits. */
  pages: number;
  /** Number of physical frames, 2^pfnBits. */
  frames: number;
  /** PTEs that fit in one page. */
  ptesPerPage: number;
  /** Two levels: the low VPN bits that index a page-table page. 0 for one level. */
  ptIndexBits: number;
  /** Two levels: the high VPN bits that index the page directory. 0 for one level. */
  pdIndexBits: number;
  /** Bytes of the structure PTBR points at: the linear table or the directory. */
  rootBytes: number;
}

export function log2(n: number): number {
  return Math.round(Math.log2(n));
}

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && 2 ** log2(n) === n;
}

/**
 * Field widths for a config. Expects a valid config; for two levels the table index takes
 * `log2(pageSize / PTE_BYTES)` VPN bits (one page-table page) and the directory index the
 * rest, as in OSTEP §20.3.
 */
export function geometry(config: VmConfig): Geometry {
  const offsetBits = log2(config.pageSize);
  const vpnBits = config.vaBits - offsetBits;
  const pfnBits = config.paBits - offsetBits;
  const ptesPerPage = config.pageSize / PTE_BYTES;
  const ptIndexBits = config.levels === 2 ? log2(ptesPerPage) : 0;
  const pdIndexBits = config.levels === 2 ? vpnBits - ptIndexBits : 0;
  const rootBytes =
    config.levels === 2 ? 2 ** pdIndexBits * PTE_BYTES : 2 ** vpnBits * PTE_BYTES;
  return {
    vaBits: config.vaBits,
    paBits: config.paBits,
    pageSize: config.pageSize,
    levels: config.levels,
    offsetBits,
    vpnBits,
    pfnBits,
    pages: 2 ** vpnBits,
    frames: 2 ** pfnBits,
    ptesPerPage,
    ptIndexBits,
    pdIndexBits,
    rootBytes,
  };
}

export interface ValidationIssue {
  /** Where the problem is, e.g. `['pages', 2, 'pfn']`. */
  path: (string | number)[];
  message: string;
}

/**
 * The checks one field can't make alone: everything has to fit the address sizes. Run
 * after the per-field schema, so every number is already in its absolute range.
 */
export function inputIssues(input: VmInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: (string | number)[], message: string) =>
    issues.push({ path, message });
  const { config } = input;

  if (config.pageSize * 2 > 2 ** config.vaBits) {
    add(['config', 'pageSize'], 'Page size must leave at least one VPN bit');
  }
  if (config.pageSize * 2 > 2 ** config.paBits) {
    add(['config', 'pageSize'], 'Page size must leave at least one PFN bit');
  }
  if (issues.length > 0) return issues;

  const g = geometry(config);
  const physical = 2 ** config.paBits;

  if (config.levels === 2) {
    if (g.ptIndexBits < 1) {
      add(['config', 'pageSize'], 'Two levels need a page that holds at least two PTEs');
      return issues;
    }
    if (g.pdIndexBits < 1) {
      add(
        ['config', 'pageSize'],
        'Two levels need a VPN wider than one page-table page; use one level',
      );
      return issues;
    }
  }

  if (config.ptbr % PTE_BYTES !== 0) {
    add(['config', 'ptbr'], `PTBR must be a multiple of ${PTE_BYTES}`);
  }
  if (config.ptbr + g.rootBytes > physical) {
    add(
      ['config', 'ptbr'],
      config.levels === 1
        ? `The linear page table (${g.rootBytes} bytes) must fit in physical memory after PTBR`
        : `The page directory (${g.rootBytes} bytes) must fit in physical memory after PTBR`,
    );
  }

  if (input.pages.length > LIMITS.maxPages) {
    add(['pages'], `At most ${LIMITS.maxPages} page-table rows`);
  }
  const vpns = new Set<number>();
  input.pages.forEach((page, i) => {
    if (page.vpn >= g.pages) add(['pages', i, 'vpn'], `VPN must be below ${g.pages}`);
    if (vpns.has(page.vpn)) add(['pages', i, 'vpn'], `VPN ${page.vpn} is listed twice`);
    vpns.add(page.vpn);
    if (page.pfn >= g.frames) add(['pages', i, 'pfn'], `PFN must be below ${g.frames}`);
  });

  if (config.levels === 2) {
    const indexes = new Set<number>();
    const directorySize = 2 ** g.pdIndexBits;
    input.directory.forEach((entry, i) => {
      if (entry.index >= directorySize) {
        add(['directory', i, 'index'], `Directory index must be below ${directorySize}`);
      }
      if (indexes.has(entry.index)) {
        add(['directory', i, 'index'], `Directory index ${entry.index} is listed twice`);
      }
      indexes.add(entry.index);
      if (entry.pfn >= g.frames) {
        add(['directory', i, 'pfn'], `PFN must be below ${g.frames}`);
      }
    });
    input.pages.forEach((page, i) => {
      const pd = page.vpn >> g.ptIndexBits;
      if (page.valid && page.vpn < g.pages && !indexes.has(pd)) {
        add(
          ['pages', i, 'vpn'],
          `VPN ${page.vpn} is valid but directory entry ${pd} has no page-table page`,
        );
      }
    });
  }

  input.accesses.forEach((access, i) => {
    if (access.va >= 2 ** config.vaBits) {
      add(['accesses', i, 'va'], `Address must be below ${2 ** config.vaBits}`);
    }
  });

  return issues;
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

