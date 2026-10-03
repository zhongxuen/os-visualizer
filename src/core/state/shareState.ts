/**
 * The URL share-state codec: `?s=<base64url(UTF-8(JSON))>`.
 *
 * Decoding never throws. A missing, malformed, oversized (> 4 KB), wrong-module,
 * wrong-version or otherwise invalid value decodes to the module's default, because a
 * broken link should open the module, not an error page.
 */

import { base64urlDecode, base64urlEncode } from './base64url';
import type { ModuleShareState, ShareStateBase } from './schema';

/** The query parameter that carries the state. */
export const SHARE_PARAM = 's';

/** Longest encoded value accepted or produced, in characters (4 KB). */
export const MAX_SHARE_STATE_LENGTH = 4096;

const encoder = new TextEncoder();
// `fatal`: invalid UTF-8 throws, and so falls back, instead of decoding to U+FFFD.
const decoder = new TextDecoder('utf-8', { fatal: true });

function copy<S>(value: S): S {
  return JSON.parse(JSON.stringify(value)) as S;
}

/**
 * Encode `state` for a link. Returns `null` if the result would be longer than
 * `MAX_SHARE_STATE_LENGTH`, so the page can say the state is too large to share.
 *
 * Throws if `state` doesn't match the module's schema: a programming error, not a user
 * error.
 */
export function encodeShareState<S extends ShareStateBase>(
  definition: ModuleShareState<S>,
  state: S,
): string | null {
  const parsed = definition.schema.safeParse(state);
  if (!parsed.success) {
    throw new Error(
      `Share state for "${definition.m}" is invalid: ${parsed.error.message}`,
    );
  }

  const encoded = base64urlEncode(encoder.encode(JSON.stringify(parsed.data)));
  return encoded.length > MAX_SHARE_STATE_LENGTH ? null : encoded;
}

/** Decode a `?s=` value for one module. Never throws; falls back to the defaults. */
export function decodeShareState<S extends ShareStateBase>(
  definition: ModuleShareState<S>,
  encoded: string | null | undefined,
): S {
  const fallback = () => copy(definition.defaults);

  if (typeof encoded !== 'string' || encoded.length === 0) return fallback();
  if (encoded.length > MAX_SHARE_STATE_LENGTH) return fallback();

  let json: unknown;
  try {
    json = JSON.parse(decoder.decode(base64urlDecode(encoded)));
  } catch {
    return fallback();
  }

  const parsed = definition.schema.safeParse(json);
  return parsed.success ? parsed.data : fallback();
}

/** Read the state from a query string (`'?s=...'`) or `URLSearchParams`. Never throws. */
export function shareStateFromSearch<S extends ShareStateBase>(
  definition: ModuleShareState<S>,
  search: string | URLSearchParams,
): S {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return decodeShareState(definition, params.get(SHARE_PARAM));
}

/** `'?s=...'` for a link, or `null` if the state is too large to share. */
export function shareStateToSearch<S extends ShareStateBase>(
  definition: ModuleShareState<S>,
  state: S,
): string | null {
  const encoded = encodeShareState(definition, state);
  // base64url needs no percent-encoding.
  return encoded === null ? null : `?${SHARE_PARAM}=${encoded}`;
}
