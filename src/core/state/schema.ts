/**
 * Share-state schemas: what a module may put in its `?s=` link.
 *
 * Every module's state has the same envelope, `{ m, v, step, input }`: `m` is the module
 * key (the discriminator, e.g. `'sched'`), `v` the schema version, `step` the step on
 * screen, and `input` whatever that module needs to reproduce the run -- the workload,
 * reference string or graph. There is no seed: every run here is a pure function of its
 * input. A module declares its branch with `defineShareState` in its own
 * `src/core/<name>/state.ts` and registers it with one line in `./modules.ts`.
 *
 * Together the branches form a discriminated union on `m`. It is kept as a registry
 * rather than one `z.discriminatedUnion` so each module owns its branch and a page
 * decodes against only its own: a link for one module pasted into another falls back to
 * that module's default instead of decoding.
 */

// `zod/mini` rather than `zod`: the same validators behind a functional API the bundler
// can tree-shake, so the per-route JS budget isn't spent on unused validators.
import * as z from 'zod/mini';

/** A whole number in `[min, max]`. */
export function intBetween(min: number, max: number) {
  return z.int().check(z.gte(min), z.lte(max));
}

/** The step on screen. Clamped to the run's length by the page, not here. */
export const STEP_SCHEMA = intBetween(0, 100_000);

export interface ShareStateBase<M extends string = string, I = unknown> {
  /** Module key, the same as its `src/core/<name>` folder. */
  m: M;
  /** Schema version. Bump it when `input` changes shape; old links then fall back. */
  v: number;
  step: number;
  input: I;
}

/** One module's branch of the share-state union. */
export interface ModuleShareState<S extends ShareStateBase = ShareStateBase> {
  readonly m: S['m'];
  readonly v: number;
  readonly schema: z.ZodMiniType<S>;
  /** What a missing, invalid or oversized link decodes to. */
  readonly defaults: S;
}

/**
 * Declare a module's share state.
 *
 * Throws if `defaults` don't satisfy the schema: an authoring mistake, caught when the
 * module loads.
 */
export function defineShareState<const M extends string, I extends z.ZodMiniType>(spec: {
  m: M;
  v: number;
  input: I;
  defaults: { step: number; input: z.output<I> };
}): ModuleShareState<ShareStateBase<M, z.output<I>>> {
  type State = ShareStateBase<M, z.output<I>>;

  const schema = z.object({
    m: z.literal(spec.m),
    v: z.literal(spec.v),
    step: STEP_SCHEMA,
    input: spec.input,
  }) as unknown as z.ZodMiniType<State>;

  const defaults: State = { m: spec.m, v: spec.v, ...spec.defaults };

  const parsed = schema.safeParse(defaults);
  if (!parsed.success) {
    throw new Error(
      `Share state "${spec.m}" defaults are invalid: ${parsed.error.message}`,
    );
  }

  return { m: spec.m, v: spec.v, schema, defaults };
}
