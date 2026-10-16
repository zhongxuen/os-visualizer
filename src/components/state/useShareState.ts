'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type {
  ModuleShareState,
  ShareStateBase,
  ShareStateSource,
} from '@/core/state/schema';
import {
  encodeShareJson,
  SHARE_PARAM,
  shareStateFromSearch,
} from '@/core/state/shareState';

/**
 * `useShareState(source)`: a module's `?s=` state, read on load and written back.
 *
 * Reading: the server render and the first client render use the module's defaults (a
 * static page has no query string), and the link is read right after hydration with the
 * phase-02 codec, which never throws: a bad link opens the defaults. `linked` keeps what
 * the link said, so a page can apply its step once. With no `?s=` (most visits) that is
 * at once. With one, the module's schema is loaded first (`source.load()`, its own chunk
 * with Zod), so `ready` turns true a moment later; until then the page shows the
 * defaults, as it did before hydration.
 *
 * Writing: debounced, with `history.replaceState`. Next.js folds native `replaceState`
 * into its router (`useSearchParams` follows it) without the server round trip a
 * `router.replace` makes, and replacing rather than pushing means scrubbing a 300-tick
 * run leaves no history behind. At the defaults the URL has no `?s=` at all. `link()`
 * writes at once and returns the URL, for a "Copy link" button. Writing needs no schema
 * (`encodeShareJson`): the state is the page's own.
 *
 * Pass the module's source (`SCHED_SHARE`, from `src/core/<name>/share.ts`), or a full
 * definition (`SCHED_SHARE_STATE`), which then decodes at once. Looking one up by key
 * (`shareStateFor`) lives in its own file: the registry imports every module's core, and
 * a module route needs only its own (docs/UIUX.md §10.5).
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

type ShareStateInput<S extends ShareStateBase> = ModuleShareState<S> | ShareStateSource<S>;

function hasSchema<S extends ShareStateBase>(
  input: ShareStateInput<S>,
): input is ModuleShareState<S> {
  return 'schema' in input;
}

function urlWith(encoded: string | null): URL {
  const url = new URL(window.location.href);
  if (encoded === null) url.searchParams.delete(SHARE_PARAM);
  else url.searchParams.set(SHARE_PARAM, encoded);
  return url;
}

/** What goes in `?s=`: `null` at the defaults, `undefined` when too large. */
function linkParam<S extends ShareStateBase>(
  definition: ShareStateInput<S>,
  state: S,
): string | null | undefined {
  const encoded = encodeShareJson(state);
  if (encoded === null) return undefined;
  return encoded === encodeShareJson(definition.defaults) ? null : encoded;
}

function replaceUrl(url: URL) {
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, '', url.href);
  }
}

/** The link as the page opened, read once: `null` while it is still being decoded. */
function openedLink<S extends ShareStateBase>(definition: ShareStateInput<S>) {
  let value: S | null | undefined;
  const listeners = new Set<() => void>();
  const settle = (next: S) => {
    value = next;
    listeners.forEach((listener) => listener());
  };
  const read = (): S | null => {
    const search = window.location.search;
    // No `?s=` at all (most visits): the defaults themselves, not a decoded copy, so the
    // state keeps its identity through hydration and the page does not recompute its
    // run and re-render everything a second time.
    if (!new URLSearchParams(search).has(SHARE_PARAM)) return definition.defaults;
    if (hasSchema(definition)) return shareStateFromSearch(definition, search);
    // Only a link loads the schema. If its chunk fails, open the defaults, as a bad
    // link does (a copy: the page was still opened from a link).
    definition.load().then(
      (full) => settle(shareStateFromSearch(full, search)),
      () => settle(JSON.parse(JSON.stringify(definition.defaults)) as S),
    );
    return null;
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: (): S | null => (value === undefined ? (value = read()) : value),
    server: (): S | null => null,
  };
}

export function useShareState<S extends ShareStateBase>(
  module: ShareStateInput<S>,
  options?: UseShareStateOptions,
): UseShareState<S>;
export function useShareState(
  module: ShareStateInput<ShareStateBase>,
  { delayMs = 300 }: UseShareStateOptions = {},
): UseShareState<ShareStateBase> {
  const [definition] = useState(() => module);
  // Decoded once and kept, so the hook's own later URL writes never feed back into it.
  const [opened] = useState(() => openedLink(definition));
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
