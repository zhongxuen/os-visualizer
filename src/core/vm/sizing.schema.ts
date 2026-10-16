/**
 * The page-table size calculator's Zod schema (see `sizing.ts`). Kept apart so the
 * calculator's arithmetic needs no Zod; the sizing editor and a `?s=` link load this on
 * demand (docs/UIUX.md §10.5).
 */

import * as z from 'zod/mini';

import { isPowerOfTwo, log2 } from './config';
import { SIZING_LIMITS } from './sizing';

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
