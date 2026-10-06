/**
 * "What happens next? → Page Replacement" (docs/UIUX.md T5): the link from a page fault
 * to the Page Replacement module, carrying this run's pages so it is not a cold start.
 *
 * The payload is Page Replacement's own `?s=` share state, built from its definition in
 * core (`REPLACE_SHARE_STATE`, `src/core/replace/state.ts`) with the shared codec, the
 * same way that module writes its own links. Nothing is imported from
 * `src/modules/replacement` (boundary rule 3): the format is the core's, not the
 * module's.
 *
 * The reference string is the page (VPN) of every access in this run, in order, so the
 * page that faulted is in it at the place it faulted. Frames and policy stay at Page
 * Replacement's defaults. Page Replacement numbers pages 0–15; a run that touches a
 * higher page can't be carried over, and the link says so instead of renumbering pages.
 */

import { LIMITS as REPLACE_LIMITS } from '@/core/replace/input';
import { REPLACE_SHARE_STATE } from '@/core/replace/state';
import { shareStateToSearch } from '@/core/state/shareState';
import { geometry, type VmInput } from '@/core/vm/config';

export const REPLACEMENT_ROUTE = '/replacement';

export interface ReplacementHandoff {
  /** `/replacement?s=…`, or plain `/replacement` when the pages can't be carried. */
  href: string;
  /** The reference string carried over; `null` when none is. */
  pages: number[] | null;
  /** Why nothing was carried, when nothing was. */
  reason?: string;
}

/** The page (VPN) of each access, in order. */
export function pagesOf(input: VmInput): number[] {
  const { pageSize } = geometry(input.config);
  return input.accesses.map((a) => Math.floor(a.va / pageSize));
}

export function replacementHandoff(input: VmInput): ReplacementHandoff {
  const pages = pagesOf(input).slice(0, REPLACE_LIMITS.maxRefs);
  const highest = Math.max(...pages);
  if (pages.length === 0) {
    return { href: REPLACEMENT_ROUTE, pages: null, reason: 'This run has no accesses.' };
  }
  if (highest > REPLACE_LIMITS.maxPage) {
    return {
      href: REPLACEMENT_ROUTE,
      pages: null,
      reason: `Page Replacement numbers pages 0–${REPLACE_LIMITS.maxPage} and this run reaches page ${highest}, so it opens with its own example.`,
    };
  }
  const defaults = REPLACE_SHARE_STATE.defaults;
  const search = shareStateToSearch(REPLACE_SHARE_STATE, {
    ...defaults,
    step: 0,
    input: { ...defaults.input, refString: pages },
  });
  if (search === null) {
    return {
      href: REPLACEMENT_ROUTE,
      pages: null,
      reason: 'The link would be too long.',
    };
  }
  return { href: `${REPLACEMENT_ROUTE}${search}`, pages };
}
