import { describe, expect, it } from 'vitest';

import { pageTableSizes, presetById, runVm } from '@/core/vm';

import { eventsOf, final, kindsOf, tlbPattern } from './helpers';

/**
 * OSTEP v1.10 ch. 18-20 worked examples. Recorded in tests/fixtures/README.md.
 */

function preset(id: string) {
  const p = presetById(id);
  if (!p) throw new Error(`no preset ${id}`);
  return p;
}

describe('OSTEP §18.1 a simple example (64-byte space, 16-byte pages)', () => {
  const run = runVm(preset('ostep-paging').input);

  it('VA 21 = 01 0101: VPN 1, offset 5', () => {
    const split = eventsOf(run, 0)[0]!;
    expect(split.kind).toBe('vm.split');
    expect(split.state.fields).toMatchObject({ vpn: 1, offset: 5 });
    expect(split.label).toContain('01 0101');
  });

  it('VPN 1 maps to PFN 7, so the physical address is 1110101 = 117', () => {
    const physical = eventsOf(run, 0).find((e) => e.kind === 'vm.physical')!;
    expect(physical.pfn).toBe(7);
    expect(physical.pa).toBe(117);
    expect(physical.label).toContain('111 0101');
  });

  it('the other pages of Figure 18.2 translate the same way', () => {
    expect(final(run).log.map((r) => r.pa)).toEqual([117, 48, 85, 47]);
  });
});

describe('OSTEP §18.2 page-table size', () => {
  it('a 32-bit address space with 4 KB pages and 4-byte PTEs needs a 4 MB linear table', () => {
    const sizes = pageTableSizes({ vaBits: 32, pageSize: 4096, regions: [] });
    expect(sizes.vpnBits).toBe(20);
    expect(sizes.linearEntries).toBe(2 ** 20);
    expect(sizes.linearBytes).toBe(4 * 1024 * 1024);
  });
});

describe('OSTEP §19.2 accessing an array', () => {
  it('ten ints from VA 100: miss, hit, hit, miss, hit, hit, hit, miss, hit, hit = 70%', () => {
    const run = runVm(preset('ostep-array').input);
    expect(tlbPattern(run)).toBe('miss hit hit miss hit hit hit miss hit hit');
    const { counters } = final(run);
    expect(counters.hits / (counters.hits + counters.misses)).toBe(0.7);
  });

  it('a[0] at VA 100 is VPN 6, offset 4; a[3] at 112 starts VPN 7; a[7] at 128 starts VPN 8', () => {
    const run = runVm(preset('ostep-array').input);
    const fields = (i: number) => eventsOf(run, i)[0]!.state.fields;
    expect(fields(0)).toMatchObject({ vpn: 6, offset: 4 });
    expect(fields(3)).toMatchObject({ vpn: 7, offset: 0 });
    expect(fields(7)).toMatchObject({ vpn: 8, offset: 0 });
  });

  it('a second pass hits every time (temporal locality)', () => {
    const run = runVm(preset('ostep-array-twice').input);
    const log = final(run).log;
    expect(log.slice(10).every((r) => r.tlb === 'hit')).toBe(true);
    expect(final(run).counters.hits).toBe(17);
  });
});

describe('OSTEP §20.3 multi-level page tables', () => {
  const run = runVm(preset('two-level').input);

  it('VA 0x3F80 is VPN 254: directory index 15 (1111), table index 14 (1110), offset 0', () => {
    expect(eventsOf(run, 0)[0]!.state.fields).toMatchObject({
      vpn: 254,
      pdIndex: 15,
      ptIndex: 14,
      offset: 0,
    });
  });

  it('reads PDE 15 at PDBR + 15 × 4, then the PTE at 101 × 64 + 14 × 4', () => {
    expect(kindsOf(run, 0)).toEqual([
      'vm.split',
      'vm.tlbMiss',
      'vm.readPde',
      'vm.readPte',
      'vm.protOk',
      'vm.tlbInsert',
      'vm.physical',
      'vm.memory',
    ]);
    const [pde, pte] = eventsOf(run, 0).filter((e) => e.step === 3);
    expect(pde!.address).toBe(96 * 64 + 15 * 4);
    expect(pde!.pfn).toBe(101);
    expect(pte!.address).toBe(101 * 64 + 14 * 4);
    expect(pte!.pfn).toBe(55);
  });

  it('PA = PFN 55 << 6 | 0 = 0x0DC0', () => {
    expect(final(run).log[0]!.pa).toBe(0x0dc0);
    expect(final(run).log[0]!.memRefs).toBe(3);
  });

  it('allocates three pages of page table instead of sixteen', () => {
    const sizes = pageTableSizes(preset('two-level').sizing);
    expect(sizes.linearBytes).toBe(16 * 64);
    expect(sizes.tablePagesTotal).toBe(16);
    expect(sizes.tablePages).toBe(2);
    expect(sizes.directoryBytes).toBe(64);
    expect(sizes.twoLevelBytes).toBe(3 * 64);
    expect(sizes.refsPerMiss).toEqual({ linear: 1, twoLevel: 2 });
  });
});
