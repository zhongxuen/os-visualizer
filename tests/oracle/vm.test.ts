import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  directoryFor,
  geometry,
  pageTableSizes,
  PTE_BYTES,
  runVm,
  tlbOccupancy,
  validateVmInput,
  type Access,
  type SizingInput,
  type VmConfig,
  type VmInput,
  type VmRun,
} from '@/core/vm';

/**
 * Oracle and property tests for address translation: 500 random valid inputs per
 * property on fast-check's fixed global seed (tests/setup-core.ts).
 *
 * The oracle is plain arithmetic: `PA = table[va >> offsetBits].pfn × pageSize +
 * va mod pageSize`, with the fault the mapping implies, and a two-level run must agree
 * with the one-level run of the same mapping.
 */

const RUNS = 500;

interface Machine {
  vaBits: number;
  paBits: number;
  offsetBits: number;
}

const machineArb: fc.Arbitrary<Machine> = fc
  .record({
    vaBits: fc.integer({ min: 6, max: 16 }),
    paBits: fc.integer({ min: 6, max: 16 }),
    offsetBits: fc.integer({ min: 2, max: 15 }),
  })
  .filter((m) => m.offsetBits < m.vaBits && m.offsetBits < m.paBits);

function canTwoLevel(m: Machine): boolean {
  const ptIndexBits = m.offsetBits - 2;
  return ptIndexBits >= 1 && m.vaBits - m.offsetBits - ptIndexBits >= 1;
}

interface Options {
  /** Force the number of levels (filtered when impossible). */
  levels?: 1 | 2;
  tlbSize?: fc.Arbitrary<number>;
  /** Only valid pages, only reads. */
  clean?: boolean;
}

/** A random valid input: a pool of pages, accesses that mostly reuse it. */
function inputArb(options: Options = {}): fc.Arbitrary<VmInput> {
  return machineArb
    .chain((m) => {
      const vpnBits = m.vaBits - m.offsetBits;
      const pfnBits = m.paBits - m.offsetBits;
      const pageSize = 2 ** m.offsetBits;
      const levels =
        options.levels !== undefined
          ? fc.constant(options.levels)
          : canTwoLevel(m)
            ? fc.constantFrom<1 | 2>(1, 2)
            : fc.constant<1 | 2>(1);
      const page = fc.record({
        vpn: fc.integer({ min: 0, max: 2 ** vpnBits - 1 }),
        // Mostly valid, so most accesses get past the walk.
        valid: options.clean
          ? fc.constant(true)
          : fc.constantFrom(true, true, true, false),
        pfn: fc.integer({ min: 0, max: 2 ** pfnBits - 1 }),
        prot: options.clean
          ? fc.constant<'rw'>('rw')
          : fc.constantFrom<'r' | 'rw'>('r', 'rw', 'rw'),
      });
      return fc.record({
        m: fc.constant(m),
        levels,
        tlbSize: options.tlbSize ?? fc.integer({ min: 0, max: 8 }),
        tlbPolicy: fc.constantFrom<'lru' | 'fifo'>('lru', 'fifo'),
        ptbrSlot: fc.nat(),
        pages: fc.uniqueArray(page, {
          minLength: 1,
          maxLength: 10,
          selector: (p) => p.vpn,
        }),
        picks: fc.array(
          fc.record({
            pool: fc.nat(),
            // About one access in ten goes to a page outside the pool (usually unmapped).
            stray: options.clean
              ? fc.constant(false)
              : fc.integer({ min: 0, max: 9 }).map((n) => n === 0),
            strayVpn: fc.integer({ min: 0, max: 2 ** vpnBits - 1 }),
            offset: fc.integer({ min: 0, max: pageSize - 1 }),
            write: options.clean ? fc.constant(false) : fc.boolean(),
          }),
          { minLength: 1, maxLength: 40 },
        ),
      });
    })
    .map(({ m, levels, tlbSize, tlbPolicy, ptbrSlot, pages, picks }) => {
      const pageSize = 2 ** m.offsetBits;
      const partial: VmConfig = {
        vaBits: m.vaBits,
        paBits: m.paBits,
        pageSize,
        levels,
        tlbSize,
        tlbPolicy,
        ptbr: 0,
      };
      const g = geometry(partial);
      const room = 2 ** m.paBits - g.rootBytes;
      const config = {
        ...partial,
        ptbr: room < 0 ? 0 : (ptbrSlot % (Math.floor(room / PTE_BYTES) + 1)) * PTE_BYTES,
      };
      const accesses: Access[] = picks.map((p) => {
        const vpn = p.stray ? p.strayVpn : pages[p.pool % pages.length]!.vpn;
        return { va: vpn * pageSize + p.offset, op: p.write ? 'write' : 'read' };
      });
      return {
        config,
        pages,
        directory: directoryFor(config, pages),
        accesses,
      };
    })
    .filter((input) => validateVmInput(input).ok);
}

