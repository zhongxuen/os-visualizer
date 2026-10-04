import { describe, expect, it } from 'vitest';

import {
  directoryFor,
  presetById,
  validateSizing,
  validateVmInput,
  VM_PRESETS,
  VM_SHARE_STATE,
  type VmConfig,
  type VmInput,
} from '@/core/vm';

const base = presetById('ostep-array')!.input;

function withConfig(change: Partial<VmConfig>, rest: Partial<VmInput> = {}): VmInput {
  return { ...base, ...rest, config: { ...base.config, ...change } };
}

function issues(input: VmInput): string[] {
  const result = validateVmInput(input);
  return result.ok ? [] : result.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('validateVmInput', () => {
  it('accepts every preset', () => {
    for (const preset of VM_PRESETS) {
      expect(validateVmInput(preset.input), preset.id).toMatchObject({ ok: true });
      expect(validateSizing(preset.sizing), preset.id).toBe(true);
    }
  });

  it.each<[string, VmInput]>([
    ['address bits out of range', withConfig({ vaBits: 17 })],
    ['a page size that is not a power of two', withConfig({ pageSize: 24 })],
    ['a page that leaves no VPN bit', withConfig({ pageSize: 256 })],
    [
      'a PFN beyond physical memory',
      { ...base, pages: [{ vpn: 1, valid: true, pfn: 64, prot: 'rw' }] },
    ],
    [
      'a VPN beyond the address space',
      { ...base, pages: [{ vpn: 16, valid: true, pfn: 1, prot: 'rw' }] },
    ],
    ['a VPN listed twice', { ...base, pages: [...base.pages, base.pages[0]!] }],
    [
      'an address beyond the address space',
      { ...base, accesses: [{ va: 256, op: 'read' }] },
    ],
    ['no accesses', { ...base, accesses: [] }],
    [
      '41 accesses',
      { ...base, accesses: Array.from({ length: 41 }, () => ({ va: 0, op: 'read' })) },
    ],
    ['a PTBR that is not 4-aligned', withConfig({ ptbr: 2 })],
    ['a linear table that runs past physical memory', withConfig({ ptbr: 1000 })],
    ['a TLB of 9 entries', withConfig({ tlbSize: 9 })],
    [
      'two levels with a valid page missing its directory entry',
      withConfig({ levels: 2 }),
    ],
    [
      'two levels with 4-byte pages',
      withConfig({ levels: 2, pageSize: 4 }, { pages: [] }),
    ],
    [
      'two levels when one page-table page covers the whole VPN',
      withConfig({ levels: 2, pageSize: 64, vaBits: 7 }, { pages: [] }),
    ],
  ])('rejects %s', (_name, input) => {
    expect(issues(input)).not.toEqual([]);
  });

  it('reports the path of a bad field', () => {
    expect(issues({ ...base, accesses: [{ va: 300, op: 'read' }] })).toEqual([
      'accesses.0.va: Address must be below 256',
    ]);
  });

  it('does not run the cross-field checks on malformed input', () => {
    expect(validateVmInput({ config: null, pages: 3 })).toMatchObject({ ok: false });
  });
});

describe('directoryFor', () => {
  it('gives each needed directory index a page-table page in the highest free frame', () => {
    const config: VmConfig = { ...base.config, levels: 2, ptbr: 0 };
    const directory = directoryFor(config, base.pages);
    // 4 PTEs per 16-byte page: VPNs 6, 7 → index 1; VPN 8 → index 2.
    expect(directory).toEqual([
      { index: 1, pfn: 63 },
      { index: 2, pfn: 62 },
    ]);
    expect(validateVmInput({ ...base, config, directory })).toMatchObject({ ok: true });
  });

  it('is empty for one level', () => {
    expect(directoryFor(base.config, base.pages)).toEqual([]);
  });
});

describe('VM_SHARE_STATE', () => {
  it('defaults to the OSTEP array walk', () => {
    expect(VM_SHARE_STATE.defaults.input.accesses).toEqual(base.accesses);
  });

  it('rejects a link whose input fails the cross-field checks', () => {
    const bad = structuredClone(VM_SHARE_STATE.defaults);
    bad.input.accesses = [{ va: 999, op: 'read' }];
    expect(VM_SHARE_STATE.schema.safeParse(bad).success).toBe(false);
  });
});
