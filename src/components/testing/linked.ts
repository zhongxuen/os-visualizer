import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

import type { ModuleShareState, ShareStateBase } from '@/core/state/schema';
import { shareStateToSearch } from '@/core/state/shareState';

/**
 * Render a module view on its default input, opened from a `?s=` link to it.
 *
 * A module opens in Guided, and opening the lesson's first part loads that part's
 * example over an untouched input (Q1, docs/UIUX.md §10.1). A test about the module's
 * own features on its defaults starts here instead: Guided never overwrites input that
 * came from a link, so the defaults stay on screen and the lesson offers "Load this
 * example". (Switching to Sandbox after rendering is too late: once a test file has
 * loaded the lesson's chunk, React mounts it in the first render.)
 */
export function renderLinked<S extends ShareStateBase>(
  ui: ReactElement,
  definition: ModuleShareState<S>,
): RenderResult {
  const search = shareStateToSearch(definition, definition.defaults);
  if (search === null) throw new Error('The defaults are too large for a link');
  window.history.replaceState(null, '', `/${search}`);
  return render(ui);
}
