import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_PREFS, parsePrefs, sharedPrefsStore, writePrefs } from './prefs';
import { applyThemeAttribute, STORAGE_KEY } from './themeScript';
import { ThemeToggle } from './ThemeToggle';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('parsePrefs', () => {
  it('reads the prefs out of an osv:v1 object, field by field', () => {
    expect(parsePrefs(null)).toBe(DEFAULT_PREFS);
    expect(parsePrefs('not json')).toBe(DEFAULT_PREFS);
    expect(parsePrefs('{"v":2,"prefs":{"theme":"dark"}}')).toBe(DEFAULT_PREFS);
    expect(parsePrefs('{"v":1,"prefs":{"theme":"dark","pauseAtSteps":"yes"}}')).toEqual({
      theme: 'dark',
      pauseAtSteps: false,
    });
  });
});

describe('writePrefs', () => {
  it('keeps every other field of the shared key', () => {
    const raw = JSON.stringify({ v: 1, completed: ['scheduling'], saved: { a: [1] } });
    expect(JSON.parse(writePrefs(raw, { theme: 'light', pauseAtSteps: true }))).toEqual({
      v: 1,
      completed: ['scheduling'],
      saved: { a: [1] },
      prefs: { theme: 'light', pauseAtSteps: true },
    });
  });

  it('starts a fresh versioned object when there is none', () => {
    expect(JSON.parse(writePrefs(null, DEFAULT_PREFS))).toMatchObject({
      v: 1,
      completed: [],
      saved: {},
    });
  });
});

describe('the shared store', () => {
  it('writes under osv:v1 and ignores invalid values', () => {
    const store = sharedPrefsStore();
    store.set('pauseAtSteps', true);
    // @ts-expect-error -- an invalid value is ignored, not thrown.
    store.set('theme', 'purple');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).prefs).toEqual({
      theme: 'system',
      pauseAtSteps: true,
    });
  });
});

describe('applyThemeAttribute (the pre-paint script)', () => {
  it('sets data-theme for an explicit choice and leaves it off for system', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      writePrefs(null, { ...DEFAULT_PREFS, theme: 'dark' }),
    );
    applyThemeAttribute(STORAGE_KEY);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    window.localStorage.setItem(STORAGE_KEY, writePrefs(null, DEFAULT_PREFS));
    applyThemeAttribute(STORAGE_KEY);
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('survives garbage in storage', () => {
    window.localStorage.setItem(STORAGE_KEY, '{');
    expect(() => applyThemeAttribute(STORAGE_KEY)).not.toThrow();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});

describe('ThemeToggle', () => {
  it('is a labelled group whose current choice is pressed, and applies a choice', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    expect(screen.getByRole('group', { name: 'Colour theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(sharedPrefsStore().getSnapshot().theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'System' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});
