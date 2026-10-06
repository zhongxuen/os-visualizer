import type { ModuleShortcut } from '@/components/timeline/keymap';

/**
 * The translation module's own keys (B6). `keymap.test.ts` reads this file and fails if
 * a key here collides with a playback or workspace key.
 */
export const MODULE_SHORTCUTS: readonly ModuleShortcut[] = [
  { chords: [['B']], action: 'Show addresses in binary, hex or decimal (cycles)' },
];

/** Does this key press mean "next number base"? Plain `b`, no modifiers. */
export function isBaseKey(event: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): boolean {
  return (
    (event.key === 'b' || event.key === 'B') &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}
