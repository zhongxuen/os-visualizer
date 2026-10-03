'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  emptyProgress,
  MAX_SAVED_PER_MODULE,
  parseProgress,
  PROGRESS_KEY,
  type ProgressV1,
} from './progress';

/**
 * `useProgress()`: completion flags and saved inputs, persisted under `osv:v1`.
 *
 * Never read during server render: the server snapshot is empty, and the stored value
 * arrives after hydration through `useSyncExternalStore`. Every storage access is wrapped
 * in try/catch, because private windows and blocked storage throw on access; a change
 * then lasts for this page view only. Other tabs are followed through the `storage`
 * event.
 *
 * Each write re-reads the key first, so `prefs` written by the shell in the meantime
 * survives.
 */

const EMPTY: ProgressV1 = Object.freeze(emptyProgress()) as ProgressV1;

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: ProgressV1 = EMPTY;
/** Stand-in when storage is blocked. */
let memoryRaw: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return memoryRaw;
  }
}

function snapshot(): ProgressV1 {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseProgress(raw);
  }
  return cachedValue;
}

function serverSnapshot(): ProgressV1 {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PROGRESS_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The stored progress outside React; empty on the server. */
export function readProgress(): ProgressV1 {
  return typeof window === 'undefined' ? EMPTY : snapshot();
}

/**
 * Apply `update` to the stored progress and tell every subscriber. Returning the value
 * unchanged writes nothing. Never throws.
 */
export function writeProgress(update: (current: ProgressV1) => ProgressV1): void {
  const current = snapshot();
  const next = update(current);
  if (next === current) return;
  const raw = JSON.stringify({ ...next, v: 1 });
  try {
    window.localStorage.setItem(PROGRESS_KEY, raw);
  } catch {
    memoryRaw = raw;
  }
  for (const listener of listeners) listener();
}

export interface UseProgress {
  progress: ProgressV1;
  isComplete(id: string): boolean;
  markComplete(id: string): void;
  /** Saved inputs for a module, oldest first. */
  savedFor(module: string): unknown[];
  /** Save an input (plain JSON). Keeps the newest `MAX_SAVED_PER_MODULE`. */
  saveInput(module: string, input: unknown): void;
  removeSaved(module: string, index: number): void;
  /** Forget completion and saved inputs. Preferences are kept. */
  reset(): void;
}

export function useProgress(): UseProgress {
  const progress = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const markComplete = useCallback((id: string) => {
    writeProgress((current) =>
      current.completed.includes(id)
        ? current
        : { ...current, completed: [...current.completed, id] },
    );
  }, []);

  const saveInput = useCallback((module: string, input: unknown) => {
    writeProgress((current) => ({
      ...current,
      saved: {
        ...current.saved,
        [module]: [...(current.saved[module] ?? []), input].slice(-MAX_SAVED_PER_MODULE),
      },
    }));
  }, []);

  const removeSaved = useCallback((module: string, index: number) => {
    writeProgress((current) => {
      const list = current.saved[module];
      if (!list || index < 0 || index >= list.length) return current;
      return {
        ...current,
        saved: { ...current.saved, [module]: list.filter((_, i) => i !== index) },
      };
    });
  }, []);

  const reset = useCallback(() => {
    writeProgress((current) => ({ ...emptyProgress(), prefs: current.prefs }));
  }, []);

  return useMemo(
    () => ({
      progress,
      isComplete: (id: string) => progress.completed.includes(id),
      markComplete,
      savedFor: (module: string) => progress.saved[module] ?? [],
      saveInput,
      removeSaved,
      reset,
    }),
    [progress, markComplete, saveInput, removeSaved, reset],
  );
}
