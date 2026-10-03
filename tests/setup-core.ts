import fc from 'fast-check';

/**
 * Property tests run with a fixed seed so a run is reproducible. Override with
 * FC_SEED=<n> to explore other seeds; when a property fails, fast-check prints the seed
 * and counterexample path, and `fc.assert(prop, { seed, path })` replays it exactly.
 */
const seed = Number(process.env.FC_SEED ?? 20260922);

fc.configureGlobal({ seed, verbose: 1 });