function final(run: VmRun) {
  return run.events.at(-1)!.state;
}

/** The arithmetic reference for one access. */
function reference(input: VmInput, access: Access) {
  const { pageSize } = input.config;
  const vpn = Math.floor(access.va / pageSize);
  const row = input.pages.find((p) => p.vpn === vpn);
  if (!row || !row.valid) return { fault: 'invalid' as const, pa: null };
  if (access.op === 'write' && row.prot === 'r') {
    return { fault: 'protection' as const, pa: null };
  }
  return { fault: null, pa: row.pfn * pageSize + (access.va % pageSize) };
}

describe('address translation oracle', () => {
  it('every PA and fault matches plain arithmetic', () => {
    fc.assert(
      fc.property(inputArb(), (input) => {
        const log = final(runVm(input)).log;
        expect(log).toHaveLength(input.accesses.length);
        log.forEach((result, i) => {
          expect({ fault: result.fault, pa: result.pa }).toEqual(
            reference(input, input.accesses[i]!),
          );
        });
      }),
      { numRuns: RUNS },
    );
  });

  it('a two-level run agrees with the one-level run of the same mapping', () => {
    fc.assert(
      fc.property(inputArb({ levels: 2 }), (two) => {
        const one: VmInput = {
          ...two,
          config: { ...two.config, levels: 1, ptbr: 0 },
          directory: [],
        };
        fc.pre(validateVmInput(one).ok);
        const a = final(runVm(one)).log;
        const b = final(runVm(two)).log;
        expect(b.map(({ tlb, fault, pa }) => ({ tlb, fault, pa }))).toEqual(
          a.map(({ tlb, fault, pa }) => ({ tlb, fault, pa })),
        );
      }),
      { numRuns: RUNS },
    );
  });
});

