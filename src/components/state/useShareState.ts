'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { SHARE_STATES } from '@/core/state/modules';
import type { ModuleShareState, ShareStateBase } from '@/core/state/schema';
import {
  encodeShareState,
  SHARE_PARAM,
  shareStateFromSearch,
} from '@/core/state/shareState';

/**
 * `useShareState(moduleId)`: a module's `?s=` state, read on load and written back.
 *
 * Reading: the server render and the first client render use the module's defaults (a
 * static page has no query string), and the link is decoded right after hydration with
 * the phase-02 codec, which never throws: a bad link opens the defaults. `linked` keeps
 * what the link said, so a page can apply its step once.
 *
 * Writing: debounced, with `history.replaceState`. Next.js folds native `replaceState`
 * into its router (`useSearchParams` follows it) without the server round trip a
 * `router.replace` makes, and replacing rather than pushing means scrubbing a 300-tick
 * run leaves no history behind. At the defaults the URL has no `?s=` at all. `link()`
 * writes at once and returns the URL, for a "Copy link" button.
 *
 * Pass the module key (`'sched'`) to look it up in `SHARE_STATES`, or the definition
 * itself for a typed `state`.
 */

export interface UseShareState<S extends ShareStateBase> {
  state: S;
  /** Replace the state. The URL follows after the debounce delay. */
  setState(next: S | ((current: S) => S)): void;
  /** True once the URL has been read. Before that `state` is the defaults. */
  ready: boolean;
  /** The state the link decoded to, once read; `null` before. */
  linked: S | null;
  /** False when the current state is too large for a link. */
  shareable: boolean;
  /** Write the URL now and return it; `null` before `ready` or when too large. */
  link(): string | null;
}

export interface UseShareStateOptions {
  delayMs?: number;
}

/** The share-state definition for a module key. Throws on an unknown key. */
export function shareStateFor(moduleId: string): ModuleShareState {
  const definition = SHARE_STATES.find((entry) => entry.m === moduleId);
  if (!definition) throw new Error(`No share state registered for "${moduleId}"`);
  return definition;
}

function urlWith(encoded: string | null): URL {
  const url = new URL(window.location.href);
  if (encoded === null) url.searchParams.delete(SHARE_PARAM);
  else url.searchParams.set(SHARE_PARAM, encoded);
  return url;
}

/** What goes in `?s=`: `null` at the defaults, `undefined` when too large. */
function linkParam<S extends ShareStateBase>(
  definition: ModuleShareState<S>,
  state: S,
): string | null | undefined {
  const encoded = encodeShareState(definition, state);
  if (encoded === null) return undefined;
  return encoded === encodeShareState(definition, definition.defaults) ? null : encoded;
}

function replaceUrl(url: URL) {
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, '', url.href);
  }
}

export function useShareState<S extends ShareStateBase>(
  definition: ModuleShareState<S>,
  options?: UseShareStateOptions,
): UseShareState<S>;
export function useShareState(
  moduleId: string,
  options?: UseShareStateOptions,
): UseShareState<ShareStateBase>;
export function useShareState(
  module: string | ModuleShareState,
  { delayMs = 300 }: UseShareStateOptions = {},
): UseShareState<ShareStateBase> {
  const [definition] = useState(() =>
    typeof module === 'string' ? shareStateFor(module) : module,
  );
  // The link as the page opened: `null` on the server and while hydrating, then decoded
  // once and kept, so the hook's own later URL writes never feed back into it.
  const [opened] = useState(() => {
    let decoded: ShareStateBase | undefined;
    return {
      subscribe: () => () => {},
      get: () => (decoded ??= shareStateFromSearch(definition, window.location.search)),
      server: () => null,
    };
  });
  const linked = useSyncExternalStore(opened.subscribe, opened.get, opened.server);
  const [edited, setEdited] = useState<ShareStateBase | null>(null);
  const [shareable, setShareable] = useState(true);
  const ready = linked !== null;
  const state = edited ?? linked ?? definition.defaults;

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const param = linkParam(definition, state);
      setShareable(param !== undefined);
      // Too large for a link: drop `?s=` rather than keep a stale one.
      replaceUrl(urlWith(param ?? null));
    }, delayMs);
    return () => clearTimeout(timer);
  }, [definition, state, ready, delayMs]);

  const setState = useCallback(
    (next: ShareStateBase | ((current: ShareStateBase) => ShareStateBase)) => {
      setEdited((current) => {
        const base = current ?? linked ?? definition.defaults;
        return typeof next === 'function' ? next(base) : next;
      });
    },
    [linked, definition],
  );

  const link = useCallback((): string | null => {
    if (!ready) return null;
    const param = linkParam(definition, state);
    if (param === undefined) return null;
    const url = urlWith(param);
    replaceUrl(url);
    return url.href;
  }, [definition, state, ready]);

  return { state, setState, ready, linked, shareable, link };
}
