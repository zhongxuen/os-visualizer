'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * The viewer's display preferences: theme and "pause after each phase".
 *
 * A small stand-in for Internet Visualizer's `src/components/prefs` (see VENDORED.md),
 * which keeps its own `localStorage` key. This product has one key, `osv:v1`, shaped
 * `{ v: 1, completed, saved, prefs }` (docs/implementation/03, step 4). This file owns
 * only `prefs` and writes back every other field it finds untouched, so the progress
 * hook (`useProgress`, phase 3.2) can share the key.
 *
 * Read through `useSyncExternalStore`: the server snapshot is the defaults, so hydration
 * never mismatches, and the pre-paint script in `themeScript.ts` sets `data-theme` before first paint.
 * Every storage access is wrapped: blocked storage loses durability, never the page.
 */

import { STORAGE_KEY } from './themeScript';

export { STORAGE_KEY };

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: ThemeSetting;
  /** Stop playback at each phase boundary until Play is pressed again. */
  pauseAtSteps: boolean;
}

export type PrefKey = keyof Prefs;

export const DEFAULT_PREFS: Readonly<Prefs> = Object.freeze({
  theme: 'system',
  pauseAtSteps: false,
});

const VALID: { [K in PrefKey]: (value: unknown) => value is Prefs[K] } = {
  theme: (value): value is ThemeSetting =>
    value === 'system' || value === 'light' || value === 'dark',
  pauseAtSteps: (value): value is boolean => typeof value === 'boolean',
};

function readRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    return record.v === 1 ? record : null;
  } catch {
    return null;
  }
}

/** The prefs in a stored `osv:v1` string. Invalid fields fall back one by one. */
export function parsePrefs(raw: string | null): Readonly<Prefs> {
  const stored = readRecord(raw)?.prefs;
  if (typeof stored !== 'object' || stored === null) return DEFAULT_PREFS;
  const record = stored as Record<string, unknown>;

  let next: Prefs | null = null;
  for (const key of Object.keys(VALID) as PrefKey[]) {
    const value = record[key];
    if (!VALID[key](value) || value === DEFAULT_PREFS[key]) continue;
    next ??= { ...DEFAULT_PREFS };
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next ?? DEFAULT_PREFS;
}

/** `raw` with `prefs` replaced, every other field kept. */
export function writePrefs(raw: string | null, prefs: Readonly<Prefs>): string {
  const base = readRecord(raw) ?? { v: 1, completed: [], saved: {} };
  return JSON.stringify({ ...base, v: 1, prefs });
}

export interface PrefsStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Readonly<Prefs>;
  set<K extends PrefKey>(key: K, value: Prefs[K]): void;
}

function readItem(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeItem(value: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function createPrefsStore(): PrefsStore {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cached: Readonly<Prefs> = DEFAULT_PREFS;

  const emit = () => listeners.forEach((listener) => listener());

  const current = (): Readonly<Prefs> => {
    const raw = readItem();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = parsePrefs(raw);
    }
    return cached;
  };

  // Another tab wrote the key: the next snapshot re-reads storage anyway.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) emit();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
    getSnapshot() {
      return typeof window === 'undefined' ? DEFAULT_PREFS : current();
    },
    set(key, value) {
      const base = current();
      if (!VALID[key](value) || base[key] === value) return;
      const next = { ...base, [key]: value };
      const raw = writePrefs(readItem(), next);
      if (writeItem(raw)) cachedRaw = raw;
      cached = next;
      emit();
    },
  };
}

let shared: PrefsStore | null = null;

export function sharedPrefsStore(): PrefsStore {
  shared ??= createPrefsStore();
  return shared;
}

/** One preference and its setter, like `useState`. Defaults during SSR and hydration. */
export function usePreference<K extends PrefKey>(
  key: K,
): [Prefs[K], (value: Prefs[K]) => void] {
  const store = sharedPrefsStore();
  const value = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot()[key],
    () => DEFAULT_PREFS[key],
  );
  const set = useCallback((next: Prefs[K]) => store.set(key, next), [store, key]);
  return [value, set];
}

/** Whether playback stops at each phase boundary. Off unless the viewer turns it on. */
export function usePauseAtSteps(): boolean {
  return usePreference('pauseAtSteps')[0];
}