describe('address translation properties', () => {
  it('memory references per completed access: 1 on a hit, levels + 1 on a miss', () => {
    fc.assert(
      fc.property(inputArb(), (input) => {
        for (const r of final(runVm(input)).log) {
          if (r.fault) continue;
          expect(r.memRefs).toBe(r.tlb === 'hit' ? 1 : input.config.levels + 1);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('TLB occupancy never exceeds its size', () => {
    fc.assert(
      fc.property(inputArb(), (input) => {
        for (const event of runVm(input).events) {
          expect(event.state.tlb).toHaveLength(input.config.tlbSize);
          expect(tlbOccupancy(event.state.tlb)).toBeLessThanOrEqual(input.config.tlbSize);
          const vpns = event.state.tlb.flatMap((e) => (e ? [e.vpn] : []));
          expect(new Set(vpns).size).toBe(vpns.length);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('with a TLB at least as large as the pages touched, misses = distinct valid pages', () => {
    fc.assert(
      fc.property(inputArb({ clean: true, tlbSize: fc.constant(8) }), (input) => {
        const distinct = new Set(
          input.accesses.map((a) => Math.floor(a.va / input.config.pageSize)),
        );
        fc.pre(distinct.size <= input.config.tlbSize);
        expect(final(runVm(input)).counters.misses).toBe(distinct.size);
      }),
      { numRuns: RUNS },
    );
  });

  it('with faults too, misses among completed accesses = distinct pages completed', () => {
    fc.assert(
      fc.property(inputArb({ tlbSize: fc.constant(8) }), (input) => {
        fc.pre(input.pages.length <= 8);
        const done = final(runVm(input)).log.filter((r) => !r.fault);
        const distinct = new Set(
          done.map((r) => Math.floor(r.va / input.config.pageSize)),
        );
        expect(done.filter((r) => r.tlb === 'miss')).toHaveLength(distinct.size);
      }),
      { numRuns: RUNS },
    );
  });

  it('a TLB with 0 entries walks the page table on every access', () => {
    fc.assert(
      fc.property(inputArb({ tlbSize: fc.constant(0) }), (input) => {
        const run = runVm(input);
        expect(final(run).counters.hits).toBe(0);
        input.accesses.forEach((_, i) => {
          expect(run.events.some((e) => e.access === i && e.step === 3)).toBe(true);
        });
      }),
      { numRuns: RUNS },
    );
  });

  it('one phase per access, steps in order, counters that add up', () => {
    fc.assert(
      fc.property(inputArb(), (input) => {
        const run = runVm(input);
        expect(run.phases.map((p) => p.id)).toEqual(
          input.accesses.map((_, i) => `access-${i}`),
        );
        let previous = { access: -1, step: 0, memRefs: 0 };
        for (const e of run.events) {
          if (e.access === previous.access)
            expect(e.step).toBeGreaterThanOrEqual(previous.step);
          else expect(e.access).toBe(previous.access + 1);
          expect(e.state.counters.memRefs).toBeGreaterThanOrEqual(previous.memRefs);
          previous = {
            access: e.access,
            step: e.step,
            memRefs: e.state.counters.memRefs,
          };
        }
        const { counters, log } = final(run);
        expect(counters.accesses).toBe(input.accesses.length);
        expect(counters.hits + counters.misses).toBe(input.accesses.length);
        expect(counters.faults).toBe(log.filter((r) => r.fault).length);
        expect(counters.memRefs).toBe(log.reduce((sum, r) => sum + r.memRefs, 0));
      }),
      { numRuns: RUNS },
    );
  });
});

describe('page-table sizing', () => {
  const sizingArb: fc.Arbitrary<SizingInput> = fc
    .record({
      vaBits: fc.integer({ min: 6, max: 32 }),
      offsetBits: fc.integer({ min: 3, max: 31 }),
    })
    .filter(({ vaBits, offsetBits }) => offsetBits < vaBits)
    .chain(({ vaBits, offsetBits }) => {
      const pages = 2 ** (vaBits - offsetBits);
      const region = fc.integer({ min: 0, max: pages - 1 }).chain((start) =>
        fc.record({
          name: fc.constant('r'),
          start: fc.constant(start),
          pages: fc.integer({ min: 1, max: Math.min(pages - start, 64) }),
        }),
      );
      return fc.record({
        vaBits: fc.constant(vaBits),
        pageSize: fc.constant(2 ** offsetBits),
        regions: fc.array(region, { maxLength: 8 }),
      });
    });

  it('linear size = 2^VPNbits × PTE size; two-level ≤ linear + one directory page', () => {
    fc.assert(
      fc.property(sizingArb, (input) => {
        const s = pageTableSizes(input);
        expect(s.linearBytes).toBe(
          2 ** (input.vaBits - Math.log2(input.pageSize)) * PTE_BYTES,
        );
        // Page-table pages are whole pages, so compare against the linear table rounded up
        // to pages (it differs only when the whole table is smaller than one page).
        const linearPages = Math.ceil(s.linearBytes / input.pageSize) * input.pageSize;
        expect(s.twoLevelBytes).toBeLessThanOrEqual(linearPages + s.directoryBytes);
        if (s.directoryFitsInPage) {
          expect(s.twoLevelBytes).toBeLessThanOrEqual(s.linearBytes + input.pageSize);
        }
        expect(s.tablePages).toBeLessThanOrEqual(
          Math.min(s.tablePagesTotal, s.usedPages),
        );
      }),
      { numRuns: RUNS },
    );
  });

  it('counts used pages and page-table pages the same as enumerating them', () => {
    fc.assert(
      fc.property(sizingArb, (input) => {
        const s = pageTableSizes(input);
        const vpns = new Set<number>();
        for (const r of input.regions) {
          for (let v = r.start; v < r.start + r.pages; v++) vpns.add(v);
        }
        const perTablePage = 2 ** s.ptIndexBits;
        const tables = new Set([...vpns].map((v) => Math.floor(v / perTablePage)));
        expect(s.usedPages).toBe(vpns.size);
        expect(s.tablePages).toBe(tables.size);
      }),
      { numRuns: RUNS },
    );
  });
});
