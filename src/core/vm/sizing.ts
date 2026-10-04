/**
 * Page-table size calculator: why multi-level page tables exist (OSTEP §20.3).
 *
 * A linear table has an entry for every virtual page, used or not: 2^VPNbits × 4 bytes.
 * A two-level table has a page directory (one entry per page-table page) plus only the
 * page-table pages that hold at least one used page. On a sparse address space that is far
 * smaller; the price is one more memory reference on every TLB miss.
 *
 * Regions are page ranges, so a 32-bit address space works without listing a million
 * pages: the needed page-table pages are counted by merging intervals.
 */

import * as z from 'zod/mini';

import { isPowerOfTwo, log2, PTE_BYTES } from './config';

export const SIZING_LIMITS = {
  minVaBits: 6,
  /** Large enough for OSTEP's 32-bit example (§18.2). */
  maxVaBits: 32,
  minPageSize: 8,
  maxRegions: 8,
  maxName: 20,
} as const;

export interface Region {
  name: string;
  /** First VPN. */
  start: number;
  /** Number of pages, at least 1. */
  pages: number;
}

export interface SizingInput {
  vaBits: number;
  pageSize: number;
  regions: Region[];
}

export interface SizingResult {
  vpnBits: number;
  offsetBits: number;
  ptesPerPage: number;
  /** VPN bits that index a page-table page. */
  ptIndexBits: number;
  /** VPN bits that index the page directory (0 when the whole table fits one page). */
  pdIndexBits: number;
  /** Virtual pages in use (the union of the regions). */
  usedPages: number;
  linearEntries: number;
  linearBytes: number;
  directoryEntries: number;
  directoryBytes: number;
  /** True when the directory itself fits in one page; otherwise a third level is needed. */
  directoryFitsInPage: boolean;
  /** Page-table pages with at least one used page. */
  tablePages: number;
  /** Page-table pages a full table would have. */
  tablePagesTotal: number;
  twoLevelBytes: number;
  /** `linearBytes - twoLevelBytes`; negative when two levels cost more. */
  savingBytes: number;
  /** Memory references to translate on a TLB miss. */
  refsPerMiss: { linear: number; twoLevel: number };
}

/** Merge `[start, end]` intervals and return their total length. */
function unionLength(intervals: readonly (readonly [number, number])[]): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let total = 0;
  let lo = -1;
  let hi = -2;
  for (const [s, e] of sorted) {
    if (s > hi + 1) {
      total += hi - lo + 1;
      lo = s;
      hi = e;
    } else if (e > hi) {
      hi = e;
    }
  }
  return total + (hi - lo + 1);
}

/** Expects valid input (`validateSizing`). */
export function pageTableSizes(input: SizingInput): SizingResult {
  const offsetBits = log2(input.pageSize);
  const vpnBits = input.vaBits - offsetBits;
  const ptesPerPage = input.pageSize / PTE_BYTES;
  const ptIndexBits = Math.min(log2(ptesPerPage), vpnBits);
  const pdIndexBits = vpnBits - ptIndexBits;

  const linearEntries = 2 ** vpnBits;
  const linearBytes = linearEntries * PTE_BYTES;
  const directoryEntries = 2 ** pdIndexBits;
  const directoryBytes = directoryEntries * PTE_BYTES;
  const perTablePage = 2 ** ptIndexBits;

  const pageRanges = input.regions.map((r) => [r.start, r.start + r.pages - 1] as const);
  const tableRanges = pageRanges.map(
    ([s, e]) => [Math.floor(s / perTablePage), Math.floor(e / perTablePage)] as const,
  );
  const usedPages = pageRanges.length ? unionLength(pageRanges) : 0;
  const tablePages = tableRanges.length ? unionLength(tableRanges) : 0;
  const twoLevelBytes = directoryBytes + tablePages * input.pageSize;

  return {
    vpnBits,
    offsetBits,
    ptesPerPage,
    ptIndexBits,
    pdIndexBits,
    usedPages,
    linearEntries,
    linearBytes,
    directoryEntries,
    directoryBytes,
    directoryFitsInPage: directoryBytes <= input.pageSize,
    tablePages,
    tablePagesTotal: directoryEntries,
    twoLevelBytes,
    savingBytes: linearBytes - twoLevelBytes,
    refsPerMiss: { linear: 1, twoLevel: 2 },
  };
}

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
}

export const REGION_SCHEMA = z.object({
  name: z.string().check(z.maxLength(SIZING_LIMITS.maxName)),
  start: int(0, 2 ** SIZING_LIMITS.maxVaBits - 1, 'First page'),
  pages: int(1, 2 ** SIZING_LIMITS.maxVaBits, 'Pages'),
});

export const SIZING_SCHEMA = z
  .object({
    vaBits: int(SIZING_LIMITS.minVaBits, SIZING_LIMITS.maxVaBits, 'Virtual address bits'),
    pageSize: int(
      SIZING_LIMITS.minPageSize,
      2 ** (SIZING_LIMITS.maxVaBits - 1),
      'Page size',
    ).check(z.refine(isPowerOfTwo, 'Page size must be a power of two')),
    regions: z
      .array(REGION_SCHEMA)
      .check(
        z.maxLength(
          SIZING_LIMITS.maxRegions,
          `At most ${SIZING_LIMITS.maxRegions} regions`,
        ),
      ),
  })
  .check(
    z.superRefine((value, ctx) => {
      if (value.pageSize * 2 > 2 ** value.vaBits) {
        ctx.addIssue({
          code: 'custom',
          message: 'Page size must leave at least one VPN bit',
          path: ['pageSize'],
          input: value,
        });
        return;
      }
      const pages = 2 ** (value.vaBits - log2(value.pageSize));
      value.regions.forEach((region, i) => {
        if (region.start + region.pages > pages) {
          ctx.addIssue({
            code: 'custom',
            message: `Region must end below page ${pages}`,
            path: ['regions', i, 'pages'],
            input: value,
          });
        }
      });
    }),
  );

export function validateSizing(input: unknown): boolean {
  return SIZING_SCHEMA.safeParse(input).success;
}
