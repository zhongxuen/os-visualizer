/**
 * base64url, RFC 4648 §5: base64 with `-` and `_` in place of `+` and `/`.
 *
 * Hand-written so core needs neither `Buffer` (node only) nor `btoa` (Latin-1 strings
 * only); `state.test.ts` checks both directions against `Buffer` on random bytes.
 *
 * Encoding never pads, which is what share links want. Decoding accepts input with or
 * without `=` padding, but is otherwise strict: it rejects characters outside the
 * alphabet, impossible lengths and non-zero leftover bits. Strictness means each byte
 * string has exactly one encoding, so encode ∘ decode is the identity too.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const VALUES = new Map<string, number>([...ALPHABET].map((char, index) => [char, index]));

export function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const remaining = bytes.length - i;
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63];
    if (remaining > 1) out += ALPHABET[(chunk >> 6) & 63];
    if (remaining > 2) out += ALPHABET[chunk & 63];
  }
  return out;
}

/** Throws `RangeError` for anything that isn't canonical base64url. */
export function base64urlDecode(text: string): Uint8Array {
  const unpadded = text.replace(/={1,2}$/, '');
  if (unpadded.length !== text.length && text.length % 4 !== 0) {
    throw new RangeError('base64url padding does not match the length');
  }
  if (unpadded.length % 4 === 1) {
    throw new RangeError(`Impossible base64url length ${unpadded.length}`);
  }

  const bytes = new Uint8Array(Math.floor((unpadded.length * 3) / 4));
  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (const char of unpadded) {
    const value = VALUES.get(char);
    if (value === undefined) throw new RangeError(`Not a base64url character: "${char}"`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex] = (buffer >> bits) & 0xff;
      byteIndex += 1;
    }
    buffer &= (1 << bits) - 1;
  }

  if (buffer !== 0) {
    throw new RangeError('Non-canonical base64url: leftover bits are set');
  }
  return bytes;
}
