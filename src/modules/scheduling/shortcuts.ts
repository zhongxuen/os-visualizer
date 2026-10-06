import type { ModuleShortcut } from '@/components/timeline/keymap';

/**
 * Scheduling's own keys, listed in the shortcuts sheet and checked against the playback
 * and workspace keys by `keymap.test.ts` (B6).
 */
export const MODULE_SHORTCUTS: readonly ModuleShortcut[] = [
  { chords: [['Z']], action: 'Gantt chart: fit to width, or zoom to 1 tick = 16 px' },
];

/** Is this key press the zoom toggle? Any modifier but Shift disqualifies it. */
export function isZoomKey(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key === 'z' || event.key === 'Z';
}
