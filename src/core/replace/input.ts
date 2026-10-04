/**
 * The page replacement input: a reference string, a frame count and a policy, with a Zod
 * schema and hard limits.
 *
 * The limits keep every run small enough that each event carries a full snapshot
 * (00-overview §6.14): at most 40 references over page ids 0..15, and 1..8 frames (the
 * faults-vs-frames curve runs every frame count in that range).
 *
 * `zod/mini` for the same reason as the share-state codec: the editor validates in the
 * browser, and the full Zod API would cost the route its JS budget.
 */

import * as z from 'zod/mini';

export const LIMITS = {
  minRefs: 1,
  maxRefs: 40,
  /** Page ids are 0..maxPage. */
  maxPage: 15,
  minFrames: 1,
  maxFrames: 8,
} as const;

export const POLICIES = ['fifo', 'lru', 'opt', 'clock'] as const;

export type Policy = (typeof POLICIES)[number];

export const POLICY_NAMES: Record<Policy, string> = {
  fifo: 'FIFO',
  lru: 'LRU',
  opt: 'OPT',
  clock: 'Clock',
};

export interface ReplInput {
  /** Page ids, 0..15, 1..40 of them. */
  refString: number[];
  /** Physical frames, 1..8. */
  frames: number;
  policy: Policy;
}

export interface ValidationIssue {
  /** Where the problem is, e.g. `['refString', 3]`. */
  path: (string | number)[];
  message: string;
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
}

export const PAGE_SCHEMA = int(0, LIMITS.maxPage, 'Page');

export const REF_STRING_SCHEMA = z
  .array(PAGE_SCHEMA)
  .check(
    z.minLength(LIMITS.minRefs, 'Add at least one reference'),
    z.maxLength(LIMITS.maxRefs, `At most ${LIMITS.maxRefs} references`),
  );

export const FRAMES_SCHEMA = int(LIMITS.minFrames, LIMITS.maxFrames, 'Frames');

export const POLICY_SCHEMA = z.enum(POLICIES);

export const INPUT_SHAPE = {
  refString: REF_STRING_SCHEMA,
  frames: FRAMES_SCHEMA,
  policy: POLICY_SCHEMA,
};

export const INPUT_SCHEMA = z.object(INPUT_SHAPE);

export function validateReplInput(input: unknown): Validation<ReplInput> {
  const parsed = INPUT_SCHEMA.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
      message: issue.message,
    })),
  };
}

/** The reference string as text: `7, 0, 1, 2`. Reads the format `parseRefString` takes. */
export function formatRefString(refString: readonly number[]): string {
  return refString.join(', ');
}

/**
 * `'7 0 1, 2'` → `[7, 0, 1, 2]`. Commas, spaces and new lines all separate. A bad token
 * keeps its place as `NaN`, so the schema reports it against the right position.
 */
export function parseRefString(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((token) => (/^\d+$/.test(token) ? Number(token) : Number.NaN));
}

/** Distinct pages in a reference string. */
export function distinctPages(refString: readonly number[]): number {
  return new Set(refString).size;
}
