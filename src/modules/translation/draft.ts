/**
 * The editors' working copy of a `VmInput`. Fields keep what you type, as text; every
 * change is validated with the core's schema, and only a valid input leaves the editor.
 * Until then the schema's messages show next to the field they are about.
 */

import {
  geometry,
  isPowerOfTwo,
  LIMITS,
  validateVmInput,
  type Levels,
  type Prot,
  type TlbPolicy,
  type ValidationIssue,
  type VmInput,
} from '@/core/vm/config';
import { directoryFor } from '@/core/vm/memory';

import { formatAccesses, parseAccesses } from './adapters';
import { parseNumber } from './fields';

export interface ConfigDraft {
  vaBits: string;
  paBits: string;
  pageSize: string;
  levels: '1' | '2';
  tlbSize: string;
  tlbPolicy: TlbPolicy;
  ptbr: string;
}

export interface PageDraft {
  /** Stable React key; not part of the input. */
  key: number;
  vpn: string;
  valid: boolean;
  pfn: string;
  prot: Prot;
}

export interface DirectoryDraft {
  key: number;
  index: string;
  pfn: string;
}

export interface VmDraft {
  config: ConfigDraft;
  pages: PageDraft[];
  directory: DirectoryDraft[];
  accesses: string;
}

let nextKey = 1;
export function draftKey(): number {
  return nextKey++;
}

export function toDraft(input: VmInput): VmDraft {
  const { config } = input;
  return {
    config: {
      vaBits: String(config.vaBits),
      paBits: String(config.paBits),
      pageSize: String(config.pageSize),
      levels: String(config.levels) as '1' | '2',
      tlbSize: String(config.tlbSize),
      tlbPolicy: config.tlbPolicy,
      ptbr: String(config.ptbr),
    },
    pages: input.pages.map((p) => ({
      key: draftKey(),
      vpn: String(p.vpn),
      valid: p.valid,
      pfn: String(p.pfn),
      prot: p.prot,
    })),
    directory: input.directory.map((d) => ({
      key: draftKey(),
      index: String(d.index),
      pfn: String(d.pfn),
    })),
    accesses: formatAccesses(input.accesses, config.vaBits),
  };
}

export function fromDraft(draft: VmDraft): unknown {
  const c = draft.config;
  return {
    config: {
      vaBits: parseNumber(c.vaBits),
      paBits: parseNumber(c.paBits),
      pageSize: parseNumber(c.pageSize),
      levels: Number(c.levels) as Levels,
      tlbSize: parseNumber(c.tlbSize),
      tlbPolicy: c.tlbPolicy,
      ptbr: parseNumber(c.ptbr),
    },
    pages: draft.pages.map((p) => ({
      vpn: parseNumber(p.vpn),
      valid: p.valid,
      pfn: parseNumber(p.pfn),
      prot: p.prot,
    })),
    directory:
      c.levels === '2'
        ? draft.directory.map((d) => ({
            index: parseNumber(d.index),
            pfn: parseNumber(d.pfn),
          }))
        : [],
    accesses: parseAccesses(draft.accesses),
  };
}

export function validateDraft(draft: VmDraft) {
  return validateVmInput(fromDraft(draft));
}

/** Unique messages whose path matches. */
export function issuesAt(
  issues: readonly ValidationIssue[],
  match: (path: ValidationIssue['path']) => boolean,
): string[] {
  return [...new Set(issues.filter((i) => match(i.path)).map((i) => i.message))];
}

/** The lowest VPN not yet in the table, as text; `null` when the table is full. */
export function nextVpn(pages: readonly PageDraft[]): string | null {
  if (pages.length >= LIMITS.maxPages) return null;
  const used = new Set(pages.map((p) => parseNumber(p.vpn)));
  for (let vpn = 0; ; vpn += 1) if (!used.has(vpn)) return String(vpn);
}

/**
 * The directory a two-level config needs for the draft's pages (`directoryFor`), as
 * drafts; `null` when the config or pages don't parse yet.
 */
export function autoDirectory(draft: VmDraft): DirectoryDraft[] | null {
  const raw = fromDraft(draft) as VmInput;
  const config = { ...raw.config, levels: 2 as const };
  const numbers = [config.vaBits, config.paBits, config.pageSize, config.ptbr];
  for (const page of raw.pages) numbers.push(page.vpn, page.pfn);
  if (!numbers.every(Number.isInteger) || !isPowerOfTwo(config.pageSize)) return null;
  if (
    config.pageSize * 2 > 2 ** config.vaBits ||
    config.pageSize * 2 > 2 ** config.paBits
  ) {
    return null;
  }
  const g = geometry(config);
  if (g.ptIndexBits < 1 || g.pdIndexBits < 1) return null;
  return directoryFor(config, raw.pages).map((d) => ({
    key: draftKey(),
    index: String(d.index),
    pfn: String(d.pfn),
  }));
}
