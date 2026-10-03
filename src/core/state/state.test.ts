import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';

import { base64urlDecode, base64urlEncode } from './base64url';
import { SHARE_STATES } from './modules';
import { defineShareState, intBetween, type ModuleShareState } from './schema';
import {
  decodeShareState,
  encodeShareState,
  MAX_SHARE_STATE_LENGTH,
  shareStateFromSearch,
  shareStateToSearch,
} from './shareState';

/** A stand-in module branch, shaped like a real one (a small scheduling workload). */
const DEMO = defineShareState({
  m: 'demo',
  v: 1,
  input: z.object({
    policy: z.enum(['fcfs', 'sjf', 'rr']),
    quantum: intBetween(1, 20),
    processes: z
      .array(
        z.object({
          name: z.string().check(z.maxLength(40)),
          arrival: intBetween(0, 1000),
          burst: intBetween(1, 1000),
        }),
      )
      .check(z.maxLength(200)),
  }),
  defaults: {
    step: 0,
    input: {
      policy: 'fcfs',
      quantum: 2,
      processes: [{ name: 'P1', arrival: 0, burst: 3 }],
    },
  },
});

const OTHER = defineShareState({
  m: 'other',
  v: 1,
  input: z.object({ n: z.number() }),
  defaults: { step: 0, input: { n: 1 } },
});

const demoState = fc.record(
  {
    m: fc.constant('demo' as const),
    v: fc.constant(1),
    step: fc.integer({ min: 0, max: 100_000 }),
    input: fc.record(
      {
        policy: fc.constantFrom('fcfs' as const, 'sjf' as const, 'rr' as const),
        quantum: fc.integer({ min: 1, max: 20 }),
        processes: fc.array(
          fc.record(
            {
              name: fc.string({ maxLength: 12, unit: 'grapheme' }),
              arrival: fc.integer({ min: 0, max: 1000 }),
              burst: fc.integer({ min: 1, max: 1000 }),
            },
            { noNullPrototype: true },
          ),
          { maxLength: 8 },
        ),
      },
      { noNullPrototype: true },
    ),
  },
  { noNullPrototype: true },
);

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

describe('base64url', () => {
  it('encodes as Buffer does', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        expect(base64urlEncode(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
      }),
    );
  });

  it('decodes what Buffer encodes, padded or not', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        const unpadded = Buffer.from(bytes).toString('base64url');
        const padded = unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
        expect(base64urlDecode(unpadded)).toEqual(bytes);
        expect(base64urlDecode(padded)).toEqual(bytes);
      }),
    );
  });

  it('matches the RFC 4648 test vectors', () => {
    const vectors: [string, string][] = [
      ['', ''],
      ['f', 'Zg'],
      ['fo', 'Zm8'],
      ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg'],
      ['fooba', 'Zm9vYmE'],
      ['foobar', 'Zm9vYmFy'],
    ];
    for (const [text, encoded] of vectors) {
      const bytes = new TextEncoder().encode(text);
      expect(base64urlEncode(bytes)).toBe(encoded);
      expect(base64urlDecode(encoded)).toEqual(bytes);
    }
  });

  it('uses - and _ rather than + and /', () => {
    expect(base64urlEncode(Uint8Array.from([0xfb, 0xff]))).toBe('-_8');
  });

  it.each([
    ['a character outside the alphabet', 'ab+c'],
    ['an impossible length', 'abcde'],
    ['leftover bits', 'Zh'],
    ['padding on the wrong length', 'Zg='],
  ])('rejects %s', (_name, text) => {
    expect(() => base64urlDecode(text)).toThrow(RangeError);
  });
});

describe('encode → decode', () => {
  it('is the identity on valid states', () => {
    fc.assert(
      fc.property(demoState, (state) => {
        const encoded = encodeShareState(DEMO, state);
        expect(encoded).not.toBeNull();
        expect(decodeShareState(DEMO, encoded)).toStrictEqual(state);
      }),
    );
  });

  it('encodes UTF-8 JSON as base64url', () => {
    const encoded = encodeShareState(DEMO, DEMO.defaults);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.parse(Buffer.from(encoded!, 'base64url').toString('utf8'))).toEqual(
      DEMO.defaults,
    );
  });

  it('works through a query string', () => {
    const state = { ...DEMO.defaults, step: 12 };
    const search = shareStateToSearch(DEMO, state);
    expect(search).toMatch(/^\?s=/);
    expect(shareStateFromSearch(DEMO, search!)).toStrictEqual(state);
    expect(shareStateFromSearch(DEMO, new URLSearchParams(search!))).toStrictEqual(state);
  });
});

