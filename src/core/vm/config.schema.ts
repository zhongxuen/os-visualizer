/**
 * The address translation input's Zod schemas and validator (see `config.ts` for the
 * types, limits, geometry and the cross-field checks, `inputIssues`).
 *
 * Kept apart from `config.ts` so a page can show a run without loading Zod: only the
 * editor and a `?s=` link need validation, and they load this on demand (docs/UIUX.md
 * §10.5). `zod/mini` for the same reason as the share-state codec.
 */

import * as z from 'zod/mini';

import {
  inputIssues,
  isPowerOfTwo,
  LIMITS,
  type Validation,
  type VmInput,
} from './config';

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
}

export const CONFIG_SCHEMA = z.object({
  vaBits: int(LIMITS.minVaBits, LIMITS.maxVaBits, 'Virtual address bits'),
  paBits: int(LIMITS.minPaBits, LIMITS.maxPaBits, 'Physical address bits'),
  pageSize: int(LIMITS.minPageSize, 2 ** (LIMITS.maxVaBits - 1), 'Page size').check(
    z.refine(isPowerOfTwo, 'Page size must be a power of two'),
  ),
  levels: z.union([z.literal(1), z.literal(2)]),
  tlbSize: int(0, LIMITS.maxTlb, 'TLB size'),
  tlbPolicy: z.enum(['lru', 'fifo']),
  ptbr: int(0, 2 ** LIMITS.maxPaBits - 1, 'PTBR'),
});

const PROT_SCHEMA = z.enum(['r', 'rw']);

export const PAGE_SCHEMA = z.object({
  vpn: int(0, 2 ** LIMITS.maxVaBits - 1, 'VPN'),
  valid: z.boolean(),
  pfn: int(0, 2 ** LIMITS.maxPaBits - 1, 'PFN'),
  prot: PROT_SCHEMA,
});

export const DIRECTORY_SCHEMA = z.object({
  index: int(0, 2 ** LIMITS.maxVaBits - 1, 'Directory index'),
  pfn: int(0, 2 ** LIMITS.maxPaBits - 1, 'PFN'),
});

export const ACCESS_SCHEMA = z.object({
  va: int(0, 2 ** LIMITS.maxVaBits - 1, 'Virtual address'),
  op: z.enum(['read', 'write']),
});

export const INPUT_SHAPE = {
  config: CONFIG_SCHEMA,
  pages: z.array(PAGE_SCHEMA).check(z.maxLength(LIMITS.maxPages)),
  directory: z.array(DIRECTORY_SCHEMA).check(z.maxLength(LIMITS.maxPages)),
  accesses: z
    .array(ACCESS_SCHEMA)
    .check(
      z.minLength(LIMITS.minAccesses, 'Add at least one access'),
      z.maxLength(LIMITS.maxAccesses, `At most ${LIMITS.maxAccesses} accesses`),
    ),
};

/** Adds the cross-field issues of `inputIssues` to a schema whose output is a `VmInput`. */
export function crossChecked<T extends VmInput>() {
  return z.superRefine<T>((value, ctx) => {
    for (const issue of inputIssues(value)) {
      ctx.addIssue({
        code: 'custom',
        message: issue.message,
        path: issue.path,
        input: value,
      });
    }
  });
}

export const INPUT_SCHEMA = z.object(INPUT_SHAPE).check(crossChecked());

export function validateVmInput(input: unknown): Validation<VmInput> {
  const parsed = (INPUT_SCHEMA as unknown as z.ZodMiniType<VmInput>).safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
      message: issue.message,
    })),
  };
}
