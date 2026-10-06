import { describe, expect, it } from 'vitest';

import { PLAYBACK_SPEEDS } from '@/core/sim/playback';

import {
  chordId,
  findShortcutCollisions,
  isTypingTarget,
  matchPlaybackKey,
  matchWorkspaceKey,
  PLAYBACK_SHORTCUTS,
  shouldIgnoreKey,
  WORKSPACE_SHORTCUTS,
  type ModuleShortcut,
  type PlaybackCommand,
} from './keymap';

declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: { eager: true }): Record<string, T>;
  }
}

/**
 * Every module's own keys. A module that binds keys exports `MODULE_SHORTCUTS` from
 * `src/modules/<name>/shortcuts.ts` (see src/components/README.md); the glob picks each
 * one up without this shared test importing a module (boundary rule 4).
 */
const MODULE_KEYMAPS = import.meta.glob<{ MODULE_SHORTCUTS?: readonly ModuleShortcut[] }>(
  '../../modules/*/shortcuts.ts',
  { eager: true },
);

function element(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as Element;
}

const TOGGLE: PlaybackCommand = { type: 'toggle' };
const STEP: PlaybackCommand = { type: 'step-event', direction: 1 };

describe('matchPlaybackKey', () => {
  it('maps the documented keys', () => {
    expect(matchPlaybackKey({ key: ' ' })).toEqual({ type: 'toggle' });
    expect(matchPlaybackKey({ key: 'ArrowRight' })).toEqual({
      type: 'step-event',
      direction: 1,
    });
    expect(matchPlaybackKey({ key: 'ArrowLeft' })).toEqual({
      type: 'step-event',
      direction: -1,
    });
    expect(matchPlaybackKey({ key: 'Home' })).toEqual({ type: 'jump', to: 'start' });
    expect(matchPlaybackKey({ key: 'End' })).toEqual({ type: 'jump', to: 'end' });
    expect(matchPlaybackKey({ key: '.' })).toEqual({ type: 'replay-phase' });
  });

  it('turns the arrows into phase jumps when Shift is held', () => {
    expect(matchPlaybackKey({ key: 'ArrowRight', shiftKey: true })).toEqual({
      type: 'step-phase',
      direction: 1,
    });
    expect(matchPlaybackKey({ key: 'ArrowLeft', shiftKey: true })).toEqual({
      type: 'step-phase',
      direction: -1,
    });
  });

  it('maps 1 to 5 onto the speed ladder in order', () => {
    for (const [index, speed] of PLAYBACK_SPEEDS.entries()) {
      expect(matchPlaybackKey({ key: String(index + 1) })).toEqual({
        type: 'speed',
        speed,
      });
    }
  });

  it('leaves keys it does not own alone', () => {
    for (const key of ['a', 'Escape', 'Enter', '0', '6', 'ArrowUp', 'Tab']) {
      expect(matchPlaybackKey({ key })).toBeNull();
    }
  });

  it('never shadows a browser or OS chord', () => {
    expect(matchPlaybackKey({ key: 'ArrowLeft', metaKey: true })).toBeNull();
    expect(matchPlaybackKey({ key: 'ArrowRight', ctrlKey: true })).toBeNull();
    expect(matchPlaybackKey({ key: ' ', altKey: true })).toBeNull();
  });
});

