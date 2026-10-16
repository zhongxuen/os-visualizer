import { validateVmInput } from '@/core/vm/config.schema';

import { fromDraft, type VmDraft } from './draft';

/**
 * The editor's validation, apart from `draft.ts` so only the editor's chunk loads Zod
 * (docs/UIUX.md §10.5).
 */
export function validateDraft(draft: VmDraft) {
  return validateVmInput(fromDraft(draft));
}
