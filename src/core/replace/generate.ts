/**
 * Seeded reference strings, the three workloads of OSTEP §22.6:
 *
 * - **no locality**: every reference picks a page uniformly at random;
 * - **80/20**: 80% of references go to the "hot" 20% of pages, the rest to the others;
 * - **looping sequential**: pages 0..N−1 in order, over and over. LRU's worst case: with
 *   fewer than N frames, LRU and FIFO always evict the page needed next.
 *
 * Small versions of the chapter's 100-page, 10,000-reference runs, but the same shape.
 * Same options, same string: the only randomness is the vendored seeded rng.
 */

import * as z from 'zod/mini';

import { createRng } from '../sim/rng';
import { LIMITS } from './input';

export const WORKLOADS = ['uniform', 'hotcold', 'loop'] as const;

export type WorkloadKind = (typeof WORKLOADS)[number];

export const WORKLOAD_NAMES: Record<WorkloadKind, string> = {
  uniform: 'No locality',
  hotcold: '80/20',
  loop: 'Looping sequential',
};

export interface GenerateOptions {
  kind: WorkloadKind;
  /** References, 1..40. */
  length: number;
  /** Distinct pages to draw from (page ids 0..pages−1), 1..16. */
  pages: number;
  /** Any whole number; ignored by the looping workload. */
  seed: number;
}

export const GENERATE_LIMITS = {
  minLength: LIMITS.minRefs,
  maxLength: LIMITS.maxRefs,
  minPages: 1,
  maxPages: LIMITS.maxPage + 1,
  maxSeed: 2 ** 31 - 1,
} as const;

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
}

export const GENERATE_SCHEMA = z.object({
  kind: z.enum(WORKLOADS),
  length: int(GENERATE_LIMITS.minLength, GENERATE_LIMITS.maxLength, 'Length'),
  pages: int(GENERATE_LIMITS.minPages, GENERATE_LIMITS.maxPages, 'Pages'),
  seed: int(0, GENERATE_LIMITS.maxSeed, 'Seed'),
});

/** How many of `pages` are hot in the 80/20 workload: 20%, at least one. */
export function hotPages(pages: number): number {
  return Math.max(1, Math.round(pages * 0.2));
}

/** A reference string for `options`. Expects valid options. */
export function generate(options: GenerateOptions): number[] {
  const { kind, length, pages, seed } = options;
  if (kind === 'loop') return Array.from({ length }, (_, i) => i % pages);
  const rng = createRng(seed).fork(kind);
  if (kind === 'uniform') return Array.from({ length }, () => rng.int(pages));
  const hot = hotPages(pages);
  const cold = pages - hot;
  return Array.from({ length }, () =>
    cold === 0 || rng.chance(0.8) ? rng.int(hot) : hot + rng.int(cold),
  );
}