describe('shouldIgnoreKey', () => {
  it('hands every key back to a text field', () => {
    expect(shouldIgnoreKey(element('<input type="text" />'), TOGGLE)).toBe(true);
    expect(shouldIgnoreKey(element('<textarea></textarea>'), STEP)).toBe(true);
    expect(shouldIgnoreKey(element('<div contenteditable="true"></div>'), TOGGLE)).toBe(
      true,
    );
  });

  it('leaves the scrubber its own navigation keys but not play/pause', () => {
    const scrubber = element('<input type="range" />');

    expect(shouldIgnoreKey(scrubber, STEP)).toBe(true);
    expect(shouldIgnoreKey(scrubber, { type: 'jump', to: 'end' })).toBe(true);
    expect(shouldIgnoreKey(scrubber, TOGGLE)).toBe(false);
    expect(shouldIgnoreKey(scrubber, { type: 'speed', speed: 2 })).toBe(false);
  });

  it('lets Space activate the focused button rather than toggling playback', () => {
    const button = element('<button type="button"></button>');

    expect(shouldIgnoreKey(button, TOGGLE)).toBe(true);
    // The arrows are not a button's to claim.
    expect(shouldIgnoreKey(button, STEP)).toBe(false);
    expect(shouldIgnoreKey(element('<div role="button"></div>'), TOGGLE)).toBe(true);
  });

  it('hands every key back to a select', () => {
    expect(shouldIgnoreKey(element('<select></select>'), STEP)).toBe(true);
  });

  it('claims everything when the press landed on nothing in particular', () => {
    expect(shouldIgnoreKey(null, TOGGLE)).toBe(false);
    expect(shouldIgnoreKey(document.body, TOGGLE)).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('is true wherever the viewer types text', () => {
    for (const html of [
      '<input type="text" />',
      '<input type="search" />',
      '<input />',
      '<textarea></textarea>',
      '<select></select>',
      '<div contenteditable="true"></div>',
    ]) {
      expect(isTypingTarget(element(html)), html).toBe(true);
    }
  });

  it('is false for a slider, a button, the page, or nothing', () => {
    expect(isTypingTarget(element('<input type="range" />'))).toBe(false);
    expect(isTypingTarget(element('<button type="button"></button>'))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('the printed legend', () => {
  it('documents a working shortcut for every key it prints', () => {
    /** How the legend spells a key, to what a `KeyboardEvent` would report. */
    const AS_EVENT_KEY: Record<string, string> = {
      Space: ' ',
      '→': 'ArrowRight',
      '←': 'ArrowLeft',
    };

    for (const shortcut of PLAYBACK_SHORTCUTS) {
      for (const chord of shortcut.chords) {
        const shiftKey = chord.includes('Shift');
        const printed = chord.filter((key) => key !== 'Shift').at(-1) ?? '';
        const key = AS_EVENT_KEY[printed] ?? printed;

        expect(matchPlaybackKey({ key, shiftKey })).not.toBeNull();
      }
    }
  });

  it('covers every command the map can produce', () => {
    const produced = new Set(
      [' ', 'ArrowRight', 'ArrowLeft', 'Home', 'End', '.', '1']
        .map((key) => matchPlaybackKey({ key })?.type)
        .filter(Boolean),
    );

    expect(produced).toEqual(
      new Set(['toggle', 'step-event', 'jump', 'replay-phase', 'speed']),
    );
    expect(matchPlaybackKey({ key: 'ArrowRight', shiftKey: true })?.type).toBe(
      'step-phase',
    );
    expect(PLAYBACK_SHORTCUTS).toHaveLength(6);
  });
});

describe('key uniqueness (B6)', () => {
  it('normalises chords: letters ignore case, Shift is kept, caps read as keys', () => {
    expect(chordId(['F'])).toBe('f');
    expect(chordId(['f'])).toBe('f');
    expect(chordId(['Shift', '→'])).toBe('shift+arrowright');
    expect(chordId(['→'])).toBe('arrowright');
    expect(chordId(['Space'])).toBe(' ');
  });

  it('finds a collision, and names both owners', () => {
    const clash = findShortcutCollisions(PLAYBACK_SHORTCUTS, [
      { chords: [['1'], ['2']], action: 'Run thread 1 or 2' },
    ]);
    expect(clash).toEqual([
      '1: Speed 0.25x, 0.5x, 1x, 2x, 4x | Run thread 1 or 2',
      '2: Speed 0.25x, 0.5x, 1x, 2x, 4x | Run thread 1 or 2',
    ]);
  });

  it('gives every playback and workspace key exactly one meaning', () => {
    expect(findShortcutCollisions(PLAYBACK_SHORTCUTS, WORKSPACE_SHORTCUTS)).toEqual([]);
  });

  it('gives every module key one meaning on its page, beside playback and workspace', () => {
    for (const [file, keymap] of Object.entries(MODULE_KEYMAPS)) {
      const own = keymap.MODULE_SHORTCUTS ?? [];
      expect(
        findShortcutCollisions(PLAYBACK_SHORTCUTS, WORKSPACE_SHORTCUTS, own),
        file,
      ).toEqual([]);
    }
  });

  it('maps the workspace keys, and never a modified chord', () => {
    expect(matchWorkspaceKey({ key: 'f' })).toEqual({ type: 'focus-mode' });
    expect(matchWorkspaceKey({ key: 'F', shiftKey: true })).toEqual({
      type: 'focus-mode',
    });
    expect(matchWorkspaceKey({ key: '?', shiftKey: true })).toEqual({
      type: 'shortcuts',
    });
    expect(matchWorkspaceKey({ key: 'f', ctrlKey: true })).toBeNull();
    expect(matchWorkspaceKey({ key: 'g' })).toBeNull();
    for (const shortcut of WORKSPACE_SHORTCUTS) {
      for (const chord of shortcut.chords) {
        expect(matchWorkspaceKey({ key: chord.at(-1)! })).not.toBeNull();
      }
    }
  });
});
