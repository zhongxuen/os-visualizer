/**
 * The one place the `motion` library is imported, and only ever dynamically
 * (docs/UIUX.md §6.1 rule 6): it is FLIP-only, it lands in its own chunk, and a route
 * that never renders a `<Flip>` -- the home page -- never fetches it.
 */

export type MotionModule = typeof import('motion/react');

let loaded: MotionModule | null = null;
let pending: Promise<MotionModule> | null = null;

/** The module, if it has already arrived. */
export function peekMotion(): MotionModule | null {
  return loaded;
}

/** Fetch the module once; every later call shares the same promise. */
export function loadMotion(): Promise<MotionModule> {
  pending ??= import('motion/react').then((module) => (loaded = module));
  return pending;
}
