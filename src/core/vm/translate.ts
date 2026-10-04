/**
 * `translate`: run a list of accesses through the TLB and the page tables, one phase per
 * access and one event per step of 06 §2:
 *
 * 1. split the VA; 2. TLB lookup; 3. on a miss, read the PDE and/or PTE (an invalid one
 * faults); 4. protection check (a write to a read-only page faults); 5. on a miss, fill the
 * TLB; 6. set accessed/dirty and form the PA; 7. the data access itself.
 *
 * Steps that don't happen emit nothing (a hit has no step 3 or 5; a fault ends the access).
 * Each event takes one step on the timeline. Pure and deterministic.
 */

import { createRun } from '../events/builder';
import type { SimResult } from '../sim/result';
import {
  geometry,
  type Access,
  type Geometry,
  type VmConfig,
  type VmInput,
} from './config';
import type {
  AccessResult,
  FaultKind,
  VmCounters,
  VmEvent,
  VmEventKind,
  VmSnapshot,
  VmStep,
} from './events';
import {
  buildTables,
  findPde,
  findPte,
  markAccess,
  pdeAddress,
  physicalAddress,
  pteAddress,
  splitVa,
  type PageTables,
  type VaFields,
} from './memory';
import { createTlb, tlbInsert, tlbLookup, tlbTouch, type Tlb } from './tlb';

export type VmRun = SimResult<VmEvent>;

/** `n` in binary, zero-padded to `bits` digits (nothing for 0 bits). */
export function bin(n: number, bits: number): string {
  return bits <= 0 ? '' : n.toString(2).padStart(bits, '0');
}

function fieldsText(g: Geometry, f: VaFields): string {
  if (g.levels === 1) return `VPN ${f.vpn}, offset ${f.offset}`;
  return `VPN ${f.vpn} (directory index ${f.pdIndex}, table index ${f.ptIndex}), offset ${f.offset}`;
}

function vaBinary(g: Geometry, f: VaFields): string {
  if (g.levels === 1) return `${bin(f.vpn, g.vpnBits)} ${bin(f.offset, g.offsetBits)}`;
  return `${bin(f.pdIndex, g.pdIndexBits)} ${bin(f.ptIndex, g.ptIndexBits)} ${bin(f.offset, g.offsetBits)}`;
}

