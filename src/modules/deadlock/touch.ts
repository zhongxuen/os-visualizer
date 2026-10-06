'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the main pointer is a finger (docs/UIUX.md D4). On a touch screen the graph
 * canvas is view-only, with pan and pinch zoom, and the form is the editor: dragging a
 * handle with a finger is fiddly and fights the page's own scroll.
 *
 * `hover: none` as well as `pointer: coarse`, so a laptop with a touch screen and a
 * mouse or trackpad keeps the drag editor. `false` on the server and until hydration.
 */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const list = window.matchMedia(TOUCH_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      (typeof window !== 'undefined' && window.matchMedia?.(TOUCH_QUERY).matches) ||
      false,
    () => false,
  );
}
