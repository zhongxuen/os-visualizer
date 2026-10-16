import { SHARE_STATES } from '@/core/state/modules';
import type { ModuleShareState } from '@/core/state/schema';

/**
 * The share-state definition for a module key. Throws on an unknown key.
 *
 * Kept out of `useShareState.ts`: `SHARE_STATES` imports every module's core, so only a
 * page that needs a lookup by key (`/demo`) should pay for it.
 */
export function shareStateFor(moduleId: string): ModuleShareState {
  const definition = SHARE_STATES.find((entry) => entry.m === moduleId);
  if (!definition) throw new Error(`No share state registered for "${moduleId}"`);
  return definition;
}
