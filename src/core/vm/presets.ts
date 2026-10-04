/**
 * Address translation presets: the OSTEP worked examples (each also a fixture test) and
 * the classic situations (TLB thrash, an invalid page, a write to a read-only page). Every
 * preset is in the scenario catalogue, so the determinism and citation tests run it.
 */

import type { CitationId } from '../citations/types';
import type { Access, Op, PageMapping, Prot, VmConfig, VmInput } from './config';
import type { Region, SizingInput } from './sizing';

export interface VmPreset {
  id: string;
  title: string;
  /** What to look for. */
  summary: string;
  citation: CitationId;
  input: VmInput;
  /** The sizing panel's starting point. */
  sizing: SizingInput;
}

function page(vpn: number, pfn: number, prot: Prot = 'rw', valid = true): PageMapping {
  return { vpn, valid, pfn, prot };
}

function accesses(op: Op, ...vas: number[]): Access[] {
  return vas.map((va) => ({ va, op }));
}

/**
 * Sizing regions for a preset's page table: each run of consecutive valid VPNs becomes one
 * region, named by its range.
 */
export function regionsFor(pages: readonly PageMapping[]): Region[] {
  const vpns = pages
    .filter((p) => p.valid)
    .map((p) => p.vpn)
    .sort((a, b) => a - b);
  const regions: Region[] = [];
  for (const vpn of vpns) {
    const last = regions.at(-1);
    if (last && last.start + last.pages === vpn) last.pages += 1;
    else regions.push({ name: '', start: vpn, pages: 1 });
  }
  return regions.map((r) => ({
    ...r,
    name: r.pages === 1 ? `VPN ${r.start}` : `VPN ${r.start}–${r.start + r.pages - 1}`,
  }));
}

function sizingFor(config: VmConfig, pages: readonly PageMapping[]): SizingInput {
  return { vaBits: config.vaBits, pageSize: config.pageSize, regions: regionsFor(pages) };
}

/** OSTEP §19.2: ten 4-byte ints from VA 100, read in order. */
export const OSTEP_ARRAY_VAS = Array.from({ length: 10 }, (_, i) => 100 + 4 * i);

/**
 * OSTEP §19.2: an 8-bit virtual address space with 16-byte pages. The array sits on VPNs
 * 6, 7 and 8; the frames are this module's choice (the chapter doesn't give them). The
 * linear table (16 PTEs, 64 bytes) sits at PA 0, in frames 0–3.
 */
const ARRAY_CONFIG: VmConfig = {
  vaBits: 8,
  paBits: 10,
  pageSize: 16,
  levels: 1,
  tlbSize: 4,
  tlbPolicy: 'lru',
  ptbr: 0,
};
const ARRAY_PAGES = [page(6, 20), page(7, 33), page(8, 41)];

/** OSTEP §18.1: a 64-byte address space with 16-byte pages in 128 bytes of memory. */
export const OSTEP_PAGING_CONFIG: VmConfig = {
  vaBits: 6,
  paBits: 7,
  pageSize: 16,
  levels: 1,
  tlbSize: 0,
  tlbPolicy: 'lru',
  ptbr: 0,
};
/** Figure 18.2 (the page table sits in frame 0, reserved for the OS): VP 0 → PF 3, VP 1 → PF 7, VP 2 → PF 5, VP 3 → PF 2. */
export const OSTEP_PAGING_PAGES = [page(0, 3), page(1, 7), page(2, 5), page(3, 2)];

/**
 * OSTEP §20.3: a 16 KB address space with 64-byte pages (14-bit VA, 8-bit VPN). Code on
 * VPNs 0–1, heap on 4–5, stack on 254–255; the page-table pages for directory indexes 0
 * and 15 are in frames 100 and 101. The PDBR is this module's choice.
 */
export const OSTEP_TWO_LEVEL_CONFIG: VmConfig = {
  vaBits: 14,
  paBits: 14,
  pageSize: 64,
  levels: 2,
  tlbSize: 4,
  tlbPolicy: 'lru',
  ptbr: 96 * 64,
};
export const OSTEP_TWO_LEVEL_PAGES = [
  page(0, 10, 'r'),
  page(1, 23, 'r'),
  page(4, 28),
  page(5, 4),
  page(254, 55),
  page(255, 45),
];
export const OSTEP_TWO_LEVEL_DIRECTORY = [
  { index: 0, pfn: 100 },
  { index: 15, pfn: 101 },
];

const THRASH_CONFIG: VmConfig = { ...ARRAY_CONFIG, tlbSize: 4 };
const THRASH_PAGES = [page(0, 12), page(1, 13), page(2, 14), page(3, 15), page(4, 16)];
const THRASH_LOOP = [0, 16, 32, 48, 64];

const SMALL_CONFIG: VmConfig = { ...ARRAY_CONFIG, tlbSize: 2 };
/** Code (read-only), a data page, and a page that is in the table but invalid. */
const SMALL_PAGES = [page(0, 9, 'r'), page(1, 17), page(2, 25, 'rw', false)];