describe('decode falls back to the default and never throws', () => {
  const valid = encodeShareState(DEMO, { ...DEMO.defaults, step: 3 })!;

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['non-base64url characters', '!!!***'],
    ['an impossible base64url length', 'abcde'],
    [
      'base64url that is not UTF-8',
      Buffer.from([0xff, 0xfe, 0x7b]).toString('base64url'),
    ],
    ['base64url that is not JSON', b64('not json')],
    ['JSON that is not an object', b64('42')],
    ['JSON null', b64('null')],
    ['another module’s state', encodeShareState(OTHER, OTHER.defaults)],
    ['a newer version', b64(JSON.stringify({ ...DEMO.defaults, v: 2 }))],
    ['a missing field', b64(JSON.stringify({ m: 'demo', v: 1, step: 0 }))],
    ['a negative step', b64(JSON.stringify({ ...DEMO.defaults, step: -1 }))],
    ['a fractional step', b64(JSON.stringify({ ...DEMO.defaults, step: 1.5 }))],
    [
      'an input of the wrong shape',
      b64(JSON.stringify({ ...DEMO.defaults, input: { policy: 'lottery' } })),
    ],
    ['a truncated link', valid.slice(0, -3)],
    ['an oversized value', 'A'.repeat(MAX_SHARE_STATE_LENGTH + 4)],
  ])('%s', (_name, encoded) => {
    expect(decodeShareState(DEMO, encoded)).toStrictEqual(DEMO.defaults);
  });

  it('survives arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        expect(() => decodeShareState(DEMO, text)).not.toThrow();
      }),
    );
  });

  it('survives arbitrary base64url bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 200 }), (bytes) => {
        expect(() =>
          decodeShareState(DEMO, Buffer.from(bytes).toString('base64url')),
        ).not.toThrow();
      }),
    );
  });

  it('returns a fresh copy of the defaults each time', () => {
    const first = decodeShareState(DEMO, null);
    first.input.processes[0].name = 'mutated';
    expect(decodeShareState(DEMO, null).input.processes[0].name).toBe('P1');
    expect(DEMO.defaults.input.processes[0].name).toBe('P1');
  });
});

describe('4 KB limit', () => {
  const big = {
    ...DEMO.defaults,
    input: {
      ...DEMO.defaults.input,
      processes: Array.from({ length: 150 }, (_, i) => ({
        name: `Process number ${i}`,
        arrival: i,
        burst: 999,
      })),
    },
  };

  it('returns null rather than a link longer than 4 KB', () => {
    expect(encodeShareState(DEMO, big)).toBeNull();
    expect(shareStateToSearch(DEMO, big)).toBeNull();
  });

  it('falls back when a schema-valid value is longer than 4 KB', () => {
    const encoded = b64(JSON.stringify(big));
    expect(encoded.length).toBeGreaterThan(MAX_SHARE_STATE_LENGTH);
    expect(decodeShareState(DEMO, encoded)).toStrictEqual(DEMO.defaults);
  });
});

describe('defineShareState', () => {
  it('rejects defaults that do not match the schema', () => {
    expect(() =>
      defineShareState({
        m: 'bad',
        v: 1,
        input: z.object({ n: z.number().check(z.gte(10)) }),
        defaults: { step: 0, input: { n: 1 } },
      }),
    ).toThrow(/defaults are invalid/);
  });

  it('rejects an invalid state on encode', () => {
    expect(() => encodeShareState(DEMO, { ...DEMO.defaults, step: -1 })).toThrow(
      /invalid/,
    );
  });
});

describe('SHARE_STATES registry', () => {
  // A narrow branch fits the registry's element type.
  const extra: readonly ModuleShareState[] = [DEMO, OTHER];

  it('has one branch per core module', () => {
    const keys = SHARE_STATES.map((definition) => definition.m);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(['sched', 'vm', 'replace', 'deadlock']));
  });

  it('round-trips every module’s defaults through a link', () => {
    for (const definition of [...SHARE_STATES, ...extra]) {
      const encoded = encodeShareState(definition, definition.defaults);
      expect(encoded, definition.m).not.toBeNull();
      expect(decodeShareState(definition, encoded)).toStrictEqual(definition.defaults);
    }
  });

  it('decodes one module’s link as the default in every other module', () => {
    for (const from of SHARE_STATES) {
      const encoded = encodeShareState(from, from.defaults);
      for (const to of SHARE_STATES) {
        if (to === from) continue;
        expect(decodeShareState(to, encoded), `${from.m} → ${to.m}`).toStrictEqual(
          to.defaults,
        );
      }
    }
  });
});
