/**
 * Validation messages in human words (docs/UIUX.md G11). The core's schema says what is
 * wrong ("Virtual address must be a whole number"); this says it the way a student needs
 * it, with the numbers that apply to this machine ("Access 3: “abc” isn’t an address.
 * Use decimal (100) or hex (0x64).").
 *
 * One message per problem, keyed on the issue's path, so the editor shows it next to the
 * field it is about. An issue this doesn't recognise keeps the core's own text, which is
 * already a sentence.
 */

import { isPowerOfTwo, LIMITS, log2, type ValidationIssue } from '@/core/vm/config';

import { accessTokens } from './adapters';
import { parseNumber } from './fields';
import type { VmDraft } from './draft';

/** What the messages need from the draft: the sizes, where they parse. */
interface Sizes {
  vaBits: number | null;
  paBits: number | null;
  pageSize: number | null;
}

function sizesOf(draft: VmDraft): Sizes {
  const n = (text: string, ok: (v: number) => boolean) => {
    const v = parseNumber(text);
    return Number.isInteger(v) && ok(v) ? v : null;
  };
  const bits = (v: number) => v >= LIMITS.minVaBits && v <= LIMITS.maxVaBits;
  return {
    vaBits: n(draft.config.vaBits, bits),
    paBits: n(draft.config.paBits, bits),
    pageSize: n(draft.config.pageSize, isPowerOfTwo),
  };
}

/** How many pages (or frames) an address of `bits` has, if it's known. */
function count(bits: number | null, pageSize: number | null): number | null {
  if (bits === null || pageSize === null) return null;
  const n = bits - log2(pageSize);
  return n >= 1 ? 2 ** n : null;
}

const has = (message: string, text: string) => message.includes(text);

function configMessage(field: string, message: string): string {
  switch (field) {
    case 'vaBits':
      return `Virtual addresses here are ${LIMITS.minVaBits} to ${LIMITS.maxVaBits} bits wide.`;
    case 'paBits':
      return `Physical addresses here are ${LIMITS.minPaBits} to ${LIMITS.maxPaBits} bits wide.`;
    case 'pageSize':
      if (has(message, 'VPN bit')) {
        return 'Pages this big leave no bits for the page number. Pick smaller pages or more VA bits.';
      }
      if (has(message, 'PFN bit')) {
        return 'Pages this big leave no bits for the frame number. Pick smaller pages or more PA bits.';
      }
      if (has(message, 'two PTEs')) {
        return 'Two levels need pages of at least 8 bytes, so a page of page table holds two 4-byte entries.';
      }
      if (has(message, 'wider than one page-table page')) {
        return 'The whole page table fits in one page, so a second level has nothing to do. Use a linear table or more VA bits.';
      }
      return message;
    case 'ptbr':
      if (has(message, 'multiple')) {
        return 'The table base must be a multiple of 4, because each entry is 4 bytes.';
      }
      if (has(message, 'must fit')) return message;
      return 'The table base is a physical address: a whole number, in decimal or 0x hex.';
    default:
      return message;
  }
}

function pageMessage(field: string, message: string, sizes: Sizes): string {
  const pages = count(sizes.vaBits, sizes.pageSize);
  const frames = count(sizes.paBits, sizes.pageSize);
  if (field === 'vpn') {
    const twice = /^VPN (\d+) is listed twice/.exec(message);
    if (twice) return `Page ${twice[1]} is already in the table.`;
    const dir = /^VPN (\d+) is valid but directory entry (\d+)/.exec(message);
    if (dir) {
      return `Page ${dir[1]} needs directory entry ${dir[2]}, which has no page of page table. Add it, or press “Fill automatically”.`;
    }
    return pages === null
      ? 'The page number (VPN) is a whole number.'
      : `Page numbers (VPNs) here are 0 to ${pages - 1}.`;
  }
  if (field === 'pfn') {
    return frames === null
      ? 'The frame number (PFN) is a whole number.'
      : `Frame numbers (PFNs) here are 0 to ${frames - 1}.`;
  }
  return message;
}

function directoryMessage(field: string, message: string, sizes: Sizes): string {
  if (field === 'index') {
    const twice = /^Directory index (\d+) is listed twice/.exec(message);
    if (twice) return `Directory entry ${twice[1]} is already listed.`;
    const below = /below (\d+)/.exec(message);
    if (below) return `Directory entries here are 0 to ${Number(below[1]) - 1}.`;
    return 'The directory index is a whole number.';
  }
  if (field === 'pfn') return pageMessage('pfn', message, sizes);
  return message;
}

function accessMessage(
  index: number,
  field: string | number | undefined,
  message: string,
  draft: VmDraft,
  sizes: Sizes,
): string {
  const n = `Access ${index + 1}`;
  const token = accessTokens(draft.accesses)[index] ?? '';
  if (field === 'op') {
    return `${n}: add “w” after the address for a write; an address alone is a read.`;
  }
  const below = /below (\d+)/.exec(message);
  if (below) {
    const bits = sizes.vaBits === null ? '' : ` (${sizes.vaBits}-bit addresses)`;
    return `${n}: addresses here go up to ${Number(below[1]) - 1}${bits}.`;
  }
  const address = token.split(/\s+/)[0] ?? '';
  return `${n}: “${address}” isn’t an address. Use decimal (100) or hex (0x64).`;
}

/** The human message for one issue. */
export function humanMessage(issue: ValidationIssue, draft: VmDraft): string {
  const [where, a, b] = issue.path;
  const sizes = sizesOf(draft);
  if (where === 'config' && typeof a === 'string') return configMessage(a, issue.message);
  if (where === 'pages' && typeof a === 'number' && typeof b === 'string') {
    return pageMessage(b, issue.message, sizes);
  }
  if (where === 'directory' && typeof a === 'number' && typeof b === 'string') {
    return directoryMessage(b, issue.message, sizes);
  }
  if (where === 'accesses' && typeof a === 'number') {
    return accessMessage(a, b, issue.message, draft, sizes);
  }
  return issue.message;
}

/** Every issue with its message replaced by the human one. */
export function humanIssues(
  issues: readonly ValidationIssue[],
  draft: VmDraft,
): ValidationIssue[] {
  return issues.map((issue) => ({ ...issue, message: humanMessage(issue, draft) }));
}