export const VM_PRESETS: readonly VmPreset[] = [
  {
    id: 'ostep-array',
    title: 'OSTEP array walk',
    summary:
      'Ten 4-byte ints from VA 100 on 16-byte pages: miss, hit, hit, miss, hit, hit, hit, miss, hit, hit. Spatial locality gives a 70% hit rate.',
    citation: 'ostep.19.2',
    input: {
      config: ARRAY_CONFIG,
      pages: ARRAY_PAGES,
      directory: [],
      accesses: accesses('read', ...OSTEP_ARRAY_VAS),
    },
    sizing: sizingFor(ARRAY_CONFIG, ARRAY_PAGES),
  },
  {
    id: 'ostep-array-twice',
    title: 'Same array, second pass',
    summary:
      'Walk the array again: the three pages are still in the TLB, so all ten accesses hit. Temporal locality.',
    citation: 'ostep.19.2',
    input: {
      config: ARRAY_CONFIG,
      pages: ARRAY_PAGES,
      directory: [],
      accesses: accesses('read', ...OSTEP_ARRAY_VAS, ...OSTEP_ARRAY_VAS),
    },
    sizing: sizingFor(ARRAY_CONFIG, ARRAY_PAGES),
  },
  {
    id: 'ostep-paging',
    title: 'OSTEP first translation',
    summary:
      'The chapter’s tiny machine with no TLB: VA 21 is VPN 1, offset 5; VPN 1 maps to frame 7, so the PA is 117.',
    citation: 'ostep.18.1',
    input: {
      config: OSTEP_PAGING_CONFIG,
      pages: OSTEP_PAGING_PAGES,
      directory: [],
      accesses: [{ va: 21, op: 'read' }, ...accesses('read', 0, 37, 63)],
    },
    sizing: sizingFor(OSTEP_PAGING_CONFIG, OSTEP_PAGING_PAGES),
  },
  {
    id: 'tlb-thrash',
    title: 'TLB thrash',
    summary:
      'A loop over five pages with a four-entry LRU TLB: each page is evicted just before it is needed again, so every access misses.',
    citation: 'ostep.19.6',
    input: {
      config: THRASH_CONFIG,
      pages: THRASH_PAGES,
      directory: [],
      accesses: accesses('read', ...THRASH_LOOP, ...THRASH_LOOP, ...THRASH_LOOP),
    },
    sizing: sizingFor(THRASH_CONFIG, THRASH_PAGES),
  },
  {
    id: 'invalid-page',
    title: 'Invalid page',
    summary:
      'VPN 2 is in the page table but not valid, and VPN 5 is not mapped at all. Both accesses fault and stop; neither fills the TLB.',
    citation: 'ostep.18.3',
    input: {
      config: SMALL_CONFIG,
      pages: SMALL_PAGES,
      directory: [],
      accesses: [
        { va: 0x04, op: 'read' },
        { va: 0x23, op: 'read' },
        { va: 0x18, op: 'write' },
        { va: 0x50, op: 'read' },
        { va: 0x24, op: 'read' },
      ],
    },
    sizing: sizingFor(SMALL_CONFIG, SMALL_PAGES),
  },
  {
    id: 'read-only-write',
    title: 'Write to a read-only page',
    summary:
      'VPN 0 is code, mapped read-only. Reading it is fine; writing it is a protection fault, caught on a TLB hit from the cached protection bits.',
    citation: 'ostep.19.4',
    input: {
      config: SMALL_CONFIG,
      pages: SMALL_PAGES,
      directory: [],
      accesses: [
        { va: 0x02, op: 'read' },
        { va: 0x06, op: 'write' },
        { va: 0x14, op: 'write' },
        { va: 0x0a, op: 'read' },
      ],
    },
    sizing: sizingFor(SMALL_CONFIG, SMALL_PAGES),
  },
  {
    id: 'two-level',
    title: 'Two-level walk',
    summary:
      'OSTEP’s sparse 16 KB address space: three pages of page table instead of sixteen. Each miss costs two page-table reads, PDE then PTE; VA 0x3F80 ends at PA 0x0DC0.',
    citation: 'ostep.20.3',
    input: {
      config: OSTEP_TWO_LEVEL_CONFIG,
      pages: OSTEP_TWO_LEVEL_PAGES,
      directory: OSTEP_TWO_LEVEL_DIRECTORY,
      accesses: [
        { va: 0x3f80, op: 'read' },
        { va: 0x0010, op: 'read' },
        { va: 0x0104, op: 'write' },
        { va: 0x3f84, op: 'write' },
        { va: 0x2000, op: 'read' },
        { va: 0x0048, op: 'write' },
      ],
    },
    sizing: {
      vaBits: 14,
      pageSize: 64,
      regions: [
        { name: 'code', start: 0, pages: 2 },
        { name: 'heap', start: 4, pages: 2 },
        { name: 'stack', start: 254, pages: 2 },
      ],
    },
  },
];

export const DEFAULT_PRESET: VmPreset = VM_PRESETS[0]!;

export function presetById(id: string): VmPreset | undefined {
  return VM_PRESETS.find((preset) => preset.id === id);
}
