import { describe, expect, it } from 'vitest';

import { VM_RULES, type VmConfig, type VmInput } from '@/core/vm';
import { createTlb, tlbInsert, victimSlot } from '@/core/vm/tlb';

import { eventsOf, kindsOf, run } from './helpers';

/**
 * One test per rule in `src/core/vm/rules.ts`, named after the rule id. The last test
 * checks the list and the tests stay in step.
 */

const TESTED = new Set<string>();
function rule(id: string, body: () => void) {
  TESTED.add(id);
  it(id, body);
}

const CONFIG: VmConfig = {
  vaBits: 8,
  paBits: 10,
  pageSize: 16,
  levels: 1,
  tlbSize: 2,
  tlbPolicy: 'lru',
  ptbr: 0,
};

/** VPN 0 read-only, VPNs 1-2 read-write, VPN 3 listed but invalid, the rest unlisted. */
function input(
  vas: (number | [number, 'read' | 'write'])[],
  config: Partial<VmConfig> = {},
): VmInput {
  return {
    config: { ...CONFIG, ...config },
    pages: [
      { vpn: 0, valid: true, pfn: 10, prot: 'r' },
      { vpn: 1, valid: true, pfn: 11, prot: 'rw' },
      { vpn: 2, valid: true, pfn: 12, prot: 'rw' },
      { vpn: 3, valid: false, pfn: 13, prot: 'rw' },
    ],
    directory: [],
    accesses: vas.map((v) =>
      typeof v === 'number' ? { va: v, op: 'read' } : { va: v[0], op: v[1] },
    ),
  };
}

/** 8-bit VA, 16-byte pages, two levels: 2 directory bits, 2 table bits, 4 offset bits. */
function twoLevel(vas: number[]): VmInput {
  return {
    ...input(vas),
    config: { ...CONFIG, levels: 2, ptbr: 64 },
    pages: [{ vpn: 0xa, valid: true, pfn: 3, prot: 'rw' }],
    directory: [{ index: 2, pfn: 9 }],
  };
}