/** Run `accesses` against `tables` on the machine `config`. Expects valid input. */
export function translate(
  config: VmConfig,
  tables: PageTables,
  accesses: readonly Access[],
): VmRun {
  const g = geometry(config);
  const run = createRun<VmEvent>({ unit: 'step' });

  let tlb: Tlb = createTlb(config.tlbSize);
  let current = tables;
  const counters: VmCounters = { accesses: 0, hits: 0, misses: 0, faults: 0, memRefs: 0 };
  const log: AccessResult[] = [];

  accesses.forEach((access, index) => {
    const { va, op } = access;
    const write = op === 'write';
    const fields = splitVa(g, va);
    const { vpn } = fields;
    const phaseId = `access-${index}`;
    let n = 0;
    let refs = 0;
    let hit = false;

    const snapshot = (): VmSnapshot => ({
      access: index,
      fields,
      tlb: tlb.map((entry) => (entry ? { ...entry } : null)),
      ptes: current.ptes.map((pte) => ({ ...pte })),
      directory: current.directory.map((pde) => ({ ...pde })),
      counters: { ...counters },
      log: log.map((result) => ({ ...result })),
    });

    const emit = (
      kind: VmEventKind,
      step: VmStep,
      citation: string,
      label: string,
      extra: Partial<Omit<VmEvent, 'kind' | 'step' | 'state'>> = {},
    ) => {
      run.emit({
        kind,
        step,
        id: `vm.${phaseId}.${n++}`,
        label,
        citation,
        access: index,
        va,
        op,
        vpn,
        ...extra,
        state: snapshot(),
      });
      run.advance();
    };

    const finish = (fault: FaultKind | null, pa: number | null) => {
      counters.accesses += 1;
      if (fault) counters.faults += 1;
      log.push({ index, va, op, tlb: hit ? 'hit' : 'miss', fault, pa, memRefs: refs });
    };

    const reference = () => {
      refs += 1;
      counters.memRefs += 1;
    };

    run.phase(
      phaseId,
      `${write ? 'Write' : 'Read'} VA ${va}`,
      `Access ${index + 1} of ${accesses.length}: ${op} virtual address ${va}.`,
      `Translate virtual address ${va} to a physical address, then ${op} it.`,
    );

    // 1. Split.
    emit(
      'vm.split',
      1,
      g.levels === 2 ? 'ostep.20.3' : 'ostep.18.1',
      `VA ${va} = ${vaBinary(g, fields)}: ${fieldsText(g, fields)}.`,
      {
        ...(g.levels === 2
          ? {
              detail: `${g.pdIndexBits} directory-index bits, ${g.ptIndexBits} table-index bits and ${g.offsetBits} offset bits.`,
            }
          : {
              detail: `${g.vpnBits} VPN bits and ${g.offsetBits} offset bits (${g.pageSize}-byte pages).`,
            }),
      },
    );

    // 2. TLB lookup.
    let pfn: number;
    let prot: 'r' | 'rw';
    const slot = tlbLookup(tlb, vpn);
    if (slot !== -1) {
      hit = true;
      counters.hits += 1;
      tlb = tlbTouch(tlb, slot, index);
      const entry = tlb[slot]!;
      pfn = entry.pfn;
      prot = entry.prot;
      emit(
        'vm.tlbHit',
        2,
        'ostep.19.1',
        `TLB hit: VPN ${vpn} is in slot ${slot}, PFN ${pfn}.`,
        {
          slot,
          pfn,
          detail: 'No page-table walk needed.',
        },
      );
    } else {
      counters.misses += 1;
      emit(
        'vm.tlbMiss',
        2,
        'ostep.19.1',
        config.tlbSize === 0
          ? `No TLB: walk the page table for VPN ${vpn}.`
          : `TLB miss: VPN ${vpn} is not in the TLB, so walk the page table.`,
      );

      // 3. Page-table walk.
      let pde = null;
      if (g.levels === 2) {
        const address = pdeAddress(current, fields.pdIndex);
        reference();
        pde = findPde(current, fields.pdIndex);
        if (!pde) {
          finish('invalid', null);
          emit(
            'vm.fault',
            3,
            'ostep.20.3',
            `Fault: directory entry ${fields.pdIndex} (at PA ${address}) is invalid, so VPN ${vpn} is not mapped.`,
            {
              address,
              fault: 'invalid',
              table: 'pde',
              detail:
                'The access stops and the TLB is not filled. The OS decides what happens next.',
            },
          );
          return;
        }
        emit(
          'vm.readPde',
          3,
          'ostep.20.3',
          `Read PDE ${fields.pdIndex} at PA ${address} = PDBR ${current.ptbr} + ${fields.pdIndex} × 4: page-table page in frame ${pde.pfn}.`,
          { address, pfn: pde.pfn },
        );
      }

      const address = pteAddress(g, current, fields, pde);
      reference();
      const pte = findPte(current, vpn);
      const formula =
        g.levels === 1
          ? `PTBR ${current.ptbr} + ${vpn} × 4`
          : `${pde!.pfn} × ${g.pageSize} + ${fields.ptIndex} × 4`;
      if (!pte || !pte.valid) {
        finish('invalid', null);
        emit(
          'vm.fault',
          3,
          'ostep.18.3',
          `Fault: the PTE for VPN ${vpn} (at PA ${address} = ${formula}) is invalid.`,
          {
            address,
            fault: 'invalid',
            table: 'pte',
            detail:
              'The access stops and the TLB is not filled. The OS decides what happens next.',
          },
        );
        return;
      }
      pfn = pte.pfn;
      prot = pte.prot;
      emit(
        'vm.readPte',
        3,
        g.levels === 2 ? 'ostep.20.3' : 'ostep.18.4',
        `Read the PTE for VPN ${vpn} at PA ${address} = ${formula}: valid, PFN ${pfn}, ${prot}.`,
        { address, pfn },
      );
    }

    // 4. Protection.
    if (write && prot === 'r') {
      finish('protection', null);
      emit(
        'vm.fault',
        4,
        hit ? 'ostep.19.4' : 'ostep.18.3',
        `Fault: VPN ${vpn} is read-only, so the write is not allowed.`,
        {
          fault: 'protection',
          ...(hit ? { slot } : {}),
          detail: hit
            ? 'Checked against the protection bits cached in the TLB entry. The access stops.'
            : 'The access stops and the TLB is not filled.',
        },
      );
      return;
    }
    emit(
      'vm.protOk',
      4,
      'ostep.18.3',
      `Protection ${prot}: a ${op} is allowed.`,
      hit ? { slot } : {},
    );

    // 5. TLB fill.
    if (!hit && config.tlbSize > 0) {
      const filled = tlbInsert(tlb, config.tlbPolicy, { vpn, pfn, prot }, index);
      tlb = filled.tlb;
      const { evicted } = filled;
      emit(
        'vm.tlbInsert',
        5,
        evicted ? 'ostep.19.6' : 'ostep.19.1',
        evicted
          ? `Load VPN ${vpn} → PFN ${pfn} into slot ${filled.slot}, evicting VPN ${evicted.vpn} (${config.tlbPolicy === 'lru' ? 'least recently used' : 'loaded first'}).`
          : `Load VPN ${vpn} → PFN ${pfn} into empty slot ${filled.slot}.`,
        { slot: filled.slot, pfn, ...(evicted ? { evicted } : {}) },
      );
    }

    // 6. Hardware bits and the physical address.
    current = markAccess(current, vpn, write);
    const pa = physicalAddress(g, pfn, fields.offset);
    emit(
      'vm.physical',
      6,
      'ostep.18.1',
      `PA = PFN ${pfn} << ${g.offsetBits} | offset ${fields.offset} = ${bin(pfn, g.pfnBits)} ${bin(fields.offset, g.offsetBits)} = ${pa}.`,
      {
        pfn,
        pa,
        detail: write
          ? 'The hardware sets the accessed and dirty bits.'
          : 'The hardware sets the accessed bit.',
      },
    );

    // 7. The data access.
    reference();
    finish(null, pa);
    emit(
      'vm.memory',
      7,
      'ostep.18.5',
      `${write ? 'Write' : 'Read'} PA ${pa}: ${refs === 1 ? '1 memory reference' : `${refs} memory references`} for this access.`,
      { address: pa, pa },
    );
  });

  return run.finish();
}

/** `translate` on a whole input: the tables built from its mapping list. */
export function runVm(input: VmInput): VmRun {
  return translate(input.config, buildTables(input), input.accesses);
}
