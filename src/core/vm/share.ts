import type { ModuleShareState, ShareStateBase, ShareStateSource } from '../state/schema';
import type { VmInput } from './config';
import { DEFAULT_PRESET } from './presets';
import type { SizingInput } from './sizing';

/**
 * `/translation`'s share state without its schema (see `ShareStateSource`): what the page
 * renders from, with `load()` bringing `state.ts` and Zod only when a link has to be
 * decoded.
 */

export type VmShareState = ShareStateBase<'vm', VmInput & { sizing: SizingInput }>;

export const VM_SHARE: ShareStateSource<VmShareState> = {
  m: 'vm',
  v: 1,
  defaults: {
    m: 'vm',
    v: 1,
    step: 0,
    input: { ...DEFAULT_PRESET.input, sizing: DEFAULT_PRESET.sizing },
  },
  load: () =>
    import('./state').then(
      (s) => s.VM_SHARE_STATE as unknown as ModuleShareState<VmShareState>,
    ),
};