describe('address translation rules', () => {
  rule('vm.order.tlbFirst', () => {
    const { result } = run(input([0x10, 0x14]));
    expect(kindsOf(result, 0).slice(1, 3)).toEqual(['vm.tlbMiss', 'vm.readPte']);
    expect(kindsOf(result, 1)).toEqual([
      'vm.split',
      'vm.tlbHit',
      'vm.protOk',
      'vm.physical',
      'vm.memory',
    ]);
  });

  rule('vm.tlb.model', () => {
    const { state } = run(input([0x10]));
    expect(Object.keys(state.tlb[0]!).sort()).toEqual(
      ['lastUsed', 'loadedAt', 'pfn', 'prot', 'vpn'].sort(),
    );
    // Fully associative: any VPN can go in any slot.
    expect(run(input([0x20])).state.tlb[0]!.vpn).toBe(2);
  });

  rule('vm.tlb.fill', () => {
    // Lowest empty slot first.
    const tlb = tlbInsert(createTlb(3), 'lru', { vpn: 5, pfn: 1, prot: 'rw' }, 0).tlb;
    expect(victimSlot(tlb, 'lru')).toBe(1);
    expect(victimSlot([null, ...tlb.slice(1)], 'lru')).toBe(0);
    // LRU: reading VPN 0 again makes VPN 1 the victim. FIFO: VPN 0 is still the oldest.
    const lru = run(input([0x00, 0x10, 0x00, 0x20]));
    expect(lru.state.tlb.map((e) => e?.vpn)).toEqual([0, 2]);
    const fifo = run(input([0x00, 0x10, 0x00, 0x20], { tlbPolicy: 'fifo' }));
    expect(fifo.state.tlb.map((e) => e?.vpn)).toEqual([2, 1]);
    const insert = eventsOf(fifo.result, 3).find((e) => e.kind === 'vm.tlbInsert')!;
    expect(insert.evicted?.vpn).toBe(0);
    // Equal keys go to the lowest slot.
    const tie = [
      { vpn: 1, pfn: 1, prot: 'rw' as const, loadedAt: 0, lastUsed: 4 },
      { vpn: 2, pfn: 2, prot: 'rw' as const, loadedAt: 0, lastUsed: 4 },
    ];
    expect(victimSlot(tie, 'lru')).toBe(0);
    expect(victimSlot(tie, 'fifo')).toBe(0);
  });

  rule('vm.tlb.none', () => {
    const { result, state } = run(input([0x10, 0x10, 0x10], { tlbSize: 0 }));
    expect(state.tlb).toEqual([]);
    expect(state.counters).toMatchObject({ hits: 0, misses: 3, memRefs: 6 });
    expect(result.events.some((e) => e.kind === 'vm.tlbInsert')).toBe(false);
  });

  rule('vm.walk.hardware', () => {
    // The walk is part of the access: no trap, and the walk's read is counted.
    const { result, state } = run(input([0x10]));
    expect(kindsOf(result, 0)).toContain('vm.readPte');
    expect(state.log[0]!.memRefs).toBe(2);
  });

  rule('vm.pte.size', () => {
    const { result } = run(input([0x30, 0x40]));
    // VPN 3 is listed but invalid; VPN 4 is not listed at all. Both are invalid.
    expect(eventsOf(result, 0).at(-1)).toMatchObject({ kind: 'vm.fault', table: 'pte' });
    expect(eventsOf(result, 1).at(-1)).toMatchObject({ kind: 'vm.fault', table: 'pte' });
    expect(eventsOf(result, 1).at(-1)!.address).toBe(4 * 4);
  });

  rule('vm.pte.address', () => {
    const { result } = run(input([0x20], { ptbr: 128 }));
    expect(eventsOf(result, 0).find((e) => e.kind === 'vm.readPte')!.address).toBe(
      128 + 2 * 4,
    );
    const two = run(twoLevel([0xa7]));
    const [pde, pte] = eventsOf(two.result, 0).filter((e) => e.step === 3);
    expect(pde!.address).toBe(64 + 2 * 4);
    expect(pte!.address).toBe(9 * 16 + 2 * 4);
  });

  rule('vm.split.twoLevel', () => {
    // 16-byte pages hold 4 PTEs → 2 table-index bits; the other 2 VPN bits index the
    // directory. 0xA7 = 10 10 0111.
    expect(run(twoLevel([0xa7])).state.fields).toEqual({
      va: 0xa7,
      vpn: 10,
      offset: 7,
      pdIndex: 2,
      ptIndex: 2,
    });
  });

  rule('vm.fault.stop', () => {
    const { result, state } = run(input([0x30, [0x04, 'write'], 0x40]));
    for (const i of [0, 1, 2]) {
      const events = eventsOf(result, i);
      expect(events.at(-1)!.kind).toBe('vm.fault');
      expect(
        events.some((e) => e.kind === 'vm.tlbInsert' || e.kind === 'vm.memory'),
      ).toBe(false);
    }
    expect(state.log.map((r) => r.fault)).toEqual(['invalid', 'protection', 'invalid']);
    expect(state.log.map((r) => r.pa)).toEqual([null, null, null]);
    expect(state.tlb).toEqual([null, null]);
    expect(state.counters.faults).toBe(3);
  });

  rule('vm.prot.hit', () => {
    const { result } = run(input([0x00, [0x04, 'write']]));
    expect(kindsOf(result, 1)).toEqual(['vm.split', 'vm.tlbHit', 'vm.fault']);
    expect(eventsOf(result, 1).at(-1)).toMatchObject({ fault: 'protection', slot: 0 });
  });

  rule('vm.bits.hardware', () => {
    const { result, state } = run(input([0x10, [0x14, 'write'], 0x20]));
    const bits = (vpn: number) => state.ptes.find((p) => p.vpn === vpn)!;
    expect(bits(1)).toMatchObject({ accessed: true, dirty: true });
    expect(bits(2)).toMatchObject({ accessed: true, dirty: false });
    expect(bits(0)).toMatchObject({ accessed: false, dirty: false });
    // The write was a TLB hit and still set dirty, without an extra reference.
    expect(state.log[1]).toMatchObject({ tlb: 'hit', memRefs: 1 });
    // Before step 6 of the first access the bits were still clear.
    const before = eventsOf(result, 0).find((e) => e.kind === 'vm.protOk')!;
    expect(before.state.ptes.find((p) => p.vpn === 1)!.accessed).toBe(false);
    // A faulting access sets nothing.
    expect(run(input([[0x00, 'write']])).state.ptes[0]!.accessed).toBe(false);
  });

  rule('vm.refs.count', () => {
    const { state } = run(input([0x10, 0x10, 0x30, [0x00, 'write']]));
    // Miss 2, hit 1, invalid PTE after 1 read, protection fault after 1 read.
    expect(state.log.map((r) => r.memRefs)).toEqual([2, 1, 1, 1]);
    expect(state.counters.memRefs).toBe(5);
    // A full two-level miss is 3; an invalid PDE stops after 1.
    expect(run(twoLevel([0xa7, 0x07])).state.log.map((r) => r.memRefs)).toEqual([3, 1]);
  });

  it('every rule has a test', () => {
    expect([...TESTED].sort()).toEqual(VM_RULES.map((r) => r.id).sort());
  });
});
